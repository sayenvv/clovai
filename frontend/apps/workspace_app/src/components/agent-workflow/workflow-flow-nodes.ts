import {
  createNodeId,
  type Diagram,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import { START_NODE_PALETTE_ID } from '@/components/agent-workflow/workflow-start'

export const END_NODE_PALETTE_ID = 'aw-end'

export const FLOW_BOUNDARY_PALETTE_IDS = new Set([
  START_NODE_PALETTE_ID,
  END_NODE_PALETTE_ID,
])

/** Square icon tile, same height as the 240×64 agent cards so ports line up. */
export const FLOW_BOUNDARY_WIDTH = 64
export const FLOW_BOUNDARY_HEIGHT = 64

export function isFlowBoundaryNode(node: DiagramNode): boolean {
  return FLOW_BOUNDARY_PALETTE_IDS.has(node.paletteId ?? '')
}

export function isStartFlowNode(node: DiagramNode): boolean {
  return node.paletteId === START_NODE_PALETTE_ID
}

export function isEndFlowNode(node: DiagramNode): boolean {
  return node.paletteId === END_NODE_PALETTE_ID
}

export function canConnectFromFlowNode(node: DiagramNode, agentMode: boolean): boolean {
  if (!agentMode) return true
  return !isEndFlowNode(node)
}

export function canConnectToFlowNode(node: DiagramNode, agentMode: boolean): boolean {
  if (!agentMode) return true
  return !isStartFlowNode(node)
}

export function findEndNode(diagram: Diagram): DiagramNode | undefined {
  return diagram.nodes.find((node) => node.paletteId === END_NODE_PALETTE_ID)
}

export function createFlowBoundaryNode(
  paletteId: string,
  x: number,
  y: number,
  label?: string,
): DiagramNode {
  const defaultLabel = paletteId === START_NODE_PALETTE_ID ? 'Start' : 'End'
  return {
    id: createNodeId(),
    paletteId,
    label: label ?? defaultLabel,
    x,
    y,
    width: FLOW_BOUNDARY_WIDTH,
    height: FLOW_BOUNDARY_HEIGHT,
    shape: 'terminator',
  }
}

export function enrichFlowBoundaryNode(node: DiagramNode): DiagramNode {
  if (!isFlowBoundaryNode(node)) return node
  const { agent: _agent, fillColor: _fill, borderColor: _border, ...rest } = node
  // Fixed size — earlier pill-shaped terminators are migrated to the icon tile.
  return {
    ...rest,
    width: FLOW_BOUNDARY_WIDTH,
    height: FLOW_BOUNDARY_HEIGHT,
    shape: 'terminator',
  }
}
