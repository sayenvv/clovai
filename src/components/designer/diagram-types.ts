import type { PaletteColor, PaletteItem, PaletteShape } from '@/types/config'

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
  /** Per-node style overrides set from the properties panel. */
  shape?: PaletteShape
  color?: PaletteColor
}

/** Effective shape/color for a node: its own overrides win over the
 *  palette item it was created from. */
export function resolveNodeStyle(
  node: DiagramNode,
  item: PaletteItem,
): { shape: PaletteShape; color: PaletteColor } {
  return { shape: node.shape ?? item.shape, color: node.color ?? item.color }
}

export const COLOR_OPTIONS: PaletteColor[] = [
  'emerald',
  'blue',
  'amber',
  'violet',
  'cyan',
  'rose',
  'slate',
]

export const SHAPE_OPTIONS: Array<{ value: PaletteShape; label: string }> = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'process', label: 'Process' },
  { value: 'terminator', label: 'Terminator (Start/End)' },
  { value: 'decision', label: 'Decision (Diamond)' },
  { value: 'input-output', label: 'Input / Output' },
  { value: 'database', label: 'Database' },
  { value: 'document', label: 'Document' },
  { value: 'connector', label: 'Connector' },
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'hexagon', label: 'Hexagon (Preparation)' },
  { value: 'trapezoid', label: 'Trapezoid (Manual op.)' },
  { value: 'triangle', label: 'Triangle (Merge)' },
  { value: 'delay', label: 'Delay' },
  { value: 'off-page', label: 'Off-page reference' },
  { value: 'manual-input', label: 'Manual input' },
  { value: 'note', label: 'Sticky note' },
  { value: 'text', label: 'Text label' },
  { value: 'swimlane-pool', label: 'Swimlane pool' },
  { value: 'swimlane-lane', label: 'Horizontal lane' },
  { value: 'swimlane-vertical', label: 'Vertical lane' },
  { value: 'subprocess', label: 'Subprocess' },
  { value: 'parallel-gateway', label: 'Parallel gateway (+)' },
  { value: 'or-gate', label: 'Or gateway (○+)' },
  { value: 'event', label: 'Event' },
  { value: 'data-store', label: 'Data store' },
  { value: 'display', label: 'Display / output' },
  { value: 'annotation', label: 'Annotation' },
  { value: 'multi-document', label: 'Multi-document' },
  { value: 'card', label: 'Card' },
  { value: 'internal-storage', label: 'Internal storage' },
]

export type EdgeRouting = 'curved' | 'orthogonal'

export interface DiagramEdge {
  id: string
  from: string
  to: string
  fromSide: PortSide
  toSide: PortSide
  /** How the connector is drawn; defaults to a smooth curve. */
  routing?: EdgeRouting
  /** Optional label shown on the connector line (e.g. "Yes", "No"). */
  label?: string
}

export interface Diagram {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

export interface DiagramPage {
  id: string
  name: string
  diagram: Diagram
}

/** A tool draft: multiple pages, one active at a time (like sheet tabs). */
export interface DiagramDocument {
  pages: DiagramPage[]
  activePageId: string
}

/* ---- stored/legacy formats + normalization ---- */

type StoredEdge = Omit<DiagramEdge, 'fromSide' | 'toSide'> & Partial<DiagramEdge>

export interface StoredDiagram {
  nodes?: DiagramNode[]
  edges?: StoredEdge[]
}

interface StoredPage {
  id?: string
  name?: string
  diagram?: StoredDiagram
}

interface StoredDocument {
  pages?: StoredPage[]
  activePageId?: string
}

/** Migrates diagrams saved before edges carried port sides. */
export function normalizeDiagram(parsed: StoredDiagram): Diagram {
  const edges: DiagramEdge[] = (parsed.edges ?? []).map((edge) => ({
    ...edge,
    fromSide: edge.fromSide ?? 'right',
    toSide: edge.toSide ?? 'left',
    routing: edge.routing ?? 'curved',
  }))
  return { nodes: parsed.nodes ?? [], edges }
}

let pageCounter = 0

export function createNodeId(): string {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function createPage(name: string): DiagramPage {
  return {
    id: `page-${Date.now().toString(36)}-${pageCounter++}`,
    name,
    diagram: { nodes: [], edges: [] },
  }
}

/** Accepts the current multi-page document format, a legacy single-diagram
 *  draft, or anything malformed — always returns a valid document. */
export function normalizeDocument(parsed: unknown): DiagramDocument {
  if (parsed && typeof parsed === 'object') {
    const asDocument = parsed as StoredDocument
    if (Array.isArray(asDocument.pages) && asDocument.pages.length > 0) {
      const pages: DiagramPage[] = asDocument.pages.map((page, index) => ({
        id: page.id ?? `page-migrated-${index}`,
        name: page.name ?? `Page ${index + 1}`,
        diagram: normalizeDiagram(page.diagram ?? {}),
      }))
      const activePageId = pages.some((page) => page.id === asDocument.activePageId)
        ? (asDocument.activePageId as string)
        : pages[0].id
      return { pages, activePageId }
    }
    // Legacy format: a bare diagram.
    if (Array.isArray((parsed as StoredDiagram).nodes)) {
      const page: DiagramPage = {
        id: 'page-migrated-0',
        name: 'Page 1',
        diagram: normalizeDiagram(parsed as StoredDiagram),
      }
      return { pages: [page], activePageId: page.id }
    }
  }
  const page = createPage('Page 1')
  return { pages: [page], activePageId: page.id }
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
  'swimlane-pool': 320,
  'swimlane-lane': 80,
  'swimlane-vertical': 320,
  subprocess: 56,
  'parallel-gateway': 72,
  'or-gate': 56,
  event: 48,
  'data-store': 56,
  display: 56,
  annotation: 48,
  'multi-document': 64,
  card: 56,
  'internal-storage': 56,
}

export function nodeSize(shape: PaletteShape): { width: number; height: number } {
  if (shape === 'connector') return { width: 48, height: 48 }
  if (shape === 'circle') return { width: 72, height: 72 }
  if (shape === 'triangle') return { width: 96, height: SHAPE_HEIGHTS.triangle }
  if (shape === 'off-page') return { width: 96, height: SHAPE_HEIGHTS['off-page'] }
  if (shape === 'swimlane-pool') return { width: 520, height: SHAPE_HEIGHTS['swimlane-pool'] }
  if (shape === 'swimlane-lane') return { width: 520, height: SHAPE_HEIGHTS['swimlane-lane'] }
  if (shape === 'swimlane-vertical') return { width: 140, height: SHAPE_HEIGHTS['swimlane-vertical'] }
  if (shape === 'parallel-gateway') return { width: 72, height: 72 }
  if (shape === 'or-gate' || shape === 'event') return { width: 56, height: 56 }
  if (shape === 'annotation') return { width: 120, height: SHAPE_HEIGHTS.annotation }
  return { width: NODE_WIDTH, height: SHAPE_HEIGHTS[shape] }
}

export const MIN_NODE_WIDTH = 48
export const MIN_NODE_HEIGHT = 32

/** Controls whether resize keeps a shape's proportions. */
export type ResizeAspect = 'free' | 'square' | 'preserve'

const SQUARE_ASPECT_SHAPES = new Set<PaletteShape>([
  'circle',
  'connector',
  'or-gate',
  'event',
  'parallel-gateway',
  'decision',
])

const PRESERVE_ASPECT_SHAPES = new Set<PaletteShape>([
  'terminator',
  'ellipse',
  'triangle',
  'off-page',
  'hexagon',
])

export function resizeAspect(shape: PaletteShape): ResizeAspect {
  if (SQUARE_ASPECT_SHAPES.has(shape)) return 'square'
  if (PRESERVE_ASPECT_SHAPES.has(shape)) return 'preserve'
  return 'free'
}

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

const ORTHOGONAL_STUB = 24

function isHorizontalSide(side: PortSide): boolean {
  return side === 'left' || side === 'right'
}

function stubPoint(
  point: { x: number; y: number },
  side: PortSide,
  distance: number,
): { x: number; y: number } {
  const direction = SIDE_DIRECTION[side]
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance }
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function cubicBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t
  const tt = t * t
  const uu = u * u
  const uuu = uu * u
  const ttt = tt * t
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  }
}

/** Point halfway along a polyline by arc length — lands on an actual segment. */
function polylineMidpoint(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]

  let total = 0
  const lengths: number[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y,
    )
    lengths.push(length)
    total += length
  }

  if (total === 0) return points[0]
  const target = total / 2
  let traveled = 0

  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index]
    if (traveled + segmentLength >= target) {
      const ratio = segmentLength === 0 ? 0 : (target - traveled) / segmentLength
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
      }
    }
    traveled += segmentLength
  }

  return points[points.length - 1]
}

function orthogonalEdgePoints(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  stub = ORTHOGONAL_STUB,
): Array<{ x: number; y: number }> {
  const exit = stubPoint(from, fromSide, stub)
  const entry = stubPoint(to, toSide, stub)
  const points: Array<{ x: number; y: number }> = [from, exit]

  const fromHorizontal = isHorizontalSide(fromSide)
  const toHorizontal = isHorizontalSide(toSide)

  if (fromHorizontal && toHorizontal) {
    const midX = (exit.x + entry.x) / 2
    points.push({ x: midX, y: exit.y }, { x: midX, y: entry.y })
  } else if (!fromHorizontal && !toHorizontal) {
    const midY = (exit.y + entry.y) / 2
    points.push({ x: exit.x, y: midY }, { x: entry.x, y: midY })
  } else if (fromHorizontal) {
    points.push({ x: entry.x, y: exit.y })
  } else {
    points.push({ x: exit.x, y: entry.y })
  }

  points.push(entry, to)
  return points
}

/** Smooth Bézier connector (default). */
export function curvedEdgePath(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
): string {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const bend = Math.min(140, Math.max(36, distance / 2))
  const d1 = SIDE_DIRECTION[fromSide]
  const d2 = SIDE_DIRECTION[toSide]
  const c1 = { x: from.x + d1.x * bend, y: from.y + d1.y * bend }
  const c2 = { x: to.x + d2.x * bend, y: to.y + d2.y * bend }
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`
}

/** Orthogonal connector — straight segments with 90° corners only. */
export function orthogonalEdgePath(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  stub = ORTHOGONAL_STUB,
): string {
  return pointsToPath(orthogonalEdgePoints(from, fromSide, to, toSide, stub))
}

export function buildEdgePath(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  routing: EdgeRouting = 'curved',
): string {
  return routing === 'orthogonal'
    ? orthogonalEdgePath(from, fromSide, to, toSide)
    : curvedEdgePath(from, fromSide, to, toSide)
}

/** Point on the connector path where labels should sit (mid-path, on the line). */
export function edgeLabelPosition(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  routing: EdgeRouting = 'curved',
): { x: number; y: number } {
  if (routing === 'orthogonal') {
    return polylineMidpoint(orthogonalEdgePoints(from, fromSide, to, toSide))
  }

  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const bend = Math.min(140, Math.max(36, distance / 2))
  const d1 = SIDE_DIRECTION[fromSide]
  const d2 = SIDE_DIRECTION[toSide]
  const c1 = { x: from.x + d1.x * bend, y: from.y + d1.y * bend }
  const c2 = { x: to.x + d2.x * bend, y: to.y + d2.y * bend }
  return cubicBezierPoint(from, c1, c2, to, 0.5)
}

/** @deprecated Use edgeLabelPosition — kept as alias for callers. */
export function edgeMidpoint(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  routing: EdgeRouting = 'curved',
): { x: number; y: number } {
  return edgeLabelPosition(from, fromSide, to, toSide, routing)
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
