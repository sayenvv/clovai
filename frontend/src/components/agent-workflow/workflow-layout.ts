import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
  sizeFlowNode,
} from '@/components/agent-workflow/agent-workflow-defaults'
import {
  flowPortSides,
  type Diagram,
  type DiagramNode,
  type FlowDirection,
} from '@/components/designer/diagram-types'
import { AGENT_DOCK_HANG } from '@/components/agent-workflow/AgentNodeCard'
import {
  agentNodeSize,
  isAgentNode,
  isExecutorNode,
  listAgentNodes,
  listToolsForAgent,
  syncMappedToolLayout,
  toolNodeSize,
  TOOL_BESIDE_AGENT_GAP,
  TOOL_COLUMN_GAP,
  TOOL_ROW_GAP,
  TOOL_UNDER_AGENT_GAP,
} from '@/components/agent-workflow/tool-agent-mapping'
import {
  isEndFlowNode,
  isFlowBoundaryNode,
  isStartFlowNode,
} from '@/components/agent-workflow/workflow-flow-nodes'

const ORIGIN_X = 80
const ORIGIN_Y = 80
const GAP_X = 300
const GAP_Y = 180

export interface LayoutEdgeRef {
  from: string
  to: string
}

/** Simple grid fallback when there are no edges. */
export function autoLayoutNodes(nodes: DiagramNode[]): DiagramNode[] {
  const cols = Math.min(3, Math.max(1, nodes.length))
  return nodes.map((node, index) => ({
    ...node,
    x: ORIGIN_X + (index % cols) * GAP_X,
    y: ORIGIN_Y + Math.floor(index / cols) * GAP_Y,
    width: node.width ?? AGENT_NODE_WIDTH,
    height: node.height ?? AGENT_NODE_HEIGHT,
  }))
}

/**
 * Left-to-right layered layout from workflow edges.
 * Roots start on the left; dependents fan out vertically within each layer.
 */
export function layoutWorkflowAgents(
  nodes: DiagramNode[],
  edges: LayoutEdgeRef[],
): DiagramNode[] {
  if (nodes.length === 0) return nodes
  if (edges.length === 0) return autoLayoutNodes(nodes)

  const ids = new Set(nodes.map((node) => node.id))
  const outgoing = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  ids.forEach((id) => {
    outgoing.set(id, [])
    indegree.set(id, 0)
  })

  edges.forEach((edge) => {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) return
    outgoing.get(edge.from)!.push(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  })

  const roots = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  const start = roots.length > 0 ? roots : [nodes[0].id]
  const layer = new Map<string, number>()
  const queue = [...start]
  start.forEach((id) => layer.set(id, 0))

  while (queue.length > 0) {
    const current = queue.shift()!
    const depth = layer.get(current) ?? 0
    for (const next of outgoing.get(current) ?? []) {
      const proposed = depth + 1
      const existing = layer.get(next)
      // Prefer the longest path so merge nodes sit to the right of branches.
      if (existing === undefined || proposed > existing) {
        layer.set(next, proposed)
        queue.push(next)
      }
    }
  }

  nodes.forEach((node, index) => {
    if (!layer.has(node.id)) layer.set(node.id, index)
  })

  const byLayer = new Map<number, DiagramNode[]>()
  nodes.forEach((node) => {
    const depth = layer.get(node.id) ?? 0
    const list = byLayer.get(depth) ?? []
    list.push(node)
    byLayer.set(depth, list)
  })

  // Preserve a stable order within a layer (plan order / label).
  const order = new Map(nodes.map((node, index) => [node.id, index]))
  const positioned: DiagramNode[] = []

  ;[...byLayer.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([depth, layerNodes]) => {
      const sorted = [...layerNodes].sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      )
      const columnHeight = Math.max(0, sorted.length - 1) * GAP_Y
      const startY = Math.max(ORIGIN_Y, ORIGIN_Y + 120 - columnHeight / 2)

      sorted.forEach((node, index) => {
        positioned.push({
          ...node,
          x: Math.round(ORIGIN_X + depth * GAP_X),
          y: Math.round(startY + index * GAP_Y),
          width: node.width ?? AGENT_NODE_WIDTH,
          height: node.height ?? AGENT_NODE_HEIGHT,
        })
      })
    })

  return positioned
}

/** Apply explicit plan positions when present; otherwise layered layout. */
export function positionGeneratedAgents(
  nodes: DiagramNode[],
  edges: LayoutEdgeRef[],
  positionsById: Map<string, { x: number; y: number }>,
): DiagramNode[] {
  const withExplicit = nodes.filter((node) => positionsById.has(node.id))
  if (withExplicit.length === nodes.length && nodes.length > 0) {
    return nodes.map((node) => {
      const point = positionsById.get(node.id)!
      return {
        ...node,
        x: Math.round(point.x),
        y: Math.round(point.y),
        width: node.width ?? AGENT_NODE_WIDTH,
        height: node.height ?? AGENT_NODE_HEIGHT,
      }
    })
  }

  // Partial positions: seed layered layout then overlay any explicit points.
  const laidOut = layoutWorkflowAgents(nodes, edges)
  if (withExplicit.length === 0) return laidOut

  return laidOut.map((node) => {
    const point = positionsById.get(node.id)
    if (!point) return node
    return { ...node, x: Math.round(point.x), y: Math.round(point.y) }
  })
}

const FLOW_MAIN_GAP: Record<FlowDirection, number> = { horizontal: 96, vertical: 72 }
const FLOW_CROSS_GAP: Record<FlowDirection, number> = { horizontal: 48, vertical: 64 }
const FLOW_CENTER = 200

/** Space a node occupies including its docks and mapped tools; `offset*` is where the card sits. */
interface Footprint {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

function nodeFootprint(diagram: Diagram, node: DiagramNode, direction: FlowDirection): Footprint {
  const card = agentNodeSize(node)
  if (isFlowBoundaryNode(node) || isExecutorNode(node)) {
    return { ...card, offsetX: 0, offsetY: 0 }
  }
  const tools = listToolsForAgent(diagram, node.id).map(toolNodeSize)
  if (direction === 'vertical') {
    const column =
      tools.reduce((sum, tool) => sum + tool.height, 0) +
      Math.max(0, tools.length - 1) * TOOL_COLUMN_GAP
    // Capabilities live inside the vertical card, so only a tool column extends it.
    const side =
      tools.length > 0 ? TOOL_BESIDE_AGENT_GAP + Math.max(...tools.map((tool) => tool.width)) : 0
    return { width: card.width + side, height: Math.max(card.height, column), offsetX: 0, offsetY: 0 }
  }
  const row =
    tools.reduce((sum, tool) => sum + tool.width, 0) +
    Math.max(0, tools.length - 1) * TOOL_ROW_GAP
  const hang =
    tools.length > 0
      ? TOOL_UNDER_AGENT_GAP + Math.max(...tools.map((tool) => tool.height))
      : AGENT_DOCK_HANG
  const width = Math.max(card.width, row)
  return { width, height: card.height + hang, offsetX: (width - card.width) / 2, offsetY: 0 }
}

/** Flow connectors (agent / Start / End ↔ agent / Start / End) take the orientation's port sides. */
export function alignFlowEdges(diagram: Diagram, direction: FlowDirection): Diagram {
  const flowIds = new Set(
    diagram.nodes.filter((node) => isAgentNode(node) || isFlowBoundaryNode(node)).map((node) => node.id),
  )
  const sides = flowPortSides(direction)
  let changed = false
  const edges = diagram.edges.map((edge) => {
    if (edge.locked || !flowIds.has(edge.from) || !flowIds.has(edge.to)) return edge
    if (edge.fromSide === sides.fromSide && edge.toSide === sides.toSide) return edge
    changed = true
    return { ...edge, ...sides }
  })
  return changed ? { ...diagram, edges } : diagram
}

/**
 * Layered layout for the whole workflow in the given orientation.
 * Start takes the first layer, End the last; agents are layered by longest path between them.
 */
export function layoutWorkflowDiagram(source: Diagram, direction: FlowDirection): Diagram {
  // Cards change size with orientation; measure footprints at the target size.
  const diagram: Diagram = {
    ...source,
    direction,
    nodes: source.nodes.map((node) => sizeFlowNode(node, direction)),
  }
  const agents = listAgentNodes(diagram)
  const start = diagram.nodes.find(isStartFlowNode)
  const end = diagram.nodes.find(isEndFlowNode)
  const vertical = direction === 'vertical'

  const ids = new Set(agents.map((node) => node.id))
  const outgoing = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  ids.forEach((id) => {
    outgoing.set(id, [])
    indegree.set(id, 0)
  })
  diagram.edges.forEach((edge) => {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) return
    outgoing.get(edge.from)!.push(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  })

  const offset = start ? 1 : 0
  const layer = new Map<string, number>()
  const roots = agents.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  const queue = roots.length > 0 ? [...roots] : agents.slice(0, 1).map((node) => node.id)
  queue.forEach((id) => layer.set(id, offset))
  // Longest path, capped so cycles terminate.
  const maxLayer = offset + agents.length
  while (queue.length > 0) {
    const current = queue.shift()!
    const depth = layer.get(current) ?? offset
    for (const next of outgoing.get(current) ?? []) {
      const proposed = depth + 1
      const existing = layer.get(next)
      if (proposed <= maxLayer && (existing === undefined || proposed > existing)) {
        layer.set(next, proposed)
        queue.push(next)
      }
    }
  }
  agents.forEach((node) => {
    if (!layer.has(node.id)) layer.set(node.id, offset)
  })
  if (start) layer.set(start.id, 0)
  if (end) {
    const last = agents.reduce((max, node) => Math.max(max, layer.get(node.id) ?? 0), offset - 1)
    layer.set(end.id, last + 1)
  }

  const laidOut = [...(start ? [start] : []), ...agents, ...(end ? [end] : [])]
  const byLayer = new Map<number, DiagramNode[]>()
  laidOut.forEach((node) => {
    const depth = layer.get(node.id) ?? 0
    byLayer.set(depth, [...(byLayer.get(depth) ?? []), node])
  })

  const footprints = new Map(laidOut.map((node) => [node.id, nodeFootprint(diagram, node, direction)]))
  const mainSize = (fp: Footprint) => (vertical ? fp.height : fp.width)
  const crossSize = (fp: Footprint) => (vertical ? fp.width : fp.height)
  const crossOffset = (fp: Footprint) => (vertical ? fp.offsetX : fp.offsetY)
  const cardCross = (node: DiagramNode) => {
    const card = agentNodeSize(node)
    return vertical ? card.width : card.height
  }

  const positions = new Map<string, { x: number; y: number }>()
  let mainCursor = vertical ? ORIGIN_Y : ORIGIN_X

  ;[...byLayer.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([, layerNodes]) => {
      // Keep the current cross-axis order so a re-layout doesn't shuffle branches.
      const sorted = [...layerNodes].sort((a, b) => (vertical ? a.x - b.x : a.y - b.y))
      const layerMain = Math.max(...sorted.map((node) => mainSize(footprints.get(node.id)!)))
      const totalCross =
        sorted.reduce((sum, node) => sum + crossSize(footprints.get(node.id)!), 0) +
        Math.max(0, sorted.length - 1) * FLOW_CROSS_GAP[direction]

      // A lone node centers its card on the flow line so straight chains stay straight.
      let crossCursor =
        sorted.length === 1
          ? FLOW_CENTER - crossOffset(footprints.get(sorted[0].id)!) - cardCross(sorted[0]) / 2
          : FLOW_CENTER - totalCross / 2

      sorted.forEach((node) => {
        const fp = footprints.get(node.id)!
        const main = mainCursor + (layerMain - mainSize(fp)) / 2
        const point = vertical
          ? { x: crossCursor + fp.offsetX, y: main + fp.offsetY }
          : { x: main + fp.offsetX, y: crossCursor + fp.offsetY }
        positions.set(node.id, { x: Math.round(point.x), y: Math.round(point.y) })
        crossCursor += crossSize(fp) + FLOW_CROSS_GAP[direction]
      })

      mainCursor += layerMain + FLOW_MAIN_GAP[direction]
    })

  const positioned: Diagram = {
    ...diagram,
    direction,
    nodes: diagram.nodes.map((node) => {
      const point = positions.get(node.id)
      return point ? { ...node, ...point } : node
    }),
  }
  return syncMappedToolLayout(alignFlowEdges(positioned, direction))
}
