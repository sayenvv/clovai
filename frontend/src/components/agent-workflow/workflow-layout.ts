import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
} from '@/components/agent-workflow/agent-workflow-defaults'
import type { DiagramNode } from '@/components/designer/diagram-types'

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
