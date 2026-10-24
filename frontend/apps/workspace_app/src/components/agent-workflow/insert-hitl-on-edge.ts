/**
 * Human approval is a Human Review step on the canvas, not a setting on a connector: the review
 * node owns the approval message, role and timeout, and the flow waits at it.
 */

import {
  createNodeId,
  flowPortSides,
  resolveFlowDirection,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import {
  defaultConnectorConfig,
  enrichAgentNode,
  flowNodeSize,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { drawnSize } from '@/components/agent-workflow/add-node-after'
import type { PaletteItem } from '@/types/config'

export const HITL_PALETTE_ID = 'aw-reviewer'

/** Space kept on either side of a step inserted on a connector, along the flow. */
const STEP_GAP = 72

function createEdgeId(prefix = 'edge'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function isReviewNode(node: DiagramNode | undefined): boolean {
  return Boolean(node && (node.paletteId === HITL_PALETTE_ID || node.agent?.agentType === 'human'))
}

/** `startId` and every node downstream of it (plus the tools mapped to those), stopping at `stopId`. */
function downstreamIds(diagram: Diagram, startId: string, stopId: string): Set<string> {
  const ids = new Set<string>([startId])
  const queue = [startId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const edge of diagram.edges) {
      if (edge.from !== id || edge.to === stopId || ids.has(edge.to)) continue
      ids.add(edge.to)
      queue.push(edge.to)
    }
  }
  for (const node of diagram.nodes) {
    if (node.mappedAgentId && ids.has(node.mappedAgentId)) ids.add(node.id)
  }
  return ids
}

/**
 * Insert `node` on a connector, splitting A → B into A → node → B. The node goes right after A
 * along the flow; B and everything after it move along to make room. Null when the connector
 * or either end is missing.
 */
export function insertNodeOnEdge(diagram: Diagram, edgeId: string, node: DiagramNode): Diagram | null {
  const edge = diagram.edges.find((candidate) => candidate.id === edgeId)
  if (!edge) return null
  const from = diagram.nodes.find((candidate) => candidate.id === edge.from)
  const to = diagram.nodes.find((candidate) => candidate.id === edge.to)
  if (!from || !to) return null

  const vertical = resolveFlowDirection(diagram.direction) === 'vertical'
  const size = drawnSize(node)
  const fromSize = drawnSize(from)
  const x = vertical ? from.x + fromSize.width / 2 - size.width / 2 : from.x + fromSize.width + STEP_GAP
  const y = vertical ? from.y + fromSize.height + STEP_GAP : from.y + fromSize.height / 2 - size.height / 2

  // Push B (and what follows it) along the flow when the new node doesn't fit in between.
  const stepEnd = (vertical ? y + size.height : x + size.width) + STEP_GAP
  const deficit = stepEnd - (vertical ? to.y : to.x)
  const shifted = deficit > 0 ? downstreamIds(diagram, to.id, from.id) : new Set<string>()
  const nodes = diagram.nodes.map((candidate) =>
    shifted.has(candidate.id)
      ? vertical
        ? { ...candidate, y: candidate.y + deficit }
        : { ...candidate, x: candidate.x + deficit }
      : candidate,
  )

  const sides = flowPortSides(diagram.direction)
  const inbound: DiagramEdge = {
    id: createEdgeId('step-in'),
    from: edge.from,
    to: node.id,
    ...sides,
    routing: edge.routing,
    label: edge.label,
    // A review step holds the approval; the connector only carries the handoff.
    connector: { ...(edge.connector ?? defaultConnectorConfig()), humanApproval: false },
  }
  const outbound: DiagramEdge = {
    id: createEdgeId('step-out'),
    from: node.id,
    to: edge.to,
    ...sides,
    routing: edge.routing,
    connector: defaultConnectorConfig(),
  }

  return {
    ...diagram,
    nodes: [...nodes, { ...node, x, y }],
    edges: [...diagram.edges.filter((candidate) => candidate.id !== edgeId), inbound, outbound],
  }
}

/** Insert a Human Review step on a connector; a connector already through one keeps it. */
export function insertHitlOnEdge(
  diagram: Diagram,
  edgeId: string,
  paletteItem: PaletteItem,
): { diagram: Diagram; nodeId: string } | null {
  const edge = diagram.edges.find((candidate) => candidate.id === edgeId)
  if (!edge) return null
  const from = diagram.nodes.find((node) => node.id === edge.from)
  const to = diagram.nodes.find((node) => node.id === edge.to)
  if (!from || !to) return null

  // Already wired through a review step: that step is the approval.
  if (isReviewNode(from) || isReviewNode(to)) {
    return { diagram, nodeId: isReviewNode(to) ? to.id : from.id }
  }

  const nodeId = createNodeId()
  const size = flowNodeSize({ id: nodeId, paletteId: HITL_PALETTE_ID, label: '', x: 0, y: 0 }, diagram.direction)
  const reviewNode: DiagramNode = enrichAgentNode(
    { id: nodeId, paletteId: HITL_PALETTE_ID, label: paletteItem.label || 'Human Review', x: 0, y: 0, ...size },
    paletteItem,
  )
  const next = insertNodeOnEdge(diagram, edgeId, reviewNode)
  return next ? { diagram: next, nodeId } : null
}

/**
 * Turn every connector that asks for approval on its own (older workflows, generated plans) into
 * a Human Review step on that connector.
 */
export function promoteConnectorApprovals(diagram: Diagram, paletteItem: PaletteItem): Diagram {
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]))
  const pending = diagram.edges
    .filter(
      (edge) =>
        edge.connector?.humanApproval &&
        !isReviewNode(nodesById.get(edge.from)) &&
        !isReviewNode(nodesById.get(edge.to)),
    )
    .map((edge) => edge.id)
  return pending.reduce((current, edgeId) => insertHitlOnEdge(current, edgeId, paletteItem)?.diagram ?? current, diagram)
}
