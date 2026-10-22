import {
  createNodeId,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type PortSide,
} from '@/components/designer/diagram-types'
import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
  defaultConnectorConfig,
  enrichAgentNode,
} from '@/components/agent-workflow/agent-workflow-defaults'
import type { PaletteItem } from '@/types/config'

export const HITL_PALETTE_ID = 'aw-reviewer'

function createEdgeId(prefix = 'edge'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Insert a Human Review (HITL) node on an existing connector,
 * splitting A → B into A → Review → B with approval on the inbound edge.
 */
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

  // Already wired through a reviewer — just ensure approval is enabled.
  if (from.paletteId === HITL_PALETTE_ID || to.paletteId === HITL_PALETTE_ID) {
    const nodes = diagram.nodes
    const edges = diagram.edges.map((candidate) => {
      if (candidate.id !== edgeId) return candidate
      return {
        ...candidate,
        label: candidate.label?.trim() ? candidate.label : 'Approve',
        connector: {
          ...(candidate.connector ?? defaultConnectorConfig()),
          humanApproval: true,
        },
      }
    })
    return {
      diagram: { ...diagram, nodes, edges },
      nodeId: from.paletteId === HITL_PALETTE_ID ? from.id : to.id,
    }
  }

  const fromSize = {
    width: from.width ?? AGENT_NODE_WIDTH,
    height: from.height ?? AGENT_NODE_HEIGHT,
  }
  const toSize = {
    width: to.width ?? AGENT_NODE_WIDTH,
    height: to.height ?? AGENT_NODE_HEIGHT,
  }
  const midX = (from.x + fromSize.width / 2 + to.x + toSize.width / 2) / 2
  const midY = (from.y + fromSize.height / 2 + to.y + toSize.height / 2) / 2

  const nodeId = createNodeId()
  const hitlNode: DiagramNode = enrichAgentNode(
    {
      id: nodeId,
      paletteId: HITL_PALETTE_ID,
      label: paletteItem.label || 'Human Review',
      x: midX - AGENT_NODE_WIDTH / 2,
      y: midY - AGENT_NODE_HEIGHT / 2,
      width: AGENT_NODE_WIDTH,
      height: AGENT_NODE_HEIGHT,
    },
    paletteItem,
  )

  const inbound: DiagramEdge = {
    id: createEdgeId('hitl-in'),
    from: edge.from,
    to: nodeId,
    fromSide: edge.fromSide,
    toSide: 'left' as PortSide,
    routing: edge.routing,
    label: edge.label?.trim() ? edge.label : 'Approve',
    connector: {
      ...(edge.connector ?? defaultConnectorConfig()),
      humanApproval: true,
      approvalMessage:
        edge.connector?.approvalMessage?.trim() ||
        'Please review and approve this step to continue.',
      approvalRole: edge.connector?.approvalRole?.trim() || 'reviewer',
    },
  }

  const outbound: DiagramEdge = {
    id: createEdgeId('hitl-out'),
    from: nodeId,
    to: edge.to,
    fromSide: 'right' as PortSide,
    toSide: edge.toSide,
    routing: edge.routing,
    connector: defaultConnectorConfig(),
  }

  return {
    diagram: {
      ...diagram,
      nodes: [...diagram.nodes, hitlNode],
      edges: [...diagram.edges.filter((candidate) => candidate.id !== edgeId), inbound, outbound],
    },
    nodeId,
  }
}
