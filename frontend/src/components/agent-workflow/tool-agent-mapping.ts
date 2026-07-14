import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
  AGENT_PALETTE_ID,
  TOOL_NODE_HEIGHT,
  TOOL_NODE_WIDTH,
  TOOL_PALETTE_ID,
  MCP_TOOL_PALETTE_ID,
  SKILL_PALETTE_ID,
  INTEGRATION_PALETTE_ID,
  MEMORY_PALETTE_ID,
  EXECUTOR_PALETTE_ID,
  isMappedToolPalette,
  isAlwaysChildPalette,
  childKindForPalette,
} from '@/components/agent-workflow/agent-workflow-defaults'

export {
  AGENT_PALETTE_ID,
  TOOL_PALETTE_ID,
  MCP_TOOL_PALETTE_ID,
  SKILL_PALETTE_ID,
  INTEGRATION_PALETTE_ID,
  MEMORY_PALETTE_ID,
  EXECUTOR_PALETTE_ID,
  isMappedToolPalette,
  isAlwaysChildPalette,
  childKindForPalette,
}
export const TOOL_UNDER_AGENT_GAP = 48
/** Horizontal gap between child nodes in a row under an agent. */
export const TOOL_ROW_GAP = 12

/** Soft vertical curve from agent attachment rail to a child node. */
export function curvedAttachmentPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const midY = from.y + (to.y - from.y) * 0.55
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`
}

const NON_AGENT_AW_IDS = new Set([
  'aw-tool',
  'aw-mcp-tool',
  'aw-skill',
  'aw-integration',
  'aw-note',
  'aw-label',
])

export function isAgentNode(node: DiagramNode): boolean {
  if (node.mappedAgentId) return false
  const paletteId = node.paletteId ?? ''
  if (NON_AGENT_AW_IDS.has(paletteId)) return false
  if (paletteId.startsWith('aw-')) return true
  if (node.agent?.agentType && node.agent.agentType !== 'tool') return true
  return false
}

export function isExecutorNode(node: DiagramNode): boolean {
  return (
    node.paletteId === EXECUTOR_PALETTE_ID ||
    node.agent?.agentType === 'executor'
  )
}

export function isMcpToolNode(node: DiagramNode): boolean {
  return node.paletteId === MCP_TOOL_PALETTE_ID
}

export function isToolNode(node: DiagramNode): boolean {
  if (node.mappedAgentId) return true
  return isAlwaysChildPalette(node.paletteId ?? '')
}

export function listAgentNodes(diagram: Diagram): DiagramNode[] {
  return diagram.nodes.filter(isAgentNode)
}

export function listToolsForAgent(diagram: Diagram, agentId: string): DiagramNode[] {
  return diagram.nodes.filter((node) => isToolNode(node) && node.mappedAgentId === agentId)
}

/** Stable left-to-right order for row layout under an agent. */
export function orderedToolsForAgent(diagram: Diagram, agentId: string): DiagramNode[] {
  return listToolsForAgent(diagram, agentId).sort(
    (a, b) => a.x - b.x || a.id.localeCompare(b.id),
  )
}

export function agentNodeSize(node: DiagramNode): { width: number; height: number } {
  return {
    width: node.width ?? AGENT_NODE_WIDTH,
    height: node.height ?? AGENT_NODE_HEIGHT,
  }
}

export function toolNodeSize(node: DiagramNode): { width: number; height: number } {
  return {
    width: node.width ?? TOOL_NODE_WIDTH,
    height: node.height ?? TOOL_NODE_HEIGHT,
  }
}

export function computeToolPosition(
  agent: DiagramNode,
  tool: DiagramNode,
  indexAmongTools: number,
  totalTools: number,
): Pick<DiagramNode, 'x' | 'y'> {
  const agentSize = agentNodeSize(agent)
  const toolSize = toolNodeSize(tool)
  const rowWidth =
    totalTools * toolSize.width + Math.max(0, totalTools - 1) * TOOL_ROW_GAP
  const startX = agent.x + (agentSize.width - rowWidth) / 2
  return {
    x: startX + indexAmongTools * (toolSize.width + TOOL_ROW_GAP),
    y: agent.y + agentSize.height + TOOL_UNDER_AGENT_GAP,
  }
}

export function attachToolToAgent(
  diagram: Diagram,
  tool: DiagramNode,
  agentId: string,
): DiagramNode {
  const agent = diagram.nodes.find((node) => node.id === agentId)
  if (!agent) return tool
  const index = listToolsForAgent(diagram, agentId).length
  const totalTools = index + 1
  const position = computeToolPosition(agent, tool, index, totalTools)
  return {
    ...tool,
    mappedAgentId: agentId,
    width: tool.width ?? TOOL_NODE_WIDTH,
    height: tool.height ?? TOOL_NODE_HEIGHT,
    ...position,
  }
}

function containsPoint(
  node: DiagramNode,
  size: { width: number; height: number },
  point: { x: number; y: number },
): boolean {
  return (
    point.x >= node.x &&
    point.x <= node.x + size.width &&
    point.y >= node.y &&
    point.y <= node.y + size.height
  )
}

/** Prefer agent under cursor, otherwise nearest agent on canvas. */
export function pickAgentForToolPlacement(
  diagram: Diagram,
  point: { x: number; y: number },
): DiagramNode | undefined {
  const agents = listAgentNodes(diagram)
  if (agents.length === 0) return undefined

  const hit = agents.find((agent) =>
    containsPoint(agent, agentNodeSize(agent), point),
  )
  if (hit) return hit

  let nearest: DiagramNode | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const agent of agents) {
    const size = agentNodeSize(agent)
    const centerX = agent.x + size.width / 2
    const centerY = agent.y + size.height / 2
    const distance = Math.hypot(point.x - centerX, point.y - centerY)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = agent
    }
  }
  return nearest
}

/** Re-layout tool rows when agents move, tools are added/removed, or mapping changes. */
export function shouldSyncToolLayout(before: Diagram, after: Diagram): boolean {
  const beforeAgents = listAgentNodes(before)
  const afterAgents = listAgentNodes(after)

  if (beforeAgents.length !== afterAgents.length) return true

  for (const agent of afterAgents) {
    const previous = beforeAgents.find((candidate) => candidate.id === agent.id)
    if (!previous) return true
    if (
      previous.x !== agent.x ||
      previous.y !== agent.y ||
      previous.width !== agent.width ||
      previous.height !== agent.height
    ) {
      return true
    }
  }

  const beforeTools = before.nodes.filter(isToolNode)
  const afterTools = after.nodes.filter(isToolNode)
  if (beforeTools.length !== afterTools.length) return true

  for (const tool of afterTools) {
    const previous = beforeTools.find((candidate) => candidate.id === tool.id)
    if (!previous) return true
    if (previous.mappedAgentId !== tool.mappedAgentId) return true
  }

  return false
}

/** Keep mapped tools in a row under their agent after agent moves or remapping. */
export function syncMappedToolLayout(diagram: Diagram): Diagram {
  const agents = listAgentNodes(diagram)
  if (agents.length === 0) return diagram

  const positionById = new Map<string, { x: number; y: number }>()

  for (const agent of agents) {
    const siblings = orderedToolsForAgent(diagram, agent.id)
    siblings.forEach((tool, index) => {
      positionById.set(tool.id, computeToolPosition(agent, tool, index, siblings.length))
    })
  }

  const nodes = diagram.nodes.map((node) => {
    const position = positionById.get(node.id)
    return position ? { ...node, ...position } : node
  })

  return { ...diagram, nodes }
}

export function remapToolToAgent(
  diagram: Diagram,
  toolId: string,
  agentId: string,
): Diagram {
  const tool = diagram.nodes.find((node) => node.id === toolId)
  if (!tool || !isToolNode(tool)) return diagram

  const withoutTool = diagram.nodes.filter((node) => node.id !== toolId)
  const interim: Diagram = { ...diagram, nodes: withoutTool }
  const attached = attachToolToAgent(interim, tool, agentId)
  return syncMappedToolLayout({
    ...interim,
    nodes: [...withoutTool, attached],
  })
}

export function removeToolsMappedToAgent(diagram: Diagram, agentId: string): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.filter(
      (node) => !(isToolNode(node) && node.mappedAgentId === agentId),
    ),
  }
}

export function agentLabel(diagram: Diagram, agentId: string | undefined): string {
  if (!agentId) return 'Unassigned'
  return diagram.nodes.find((node) => node.id === agentId)?.label ?? 'Unknown agent'
}
