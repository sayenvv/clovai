import type { PaletteItem, PaletteShape } from '@/types/config'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

export interface DiagramNode {
  id: string
  /** References a PaletteItem id — resolves shape, color and defaults. */
  paletteId: string
  label: string
  x: number
  y: number
  /** Custom size set by resizing; falls back to the shape default. */
  width?: number
  height?: number
}

export interface DiagramEdge {
  id: string
  from: string
  to: string
  fromSide: PortSide
  toSide: PortSide
}

export interface Diagram {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export interface Viewport {
  x: number
  y: number
  scale: number
}

export const NODE_WIDTH = 168

export const SHAPE_HEIGHTS: Record<PaletteShape, number> = {
  terminator: 52,
  process: 56,
  decision: 96,
  'input-output': 56,
  database: 68,
  document: 60,
  connector: 48,
  note: 88,
  rectangle: 56,
  circle: 72,
  ellipse: 64,
  hexagon: 60,
  trapezoid: 56,
  triangle: 72,
  delay: 56,
  'off-page': 72,
  'manual-input': 60,
  text: 36,
}

export function nodeSize(shape: PaletteShape): { width: number; height: number } {
  if (shape === 'connector') return { width: 48, height: 48 }
  if (shape === 'circle') return { width: 72, height: 72 }
  if (shape === 'triangle') return { width: 96, height: SHAPE_HEIGHTS.triangle }
  if (shape === 'off-page') return { width: 96, height: SHAPE_HEIGHTS['off-page'] }
  return { width: NODE_WIDTH, height: SHAPE_HEIGHTS[shape] }
}

export const MIN_NODE_WIDTH = 48
export const MIN_NODE_HEIGHT = 32

/** Effective node size: custom (resized) dimensions or the shape default. */
export function getNodeSize(
  node: DiagramNode,
  shape: PaletteShape,
): { width: number; height: number } {
  const fallback = nodeSize(shape)
  return { width: node.width ?? fallback.width, height: node.height ?? fallback.height }
}

/** Outward normal for each side — used to shape edge curves. */
export const SIDE_DIRECTION: Record<PortSide, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

interface Anchor {
  x: number
  y: number
}

const DEFAULT_ANCHORS: Record<PortSide, Anchor> = {
  top: { x: 0.5, y: 0 },
  right: { x: 1, y: 0.5 },
  bottom: { x: 0.5, y: 1 },
  left: { x: 0, y: 0.5 },
}

/** Non-rectangular shapes don't touch their bounding box everywhere, so
 *  ports are pulled onto the actual outline (fractions of the box). */
const SHAPE_ANCHOR_OVERRIDES: Partial<Record<PaletteShape, Partial<Record<PortSide, Anchor>>>> = {
  triangle: { left: { x: 0.25, y: 0.5 }, right: { x: 0.75, y: 0.5 } },
  'manual-input': { top: { x: 0.5, y: 0.14 } },
  'off-page': { left: { x: 0, y: 0.31 }, right: { x: 1, y: 0.31 } },
  trapezoid: { top: { x: 0.5, y: 0 }, left: { x: 0.06, y: 0.5 }, right: { x: 0.94, y: 0.5 } },
}

export function portAnchor(shape: PaletteShape, side: PortSide): Anchor {
  return SHAPE_ANCHOR_OVERRIDES[shape]?.[side] ?? DEFAULT_ANCHORS[side]
}

export function portPoint(
  node: DiagramNode,
  shape: PaletteShape,
  side: PortSide,
): { x: number; y: number } {
  const { width, height } = getNodeSize(node, shape)
  const anchor = portAnchor(shape, side)
  return { x: node.x + width * anchor.x, y: node.y + height * anchor.y }
}

/** Picks the side of a node closest to a world-space point. */
export function nearestSide(
  node: DiagramNode,
  shape: PaletteShape,
  point: { x: number; y: number },
): PortSide {
  const { width, height } = getNodeSize(node, shape)
  const dx = (point.x - (node.x + width / 2)) / width
  const dy = (point.y - (node.y + height / 2)) / height
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'bottom' : 'top'
}

/** Palette used when a tool has no designer configuration yet. */
export const FALLBACK_PALETTE: PaletteItem[] = [
  { id: 'generic-box', label: 'Box', shape: 'rectangle', color: 'blue', group: 'Basic', order: 1 },
  { id: 'generic-ellipse', label: 'Ellipse', shape: 'ellipse', color: 'violet', group: 'Basic', order: 2 },
  { id: 'generic-circle', label: 'Circle', shape: 'circle', color: 'emerald', group: 'Basic', order: 3 },
  { id: 'generic-diamond', label: 'Diamond', shape: 'decision', color: 'amber', group: 'Basic', order: 4 },
  { id: 'generic-note', label: 'Note', shape: 'note', color: 'amber', group: 'Annotate', order: 5 },
  { id: 'generic-text', label: 'Text', shape: 'text', color: 'slate', group: 'Annotate', order: 6 },
]

export const DND_MIME = 'application/x-clovai-palette-item'
