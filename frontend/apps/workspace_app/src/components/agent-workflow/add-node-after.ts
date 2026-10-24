/** Adds a node right after another along the flow, connected from it (the output port's "+"). */

import {
  flowPortSides,
  getNodeSize,
  resolveFlowDirection,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import { isFlowBoundaryNode } from '@/components/agent-workflow/workflow-flow-nodes'
import { START_GAP } from '@/components/agent-workflow/workflow-start-node'

/** Space between stacked siblings when the spot right after the source is taken. */
const SIBLING_GAP = 32

/** A node's size as drawn (Start/End have a minimum width, so this can exceed the stored size). */
export function drawnSize(node: DiagramNode): { width: number; height: number } {
  if (isFlowBoundaryNode(node)) return getNodeSize(node, 'terminator')
  return { width: node.width ?? 240, height: node.height ?? 64 }
}

function overlaps(diagram: Diagram, x: number, y: number, size: { width: number; height: number }): boolean {
  return diagram.nodes.some((other) => {
    const { width, height } = drawnSize(other)
    return x < other.x + width && x + size.width > other.x && y < other.y + height && y + size.height > other.y
  })
}

let edgeCounter = 0
function createEdgeId(): string {
  edgeCounter += 1
  return `edge-${Date.now().toString(36)}-after-${edgeCounter}`
}

/**
 * `diagram` with `node` placed after `sourceId` along the flow and a connector from the source
 * to it. When that spot is taken (the source already branches), the node steps sideways,
 * alternating below and above, until it finds a free one.
 */
export function addNodeAfter(diagram: Diagram, sourceId: string, node: DiagramNode): Diagram {
  const source = diagram.nodes.find((candidate) => candidate.id === sourceId)
  if (!source) return { ...diagram, nodes: [...diagram.nodes, node] }
  const vertical = resolveFlowDirection(diagram.direction) === 'vertical'
  const sourceSize = drawnSize(source)
  const size = drawnSize(node)

  const baseX = vertical ? source.x + sourceSize.width / 2 - size.width / 2 : source.x + sourceSize.width + START_GAP
  const baseY = vertical ? source.y + sourceSize.height + START_GAP : source.y + sourceSize.height / 2 - size.height / 2
  const step = (vertical ? size.width : size.height) + SIBLING_GAP

  let x = baseX
  let y = baseY
  for (let attempt = 1; attempt <= 12 && overlaps(diagram, x, y, size); attempt += 1) {
    const shift = Math.ceil(attempt / 2) * step * (attempt % 2 === 1 ? 1 : -1)
    x = vertical ? baseX + shift : baseX
    y = vertical ? baseY : baseY + shift
  }

  const placed = { ...node, x, y }
  const edge: DiagramEdge = {
    id: createEdgeId(),
    from: source.id,
    to: placed.id,
    ...flowPortSides(diagram.direction),
    routing: 'curved',
  }
  return { ...diagram, nodes: [...diagram.nodes, placed], edges: [...diagram.edges, edge] }
}
