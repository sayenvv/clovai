import {
  bestPortSidesForConnection,
  createNodeId,
  DEFAULT_EDGE_ROUTING,
  getNodeSize,
  resolveNodeStyle,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { FlowchartGenerationPlan } from '@/types/flowchart-generation'

function nextEdgeId(index: number): string {
  return `edge-fc-${index + 1}-${Math.random().toString(36).slice(2, 6)}`
}

/** Layer nodes by BFS from roots for a readable top-to-bottom flowchart. */
function layoutFlowchartNodes(
  nodes: DiagramNode[],
  edges: Array<{ from: string; to: string }>,
  paletteById: Map<string, PaletteItem>,
): DiagramNode[] {
  const ids = new Set(nodes.map((node) => node.id))
  const outgoing = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  ids.forEach((id) => {
    outgoing.set(id, [])
    indegree.set(id, 0)
  })
  edges.forEach((edge) => {
    if (!ids.has(edge.from) || !ids.has(edge.to)) return
    outgoing.get(edge.from)!.push(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  })

  const roots = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  const start = roots.length > 0 ? roots : [nodes[0]?.id].filter(Boolean) as string[]
  const layer = new Map<string, number>()
  const queue = [...start]
  start.forEach((id) => layer.set(id, 0))

  while (queue.length > 0) {
    const current = queue.shift()!
    const depth = layer.get(current) ?? 0
    for (const next of outgoing.get(current) ?? []) {
      if (layer.has(next)) continue
      layer.set(next, depth + 1)
      queue.push(next)
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

  const gapX = 220
  const gapY = 140
  const positioned: DiagramNode[] = []
  ;[...byLayer.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([depth, layerNodes]) => {
      const widths = layerNodes.map((node) => {
        const item = paletteById.get(node.paletteId)
        const shape = item ? resolveNodeStyle(node, item).shape : 'process'
        return getNodeSize(node, shape).width
      })
      const totalWidth =
        widths.reduce((sum, width) => sum + width, 0) + Math.max(0, layerNodes.length - 1) * (gapX - 120)
      let cursor = Math.max(48, 400 - totalWidth / 2)
      layerNodes.forEach((node, index) => {
        const width = widths[index]
        positioned.push({
          ...node,
          x: Math.round(cursor),
          y: Math.round(48 + depth * gapY),
        })
        cursor += width + (gapX - 120)
      })
    })

  return positioned
}

/** Convert an LLM flowchart plan into a canvas-ready diagram. */
export function diagramFromFlowchartPlan(
  plan: FlowchartGenerationPlan,
  paletteById: Map<string, PaletteItem>,
): { diagram: Diagram; title: string } {
  const keyToId = new Map<string, string>()
  const fallbackPaletteId =
    [...paletteById.keys()].find((id) => id.startsWith('fc-process')) ??
    [...paletteById.keys()][0]

  let nodes: DiagramNode[] = plan.nodes.map((item) => {
    const paletteId = paletteById.has(item.paletteId)
      ? item.paletteId
      : fallbackPaletteId
    const paletteItem = paletteById.get(paletteId)
    const nodeId = createNodeId()
    keyToId.set(item.key, nodeId)
    const draft: DiagramNode = {
      id: nodeId,
      paletteId,
      label: item.label,
      x: 0,
      y: 0,
    }
    const shape = paletteItem ? resolveNodeStyle(draft, paletteItem).shape : 'process'
    const size = getNodeSize(draft, shape)
    return {
      ...draft,
      width: size.width,
      height: size.height,
    }
  })

  const edgePairs = plan.edges.flatMap((edge) => {
    const from = keyToId.get(edge.fromKey)
    const to = keyToId.get(edge.toKey)
    if (!from || !to) return []
    return [{ from, to, label: edge.label }]
  })

  nodes = layoutFlowchartNodes(
    nodes,
    edgePairs.map((edge) => ({ from: edge.from, to: edge.to })),
    paletteById,
  )

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const edges: DiagramEdge[] = edgePairs.flatMap((edge, index) => {
    const fromNode = nodesById.get(edge.from)
    const toNode = nodesById.get(edge.to)
    if (!fromNode || !toNode) return []
    const fromItem = paletteById.get(fromNode.paletteId)
    const toItem = paletteById.get(toNode.paletteId)
    if (!fromItem || !toItem) return []
    const fromShape = resolveNodeStyle(fromNode, fromItem).shape
    const toShape = resolveNodeStyle(toNode, toItem).shape
    const sides = bestPortSidesForConnection(fromNode, fromShape, toNode, toShape)
    return [
      {
        id: nextEdgeId(index),
        from: edge.from,
        to: edge.to,
        fromSide: sides.fromSide,
        toSide: sides.toSide,
        label: edge.label || undefined,
        routing: DEFAULT_EDGE_ROUTING,
      },
    ]
  })

  return {
    diagram: { nodes, edges },
    title: plan.title,
  }
}
