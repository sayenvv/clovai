/** Every main workflow begins at a Start node: added by default and wired to the entry agents. */

import {
  flowPortSides,
  getNodeSize,
  resolveFlowDirection,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import { isAgentNode } from '@/components/agent-workflow/tool-agent-mapping'
import { createFlowBoundaryNode, isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import { START_NODE_PALETTE_ID } from '@/components/agent-workflow/workflow-start'

/** Space between Start and the first agent along the flow. */
export const START_GAP = 96

/** Start's size as drawn (its shape has a minimum width, so this can exceed the stored size). */
export function startNodeSize(start: DiagramNode): { width: number; height: number } {
  return getNodeSize(start, 'terminator')
}

let edgeCounter = 0
function createEdgeId(): string {
  edgeCounter += 1
  return `edge-${Date.now().toString(36)}-start-${edgeCounter}`
}

/** A Start → node connector along the flow. */
export function startEdge(diagram: Diagram, startId: string, toId: string): DiagramEdge {
  return { id: createEdgeId(), from: startId, to: toId, ...flowPortSides(diagram.direction), routing: 'curved' }
}

/**
 * `diagram` with a Start node. When it has none, one is added before the entry agents (agents
 * no other agent leads to) and connected to each of them. An empty diagram gets Start alone.
 */
export function withStartNode(diagram: Diagram): Diagram {
  if (diagram.nodes.some(isStartFlowNode)) return diagram
  const vertical = resolveFlowDirection(diagram.direction) === 'vertical'
  const agents = diagram.nodes.filter(isAgentNode)
  const agentIds = new Set(agents.map((node) => node.id))
  const fed = new Set(diagram.edges.filter((edge) => agentIds.has(edge.from)).map((edge) => edge.to))
  const entries = agents.filter((node) => !fed.has(node.id))

  if (entries.length === 0) {
    return { ...diagram, nodes: [createFlowBoundaryNode(START_NODE_PALETTE_ID, 0, 0), ...diagram.nodes] }
  }

  const sizeOf = (node: DiagramNode) => ({ width: node.width ?? 240, height: node.height ?? 64 })
  const startSize = startNodeSize(createFlowBoundaryNode(START_NODE_PALETTE_ID, 0, 0))
  const start = (() => {
    if (vertical) {
      const top = Math.min(...entries.map((node) => node.y))
      const centers = entries.map((node) => node.x + sizeOf(node).width / 2)
      const centerX = (Math.min(...centers) + Math.max(...centers)) / 2
      return createFlowBoundaryNode(
        START_NODE_PALETTE_ID,
        centerX - startSize.width / 2,
        top - START_GAP - startSize.height,
      )
    }
    const left = Math.min(...entries.map((node) => node.x))
    const centers = entries.map((node) => node.y + sizeOf(node).height / 2)
    const centerY = (Math.min(...centers) + Math.max(...centers)) / 2
    return createFlowBoundaryNode(
      START_NODE_PALETTE_ID,
      left - START_GAP - startSize.width,
      centerY - startSize.height / 2,
    )
  })()

  return {
    ...diagram,
    nodes: [start, ...diagram.nodes],
    edges: [...diagram.edges, ...entries.map((entry) => startEdge(diagram, start.id, entry.id))],
  }
}

/**
 * Where the first agent goes so it sits right after Start along the flow, and the Start →
 * agent connector. Null when Start is missing, already leads somewhere, or agents exist.
 */
export function placeAfterStart(
  diagram: Diagram,
  size: { width: number; height: number },
): { x: number; y: number; startId: string } | null {
  const start = diagram.nodes.find(isStartFlowNode)
  if (!start) return null
  if (diagram.nodes.some(isAgentNode)) return null
  if (diagram.edges.some((edge) => edge.from === start.id)) return null
  const { width: startWidth, height: startHeight } = startNodeSize(start)
  if (resolveFlowDirection(diagram.direction) === 'vertical') {
    return {
      x: start.x + startWidth / 2 - size.width / 2,
      y: start.y + startHeight + START_GAP,
      startId: start.id,
    }
  }
  return { x: start.x + startWidth + START_GAP, y: start.y + startHeight / 2 - size.height / 2, startId: start.id }
}
