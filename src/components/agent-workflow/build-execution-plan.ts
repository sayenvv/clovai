import type { Diagram, DiagramEdge, DiagramNode } from '@/components/designer/diagram-types'
import type { ExecutionPlanStep } from '@/types/agent-workflow'
import { resolveAgentType } from '@/components/agent-workflow/agent-workflow-defaults'
import { listAgentNodes, listToolsForAgent } from '@/components/agent-workflow/tool-agent-mapping'

function agentEdges(diagram: Diagram): DiagramEdge[] {
  const agentIds = new Set(listAgentNodes(diagram).map((node) => node.id))
  return diagram.edges.filter((edge) => agentIds.has(edge.from) && agentIds.has(edge.to))
}

function sortAgentsSpatially(agents: DiagramNode[]): DiagramNode[] {
  return [...agents].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
}

function stepForAgent(
  diagram: Diagram,
  agent: DiagramNode,
  index: number,
  ordered: DiagramNode[],
  edges: DiagramEdge[],
): ExecutionPlanStep {
  const nextAgent = ordered[index + 1]
  const directEdge = edges.find((edge) => edge.from === agent.id && edge.to === nextAgent?.id)
  const anyOutgoing = edges.find((edge) => edge.from === agent.id)
  const outgoing = directEdge ?? (ordered.length > 1 ? anyOutgoing : undefined)

  return {
    nodeId: agent.id,
    agentName: agent.label || 'Agent',
    agentType: resolveAgentType(agent.paletteId ?? 'aw-agent'),
    tools: listToolsForAgent(diagram, agent.id).map((tool) => tool.label),
    outgoingEdgeId: outgoing?.id,
    humanApproval: Boolean(outgoing?.connector?.humanApproval),
    approvalMessage: outgoing?.connector?.approvalMessage,
    approvalRole: outgoing?.connector?.approvalRole,
    nextAgentName: nextAgent?.label ?? (outgoing
      ? ordered.find((candidate) => candidate.id === outgoing.to)?.label
      : undefined),
  }
}

/** Build plan from graph topology (preferred ordering). */
function buildOrderedPlan(diagram: Diagram, agents: DiagramNode[]): ExecutionPlanStep[] {
  const edges = agentEdges(diagram)
  const inDegree = new Map<string, number>()
  agents.forEach((agent) => inDegree.set(agent.id, 0))
  edges.forEach((edge) => inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1))

  const queue = agents.filter((agent) => (inDegree.get(agent.id) ?? 0) === 0)
  if (queue.length === 0) queue.push(agents[0])

  const visited = new Set<string>()
  const ordered = [...queue]

  while (ordered.length > 0) {
    const current = ordered.shift()!
    if (visited.has(current.id)) continue
    visited.add(current.id)

    edges
      .filter((edge) => edge.from === current.id)
      .forEach((edge) => {
        const next = agents.find((agent) => agent.id === edge.to)
        if (next && !visited.has(next.id)) ordered.push(next)
      })
  }

  for (const agent of agents) {
    if (!visited.has(agent.id)) ordered.push(agent)
  }

  const uniqueOrdered = [...new Map(ordered.map((agent) => [agent.id, agent])).values()]
  return uniqueOrdered.map((agent, index) => stepForAgent(diagram, agent, index, uniqueOrdered, edges))
}

/** Spatial fallback when graph ordering yields nothing. */
function buildSpatialFallbackPlan(diagram: Diagram, agents: DiagramNode[]): ExecutionPlanStep[] {
  const ordered = sortAgentsSpatially(agents)
  const edges = agentEdges(diagram)
  return ordered.map((agent, index) => stepForAgent(diagram, agent, index, ordered, edges))
}

/** Build a linear execution order from the agent workflow graph. */
export function buildExecutionPlan(diagram: Diagram): ExecutionPlanStep[] {
  const agents = listAgentNodes(diagram)
  if (agents.length === 0) return []

  const ordered = buildOrderedPlan(diagram, agents)
  if (ordered.length > 0) return ordered

  return buildSpatialFallbackPlan(diagram, agents)
}

/** Always returns one step per executable agent (never empty when agents exist). */
export function getExecutablePlan(diagram: Diagram): ExecutionPlanStep[] {
  const agents = listAgentNodes(diagram)
  if (agents.length === 0) return []

  const plan = buildExecutionPlan(diagram)
  if (plan.length >= agents.length) return plan

  const covered = new Set(plan.map((step) => step.nodeId))
  const missing = sortAgentsSpatially(agents.filter((agent) => !covered.has(agent.id)))
  const edges = agentEdges(diagram)
  const tail = missing.map((agent, index) =>
    stepForAgent(diagram, agent, plan.length + index, [...agents], edges),
  )
  return [...plan, ...tail]
}

/** Agent nodes in execution order (matches plan step sequence). */
export function getOrderedExecutionAgents(diagram: Diagram) {
  const plan = getExecutablePlan(diagram)
  const agents = listAgentNodes(diagram)
  if (plan.length === 0) return sortAgentsSpatially(agents)
  return plan
    .map((step) => agents.find((agent) => agent.id === step.nodeId))
    .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
}
