import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
  createWorkflowId,
  defaultAgentConfig,
  defaultConnectorConfig,
  enrichAgentNode,
  TOOL_NODE_HEIGHT,
  TOOL_NODE_WIDTH,
  TOOL_PALETTE_ID,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { attachToolToAgent } from '@/components/agent-workflow/tool-agent-mapping'
import { positionGeneratedAgents } from '@/components/agent-workflow/workflow-layout'
import {
  bestPortSidesForConnection,
  createNodeId,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type {
  AgentWorkflowMeta,
  WorkflowExecutionType,
} from '@/types/agent-workflow'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'

function mapExecutionType(type: WorkflowGenerationPlan['executionType']): WorkflowExecutionType {
  switch (type) {
    case 'parallel':
      return 'parallel'
    case 'human-in-the-loop':
      return 'human-in-the-loop'
    case 'conditional':
      return 'conditional'
    case 'group-chat':
      return 'group-chat'
    case 'dependency':
      return 'dependency'
    default:
      return 'sequential'
  }
}

function nextEdgeId(index: number): string {
  return `edge-gen-${index + 1}-${Math.random().toString(36).slice(2, 6)}`
}

function resolveAgentShape(
  node: DiagramNode,
  paletteById: Map<string, PaletteItem>,
): PaletteItem['shape'] {
  return paletteById.get(node.paletteId)?.shape ?? 'process'
}

/** Convert an LLM workflow plan into a canvas-ready diagram. */
export function diagramFromGenerationPlan(
  plan: WorkflowGenerationPlan,
  paletteById: Map<string, PaletteItem>,
): { diagram: Diagram; workflowMeta: Partial<AgentWorkflowMeta>; workflowName: string } {
  const keyToId = new Map<string, string>()
  let agentNodes: DiagramNode[] = []
  const positionsById = new Map<string, { x: number; y: number }>()

  for (const agent of plan.agents) {
    const paletteId = paletteById.has(agent.paletteId) ? agent.paletteId : 'aw-agent'
    const paletteItem = paletteById.get(paletteId)!
    const nodeId = createNodeId()
    keyToId.set(agent.key, nodeId)

    if (
      typeof agent.x === 'number' &&
      typeof agent.y === 'number' &&
      Number.isFinite(agent.x) &&
      Number.isFinite(agent.y)
    ) {
      positionsById.set(nodeId, { x: agent.x, y: agent.y })
    }

    const base = enrichAgentNode(
      {
        id: nodeId,
        paletteId,
        label: agent.name,
        x: agent.x ?? 0,
        y: agent.y ?? 0,
        width: AGENT_NODE_WIDTH,
        height: AGENT_NODE_HEIGHT,
      },
      paletteItem,
    )

    agentNodes.push({
      ...base,
      agent: {
        ...base.agent!,
        description: agent.description || base.agent!.description,
        instructions: agent.instructions || base.agent!.instructions,
      },
    })
  }

  const edgePairs = plan.edges.flatMap((edge) => {
    const from = keyToId.get(edge.fromKey)
    const to = keyToId.get(edge.toKey)
    if (!from || !to) return []
    return [{ from, to, label: edge.label, humanApproval: edge.humanApproval }]
  })

  agentNodes = positionGeneratedAgents(
    agentNodes,
    edgePairs.map((edge) => ({ from: edge.from, to: edge.to })),
    positionsById,
  )

  const toolNodes: DiagramNode[] = []
  for (const agent of plan.agents) {
    const agentId = keyToId.get(agent.key)
    if (!agentId) continue
    const agentNode = agentNodes.find((node) => node.id === agentId)
    if (!agentNode) continue

    agent.tools.forEach((toolName, index) => {
      const toolPalette = paletteById.get(TOOL_PALETTE_ID)
      if (!toolPalette) return

      const toolBase = enrichAgentNode(
        {
          id: createNodeId(),
          paletteId: TOOL_PALETTE_ID,
          label: toolName,
          x: agentNode.x,
          y: agentNode.y + AGENT_NODE_HEIGHT + 48 + index * (TOOL_NODE_HEIGHT + 8),
          width: TOOL_NODE_WIDTH,
          height: TOOL_NODE_HEIGHT,
        },
        toolPalette,
      )

      const diagramSoFar: Diagram = { nodes: [...agentNodes, ...toolNodes], edges: [] }
      toolNodes.push(attachToolToAgent(diagramSoFar, toolBase, agentId))
    })
  }

  const nodesById = new Map(agentNodes.map((node) => [node.id, node]))
  const edges: DiagramEdge[] = edgePairs.flatMap((edge, index) => {
    const fromNode = nodesById.get(edge.from)
    const toNode = nodesById.get(edge.to)
    if (!fromNode || !toNode) return []

    const sides = bestPortSidesForConnection(
      fromNode,
      resolveAgentShape(fromNode, paletteById),
      toNode,
      resolveAgentShape(toNode, paletteById),
    )
    const connector = defaultConnectorConfig()
    return [
      {
        id: nextEdgeId(index),
        from: edge.from,
        to: edge.to,
        fromSide: sides.fromSide,
        toSide: sides.toSide,
        routing: 'curved',
        label: edge.label || undefined,
        connector: {
          ...connector,
          humanApproval: edge.humanApproval,
        },
      },
    ]
  })

  return {
    diagram: { nodes: [...agentNodes, ...toolNodes], edges },
    workflowName: plan.workflowName,
    workflowMeta: {
      workflowId: createWorkflowId(),
      version: 1,
      status: 'draft',
      executionType: mapExecutionType(plan.executionType),
    },
  }
}

/** Fallback when palette metadata is missing — still produces runnable nodes. */
export function diagramFromGenerationPlanSafe(
  plan: WorkflowGenerationPlan,
  paletteById: Map<string, PaletteItem>,
): { diagram: Diagram; workflowMeta: Partial<AgentWorkflowMeta>; workflowName: string } {
  const fallbackPalette = paletteById.get('aw-agent')
  if (fallbackPalette) {
    return diagramFromGenerationPlan(plan, paletteById)
  }

  const keyToId = new Map(plan.agents.map((agent) => [agent.key, createNodeId()]))
  const positionsById = new Map<string, { x: number; y: number }>()
  plan.agents.forEach((agent) => {
    const id = keyToId.get(agent.key)
    if (
      id &&
      typeof agent.x === 'number' &&
      typeof agent.y === 'number' &&
      Number.isFinite(agent.x) &&
      Number.isFinite(agent.y)
    ) {
      positionsById.set(id, { x: agent.x, y: agent.y })
    }
  })

  const edgePairs = plan.edges.flatMap((edge) => {
    const from = keyToId.get(edge.fromKey)
    const to = keyToId.get(edge.toKey)
    if (!from || !to) return []
    return [{ from, to, humanApproval: edge.humanApproval, label: edge.label }]
  })

  const nodes: DiagramNode[] = positionGeneratedAgents(
    plan.agents.map((agent) => ({
      id: keyToId.get(agent.key)!,
      paletteId: 'aw-agent',
      label: agent.name,
      x: agent.x ?? 0,
      y: agent.y ?? 0,
      width: AGENT_NODE_WIDTH,
      height: AGENT_NODE_HEIGHT,
      agent: {
        ...defaultAgentConfig('aw-agent', agent.name),
        description: agent.description,
        instructions: agent.instructions,
      },
    })),
    edgePairs.map((edge) => ({ from: edge.from, to: edge.to })),
    positionsById,
  )

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const edges: DiagramEdge[] = edgePairs.flatMap((edge, index) => {
    const fromNode = nodesById.get(edge.from)
    const toNode = nodesById.get(edge.to)
    if (!fromNode || !toNode) return []
    const sides = bestPortSidesForConnection(fromNode, 'process', toNode, 'process')
    return [
      {
        id: nextEdgeId(index),
        from: edge.from,
        to: edge.to,
        fromSide: sides.fromSide,
        toSide: sides.toSide,
        routing: 'curved',
        label: edge.label || undefined,
        connector: { ...defaultConnectorConfig(), humanApproval: edge.humanApproval },
      },
    ]
  })

  return {
    diagram: { nodes, edges },
    workflowName: plan.workflowName,
    workflowMeta: {
      workflowId: createWorkflowId(),
      version: 1,
      status: 'draft',
      executionType: mapExecutionType(plan.executionType),
    },
  }
}
