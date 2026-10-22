import type { Diagram, DiagramNode, DiagramPage } from '@/components/designer/diagram-types'
import { listAgentNodes, listToolsForAgent } from '@/components/agent-workflow/tool-agent-mapping'
import type { WorkflowExecutionType } from '@/types/agent-workflow'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'

/** Agent palettes the workflow builder knows. Other agent nodes are sent as a plain agent. */
const PLAN_PALETTE_IDS = new Set([
  'aw-agent',
  'aw-planner',
  'aw-router',
  'aw-reviewer',
  'aw-specialist',
  'aw-llm-agent',
  'aw-tool-agent',
])
const MAX_KEY_LENGTH = 64
const MAX_NAME_LENGTH = 120

export interface CanvasPlan {
  plan: WorkflowGenerationPlan
  /** Canvas node id for each plan key, so an updated plan can keep each agent's settings. */
  nodeIdByKey: Map<string, string>
}

/**
 * A workflow tab as a generation plan, so the Workflow AI can update it.
 *
 * Agents keep their position, and connections between agents become edges.
 * Start, end, and other non-agent nodes are left out, as they are in a
 * generated plan. Returns null when the tab has no agents.
 */
export function planFromDiagram(page: DiagramPage, executionType: WorkflowExecutionType): CanvasPlan | null {
  const { diagram } = page
  const agents = listAgentNodes(diagram)
  if (agents.length === 0) return null

  const keyById = new Map<string, string>()
  const used = new Set<string>()
  for (const node of agents) {
    const key = uniqueKey(node.label || node.id, used)
    used.add(key)
    keyById.set(node.id, key)
  }

  const plan: WorkflowGenerationPlan = {
    workflowName: (page.name.trim() || 'Untitled workflow').slice(0, 200),
    description: '',
    executionType,
    agents: agents.map((node) => {
      const name = (node.label.trim() || 'Agent').slice(0, MAX_NAME_LENGTH)
      const description = node.agent?.description?.trim() ?? ''
      return {
        key: keyById.get(node.id)!,
        name,
        description,
        paletteId: PLAN_PALETTE_IDS.has(node.paletteId) ? node.paletteId : 'aw-agent',
        // The builder requires instructions; fall back to the role so the agent keeps its intent.
        instructions: node.agent?.instructions?.trim() || description || `Act as ${name}.`,
        tools: listToolsForAgent(diagram, node.id)
          .map((tool) => tool.label.trim())
          .filter(Boolean),
        x: node.x,
        y: node.y,
      }
    }),
    edges: diagram.edges.flatMap((edge) => {
      const fromKey = keyById.get(edge.from)
      const toKey = keyById.get(edge.to)
      if (!fromKey || !toKey) return []
      return [
        {
          fromKey,
          toKey,
          label: edge.label?.trim() ?? '',
          humanApproval: Boolean(edge.connector?.humanApproval),
        },
      ]
    }),
  }

  const nodeIdByKey = new Map(Array.from(keyById, ([nodeId, key]) => [key, nodeId]))
  return { plan, nodeIdByKey }
}

/**
 * Carry each agent's settings from the canvas a plan was updated from.
 *
 * A plan only holds an agent's name, role, instructions, and tools, so an
 * agent whose key survives the update keeps its model, approvals, memory,
 * and every other setting. Agents the update added keep their defaults.
 */
export function keepAgentSettings(
  next: Diagram,
  nextIdByKey: Map<string, string>,
  base: CanvasPlan,
  previous: Diagram,
): Diagram {
  const previousById = new Map(previous.nodes.map((node) => [node.id, node]))
  const sourceById = new Map<string, DiagramNode>()
  for (const [key, nodeId] of nextIdByKey) {
    const source = previousById.get(base.nodeIdByKey.get(key) ?? '')
    if (source?.agent) sourceById.set(nodeId, source)
  }
  return {
    ...next,
    nodes: next.nodes.map((node) => {
      const source = sourceById.get(node.id)
      if (!source?.agent || !node.agent) return node
      return {
        ...node,
        agent: {
          ...source.agent,
          agentType: node.agent.agentType,
          description: node.agent.description,
          instructions: node.agent.instructions,
          tools: node.agent.tools,
        },
      }
    }),
  }
}

/** A lowercase key that starts with a letter, as the workflow builder's schema requires. */
function uniqueKey(label: string, used: Set<string>): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const base = (/^[a-z]/.test(slug) ? slug : `agent_${slug}`).replace(/_+$/, '').slice(0, MAX_KEY_LENGTH - 4)
  let key = base
  for (let index = 2; used.has(key); index += 1) key = `${base}_${index}`
  return key
}
