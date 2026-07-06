import type { PaletteColor, PaletteItem, PaletteShape } from '@/types/config'
import type { DiagramColorOverrides } from './diagram-colors'
import type { AgentNodeConfig, AgentWorkflowMeta, ConnectorConfig } from '@/types/agent-workflow'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

export const PORT_SIDES: PortSide[] = ['top', 'right', 'bottom', 'left']

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
  /** Custom fill (background) — hex color. */
  fillColor?: string
  /** Custom border — hex color. */
  borderColor?: string
  /** @deprecated Legacy palette token; ignored when fill/border are set. */
  color?: PaletteColor
  /** Agent workflow configuration (agent-workflow tool only). */
  agent?: AgentNodeConfig
  /** Tool nodes only — the agent this tool is mapped under. */
  mappedAgentId?: string
  /** Sub-workflow agent — references a page in the same document. */
  subWorkflowPageId?: string
}

/** Effective shape for a node; colors resolved at render time via resolveNodeColors. */
export function resolveNodeStyle(
  node: DiagramNode,
  item: PaletteItem,
): { shape: PaletteShape; colorOverrides: DiagramColorOverrides } {
  return {
    shape: node.shape ?? item.shape,
    colorOverrides: { fillColor: node.fillColor, borderColor: node.borderColor },
  }
}

export const DEFAULT_SHAPE_COLOR: PaletteColor = 'slate'

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
  /** Label / chip background — hex color. */
  fillColor?: string
  /** Connector stroke — hex color. */
  borderColor?: string
  /** Agent workflow connector configuration. */
  connector?: ConnectorConfig
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
  /** Agent workflow metadata (agent-workflow tool only). */
  workflow?: AgentWorkflowMeta
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
  workflow?: AgentWorkflowMeta
}

/** Migrates diagrams saved before edges carried port sides. */
export function normalizeDiagram(parsed: StoredDiagram): Diagram {
  const edges: DiagramEdge[] = (parsed.edges ?? []).map((edge) => ({
    ...edge,
    fromSide: edge.fromSide ?? 'right',
    toSide: edge.toSide ?? 'left',
    routing: edge.routing ?? 'orthogonal',
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
      return { pages, activePageId, workflow: asDocument.workflow }
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

const CONNECTOR_STUB = 20
const CHANNEL_PAD = 20
const CORNER_RADIUS = 10
const TURN_PENALTY = 18
/** @deprecated Used only for legacy references; routing uses CONNECTOR_STUB. */
export const EDGE_PORT_INSET = CONNECTOR_STUB
const ROUTE_PAD = 6

type RoutePoint = { x: number; y: number }

/** Axis-aligned node bounds used to keep connectors out of shapes. */
export interface RouteObstacle {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

export interface EdgeRouteContext {
  obstacles: RouteObstacle[]
  fromNodeId: string
  toNodeId: string
}

export function nodeRouteObstacle(
  node: DiagramNode,
  shape: PaletteShape,
  padding = ROUTE_PAD,
): RouteObstacle {
  const { width, height } = getNodeSize(node, shape)
  return {
    id: node.id,
    left: node.x - padding,
    top: node.y - padding,
    right: node.x + width + padding,
    bottom: node.y + height + padding,
  }
}

const ELLIPSE_PORT_SHAPES = new Set<PaletteShape>([
  'ellipse',
  'circle',
  'terminator',
  'connector',
  'or-gate',
  'event',
])

function segmentLength(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function stubPoint(
  point: { x: number; y: number },
  side: PortSide,
  distance: number,
): { x: number; y: number } {
  const direction = SIDE_DIRECTION[side]
  return { x: point.x + direction.x * distance, y: point.y + direction.y * distance }
}

function simplifyPolyline(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length <= 1) return points
  const result = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    const previous = result[result.length - 1]
    const current = points[index]
    if (segmentLength(previous, current) < 0.5) continue
    result.push(current)
  }
  return result
}

function segmentIntersectsObstacle(
  a: RoutePoint,
  b: RoutePoint,
  obstacle: RouteObstacle,
): boolean {
  const xMin = Math.min(a.x, b.x)
  const xMax = Math.max(a.x, b.x)
  const yMin = Math.min(a.y, b.y)
  const yMax = Math.max(a.y, b.y)

  if (Math.abs(a.x - b.x) < 0.01) {
    const x = a.x
    return x >= obstacle.left && x <= obstacle.right && yMax >= obstacle.top && yMin <= obstacle.bottom
  }

  if (Math.abs(a.y - b.y) < 0.01) {
    const y = a.y
    return y >= obstacle.top && y <= obstacle.bottom && xMax >= obstacle.left && xMin <= obstacle.right
  }

  return false
}

function polylineHitsObstacles(points: RoutePoint[], obstacles: RouteObstacle[]): boolean {
  if (points.length < 2) return false
  for (let index = 0; index < points.length - 1; index += 1) {
    for (const obstacle of obstacles) {
      if (segmentIntersectsObstacle(points[index], points[index + 1], obstacle)) {
        return true
      }
    }
  }
  return false
}

function pathCost(points: RoutePoint[]): number {
  let length = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    length += segmentLength(points[index], points[index + 1])
  }
  return length + Math.max(0, points.length - 2) * TURN_PENALTY
}

function pointKey(point: RoutePoint): string {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
}

function pointInsideObstacle(point: RoutePoint, obstacles: RouteObstacle[]): boolean {
  return obstacles.some(
    (obstacle) =>
      point.x > obstacle.left &&
      point.x < obstacle.right &&
      point.y > obstacle.top &&
      point.y < obstacle.bottom,
  )
}

function collectAxisValues(
  seeds: number[],
  obstacles: RouteObstacle[],
  axis: 'x' | 'y',
): number[] {
  const values = new Set<number>(seeds)
  for (const obstacle of obstacles) {
    if (axis === 'x') {
      values.add(obstacle.left - CHANNEL_PAD)
      values.add(obstacle.right + CHANNEL_PAD)
      values.add((obstacle.left + obstacle.right) / 2)
    } else {
      values.add(obstacle.top - CHANNEL_PAD)
      values.add(obstacle.bottom + CHANNEL_PAD)
      values.add((obstacle.top + obstacle.bottom) / 2)
    }
  }
  return [...values].sort((a, b) => a - b)
}

function axisIndex(values: number[], target: number): number {
  const exact = values.findIndex((value) => Math.abs(value - target) < 0.01)
  return exact >= 0 ? exact : 0
}

function segmentBlocked(
  a: RoutePoint,
  b: RoutePoint,
  obstacles: RouteObstacle[],
): boolean {
  return polylineHitsObstacles([a, b], obstacles)
}

function fallbackChannel(fromStub: RoutePoint, toStub: RoutePoint): RoutePoint[] {
  const elbowA = { x: toStub.x, y: fromStub.y }
  const elbowB = { x: fromStub.x, y: toStub.y }
  const pathA = [fromStub, elbowA, toStub]
  const pathB = [fromStub, elbowB, toStub]
  return pathCost(pathA) <= pathCost(pathB) ? pathA : pathB
}

/** Visio-style orthogonal grid routing between port stubs. */
function orthogonalGridRoute(
  fromStub: RoutePoint,
  toStub: RoutePoint,
  blockers: RouteObstacle[],
  channelHints: RouteObstacle[],
): RoutePoint[] {
  if (Math.abs(fromStub.x - toStub.x) < 0.01 && Math.abs(fromStub.y - toStub.y) < 0.01) {
    return [fromStub, toStub]
  }

  const xs = collectAxisValues([fromStub.x, toStub.x], channelHints, 'x')
  const ys = collectAxisValues([fromStub.y, toStub.y], channelHints, 'y')
  const valid: boolean[][] = []
  const grid: RoutePoint[][] = []
  const pointsByKey = new Map<string, RoutePoint>()

  for (let row = 0; row < ys.length; row += 1) {
    valid[row] = []
    grid[row] = []
    for (let column = 0; column < xs.length; column += 1) {
      const point = { x: xs[column], y: ys[row] }
      grid[row][column] = point
      const isStub =
        (Math.abs(point.x - fromStub.x) < 0.01 && Math.abs(point.y - fromStub.y) < 0.01) ||
        (Math.abs(point.x - toStub.x) < 0.01 && Math.abs(point.y - toStub.y) < 0.01)
      valid[row][column] = isStub || !pointInsideObstacle(point, blockers)
      if (valid[row][column]) pointsByKey.set(pointKey(point), point)
    }
  }

  pointsByKey.set(pointKey(fromStub), fromStub)
  pointsByKey.set(pointKey(toStub), toStub)

  const startKey = pointKey(fromStub)
  const goalKey = pointKey(toStub)
  const open = new Set<string>([startKey])
  const gScore = new Map<string, number>([[startKey, 0]])
  const fScore = new Map<string, number>([[startKey, segmentLength(fromStub, toStub)]])
  const cameFrom = new Map<string, string>()
  const moveDir = new Map<string, 'h' | 'v'>()

  while (open.size > 0) {
    let currentKey = startKey
    let lowest = Number.POSITIVE_INFINITY
    for (const key of open) {
      const score = fScore.get(key) ?? Number.POSITIVE_INFINITY
      if (score < lowest) {
        lowest = score
        currentKey = key
      }
    }

    if (currentKey === goalKey) {
      const path: RoutePoint[] = []
      let walk: string | undefined = goalKey
      while (walk) {
        path.unshift(pointsByKey.get(walk)!)
        walk = cameFrom.get(walk)
      }
      return simplifyPolyline(path)
    }

    open.delete(currentKey)
    const current = pointsByKey.get(currentKey)!
    const column = axisIndex(xs, current.x)
    const row = axisIndex(ys, current.y)

    const neighbors: Array<{ point: RoutePoint; dir: 'h' | 'v' }> = []
    if (column > 0 && valid[row][column - 1]) {
      neighbors.push({ point: grid[row][column - 1], dir: 'h' })
    }
    if (column < xs.length - 1 && valid[row][column + 1]) {
      neighbors.push({ point: grid[row][column + 1], dir: 'h' })
    }
    if (row > 0 && valid[row - 1][column]) {
      neighbors.push({ point: grid[row - 1][column], dir: 'v' })
    }
    if (row < ys.length - 1 && valid[row + 1][column]) {
      neighbors.push({ point: grid[row + 1][column], dir: 'v' })
    }

    for (const { point, dir } of neighbors) {
      if (segmentBlocked(current, point, blockers)) continue
      const neighborKey = pointKey(point)
      const turn =
        moveDir.has(currentKey) && moveDir.get(currentKey) !== dir ? TURN_PENALTY : 0
      const tentative = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + segmentLength(current, point) + turn

      if (tentative < (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(neighborKey, currentKey)
        moveDir.set(neighborKey, dir)
        gScore.set(neighborKey, tentative)
        fScore.set(neighborKey, tentative + segmentLength(point, toStub))
        open.add(neighborKey)
      }
    }
  }

  const fallback = fallbackChannel(fromStub, toStub)
  if (!polylineHitsObstacles(fallback, blockers)) return simplifyPolyline(fallback)
  return simplifyPolyline([fromStub, toStub])
}

function pickBestChannel(
  fromPort: RoutePoint,
  fromStub: RoutePoint,
  toStub: RoutePoint,
  toPort: RoutePoint,
  blockers: RouteObstacle[],
  channelHints: RouteObstacle[],
): RoutePoint[] {
  const channel = orthogonalGridRoute(fromStub, toStub, blockers, channelHints)
  return simplifyPolyline([fromPort, ...channel, toPort])
}

/** Orthogonal path points — Visio-style grid routing with dynamic bends. */
function orthogonalEdgePoints(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  context?: EdgeRouteContext,
): Array<{ x: number; y: number }> {
  const fromStub = stubPoint(from, fromSide, CONNECTOR_STUB)
  const toStub = stubPoint(to, toSide, CONNECTOR_STUB)
  const allObstacles = context?.obstacles ?? []
  const blockers = allObstacles.filter(
    (obstacle) =>
      obstacle.id !== context?.fromNodeId && obstacle.id !== context?.toNodeId,
  )
  return pickBestChannel(from, fromStub, toStub, to, blockers, allObstacles)
}

function pointsToRoundedPath(points: Array<{ x: number; y: number }>, radius = CORNER_RADIUS): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const inVector = { x: current.x - previous.x, y: current.y - previous.y }
    const outVector = { x: next.x - current.x, y: next.y - current.y }
    const inLength = Math.hypot(inVector.x, inVector.y)
    const outLength = Math.hypot(outVector.x, outVector.y)
    if (inLength < 0.01 || outLength < 0.01) continue

    const cornerRadius = Math.min(radius, inLength / 2, outLength / 2)
    const entry = {
      x: current.x - (inVector.x / inLength) * cornerRadius,
      y: current.y - (inVector.y / inLength) * cornerRadius,
    }
    const exit = {
      x: current.x + (outVector.x / outLength) * cornerRadius,
      y: current.y + (outVector.y / outLength) * cornerRadius,
    }
    path += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`
  }

  const last = points[points.length - 1]
  path += ` L ${last.x} ${last.y}`
  return path
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
    const length = segmentLength(points[index], points[index + 1])
    lengths.push(length)
    total += length
  }

  if (total === 0) return points[0]
  const target = total / 2
  let traveled = 0

  for (let index = 0; index < lengths.length; index += 1) {
    const len = lengths[index]
    if (traveled + len >= target) {
      const ratio = len === 0 ? 0 : (target - traveled) / len
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
      }
    }
    traveled += len
  }

  return points[points.length - 1]
}

/** Smooth Bézier connector. */
export function curvedEdgePath(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
): string {
  const fromStub = stubPoint(from, fromSide, CONNECTOR_STUB)
  const toStub = stubPoint(to, toSide, CONNECTOR_STUB)
  const distance = Math.hypot(toStub.x - fromStub.x, toStub.y - fromStub.y)
  const bend = Math.min(140, Math.max(36, distance / 2))
  const d1 = SIDE_DIRECTION[fromSide]
  const d2 = SIDE_DIRECTION[toSide]
  const c1 = { x: fromStub.x + d1.x * bend, y: fromStub.y + d1.y * bend }
  const c2 = { x: toStub.x + d2.x * bend, y: toStub.y + d2.y * bend }
  return `M ${from.x} ${from.y} L ${fromStub.x} ${fromStub.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${toStub.x} ${toStub.y} L ${to.x} ${to.y}`
}

/** Orthogonal connector — straight segments with 90° corners only. */
export function orthogonalEdgePath(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  context?: EdgeRouteContext,
): string {
  const points = orthogonalEdgePoints(from, fromSide, to, toSide, context)
  return pointsToRoundedPath(points)
}

export function buildEdgePath(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  routing: EdgeRouting = 'curved',
  context?: EdgeRouteContext,
): string {
  return routing === 'orthogonal'
    ? orthogonalEdgePath(from, fromSide, to, toSide, context)
    : curvedEdgePath(from, fromSide, to, toSide)
}

/** Point on the connector path where labels should sit (mid-path, on the line). */
export function edgeLabelPosition(
  from: { x: number; y: number },
  fromSide: PortSide,
  to: { x: number; y: number },
  toSide: PortSide,
  routing: EdgeRouting = 'curved',
  context?: EdgeRouteContext,
): { x: number; y: number } {
  if (routing === 'orthogonal') {
    return polylineMidpoint(orthogonalEdgePoints(from, fromSide, to, toSide, context))
  }

  const fromStub = stubPoint(from, fromSide, CONNECTOR_STUB)
  const toStub = stubPoint(to, toSide, CONNECTOR_STUB)
  const distance = Math.hypot(toStub.x - fromStub.x, toStub.y - fromStub.y)
  const bend = Math.min(140, Math.max(36, distance / 2))
  const d1 = SIDE_DIRECTION[fromSide]
  const d2 = SIDE_DIRECTION[toSide]
  const c1 = { x: fromStub.x + d1.x * bend, y: fromStub.y + d1.y * bend }
  const c2 = { x: toStub.x + d2.x * bend, y: toStub.y + d2.y * bend }
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

  if (ELLIPSE_PORT_SHAPES.has(shape)) {
    const cx = node.x + width / 2
    const cy = node.y + height / 2
    const rx = width / 2
    const ry = height / 2
    switch (side) {
      case 'top':
        return { x: cx, y: cy - ry }
      case 'bottom':
        return { x: cx, y: cy + ry }
      case 'left':
        return { x: cx - rx, y: cy }
      case 'right':
        return { x: cx + rx, y: cy }
    }
  }

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

/** Side of a point that faces toward another point (for preview endpoints). */
export function portSideFacing(
  at: { x: number; y: number },
  toward: { x: number; y: number },
): PortSide {
  const dx = toward.x - at.x
  const dy = toward.y - at.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'left' : 'right'
  return dy > 0 ? 'top' : 'bottom'
}

/** Best facing port pair for two nodes — updates as shapes move. */
export function facingPortSides(
  fromNode: DiagramNode,
  fromShape: PaletteShape,
  toNode: DiagramNode,
  toShape: PaletteShape,
): { fromSide: PortSide; toSide: PortSide } {
  const fromSize = getNodeSize(fromNode, fromShape)
  const toSize = getNodeSize(toNode, toShape)
  const fromCenter = {
    x: fromNode.x + fromSize.width / 2,
    y: fromNode.y + fromSize.height / 2,
  }
  const toCenter = {
    x: toNode.x + toSize.width / 2,
    y: toNode.y + toSize.height / 2,
  }
  const dx = toCenter.x - fromCenter.x
  const dy = toCenter.y - fromCenter.y

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { fromSide: 'right', toSide: 'left' }
      : { fromSide: 'left', toSide: 'right' }
  }

  return dy > 0
    ? { fromSide: 'bottom', toSide: 'top' }
    : { fromSide: 'top', toSide: 'bottom' }
}

/** Picks port sides that produce the shortest clean orthogonal route (Visio-style). */
export function bestPortSidesForConnection(
  fromNode: DiagramNode,
  fromShape: PaletteShape,
  toNode: DiagramNode,
  toShape: PaletteShape,
  context?: EdgeRouteContext,
  fixedFromSide?: PortSide,
): { fromSide: PortSide; toSide: PortSide } {
  const preferred = facingPortSides(fromNode, fromShape, toNode, toShape)
  const fromSides = fixedFromSide ? [fixedFromSide] : PORT_SIDES
  let bestFrom = preferred.fromSide
  let bestTo = preferred.toSide
  let bestCost = Number.POSITIVE_INFINITY

  for (const fromSide of fromSides) {
    for (const toSide of PORT_SIDES) {
      const from = portPoint(fromNode, fromShape, fromSide)
      const to = portPoint(toNode, toShape, toSide)
      const points = orthogonalEdgePoints(from, fromSide, to, toSide, context)
      let cost = pathCost(points)
      if (fromSide === preferred.fromSide && toSide === preferred.toSide) cost -= 16
      if (cost < bestCost) {
        bestCost = cost
        bestFrom = fromSide
        bestTo = toSide
      }
    }
  }

  return { fromSide: bestFrom, toSide: bestTo }
}

/** Palette used when a tool has no designer configuration yet. */
export const FALLBACK_PALETTE: PaletteItem[] = [
  { id: 'generic-box', label: 'Box', shape: 'rectangle', color: 'slate', group: 'Basic', order: 1 },
  { id: 'generic-ellipse', label: 'Ellipse', shape: 'ellipse', color: 'slate', group: 'Basic', order: 2 },
  { id: 'generic-circle', label: 'Circle', shape: 'circle', color: 'slate', group: 'Basic', order: 3 },
  { id: 'generic-diamond', label: 'Diamond', shape: 'decision', color: 'slate', group: 'Basic', order: 4 },
  { id: 'generic-note', label: 'Note', shape: 'note', color: 'slate', group: 'Annotate', order: 5 },
  { id: 'generic-text', label: 'Text', shape: 'text', color: 'slate', group: 'Annotate', order: 6 },
]

export const DND_MIME = 'application/x-clovai-palette-item'
