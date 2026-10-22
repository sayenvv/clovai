import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'

export const START_NODE_PALETTE_ID = 'aw-start'

const TRIGGER_PALETTE_IDS = new Set([START_NODE_PALETTE_ID, 'aw-event', 'aw-schedule'])

export function isTriggerNode(node: DiagramNode): boolean {
  return TRIGGER_PALETTE_IDS.has(node.paletteId ?? '')
}

export function findStartNode(diagram: Diagram): DiagramNode | undefined {
  return diagram.nodes.find((node) => node.paletteId === START_NODE_PALETTE_ID)
}

/** Agent id the Start node connects to, when wired on the canvas. */
export function resolveStartAgentId(diagram: Diagram): string | null {
  const start = findStartNode(diagram)
  if (!start) return null
  const edge = diagram.edges.find((item) => item.from === start.id)
  return edge?.to ?? null
}
