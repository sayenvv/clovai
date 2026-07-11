import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type DragEvent as ReactDragEvent,
} from 'react'
import { MousePointerClick } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useTheme } from '@/hooks/use-theme'
import { NodeShape } from './NodeShape'
import { AgentNodeCard } from '@/components/agent-workflow/AgentNodeCard'
import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
  TOOL_NODE_HEIGHT,
  TOOL_NODE_WIDTH,
  isMappedToolPalette,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { edgeNeedsApprovalStyle } from '@/components/agent-workflow/validate-workflow'
import {
  agentNodeSize,
  isToolNode,
  toolNodeSize,
} from '@/components/agent-workflow/tool-agent-mapping'
import { resolveEdgeColors } from './diagram-colors'
import {
  buildEdgePath,
  previewEdgePath,
  DND_MIME,
  DEFAULT_EDGE_ROUTING,
  edgeLabelPosition,
  bestPortSidesForConnection,
  resolveEdgeRouting,
  getNodeSize,
  clampNodeSize,
  nearestSide,
  nodeRouteObstacle,
  nodeSize,
  portAnchor,
  portPoint,
  PORT_SIDES,
  resizeAspect,
  resolveNodeStyle,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type PortSide,
  type ResizeAspect,
  type Viewport,
} from './diagram-types'
import { EdgeContextMenu, type EdgeContextMenuState } from './EdgeContextMenu'
import { CanvasZoomControls } from './CanvasZoomControls'
import { NodeSelectionOverlay, type FullResizeHandle } from './NodeSelectionOverlay'
import { zoomViewportAt } from './viewport-utils'
import type { PaletteItem, PaletteShape } from '@/types/config'
import {
  isEdgeInSelection,
  isNodeInSelection,
  selectedEdgeIds,
  selectedNodeIds,
  selectSingleEdge,
  toggleEdgeInSelection,
  toggleNodeInSelection,
  type Selection,
} from '@/components/designer/selection-utils'

const GRID_STEP = 12
const MAGNETIC_SNAP_PX = 28

export type { Selection } from '@/components/designer/selection-utils'

type ReconnectEnd = 'from' | 'to'

/** Agent cards are always rectangular — use process ports for routing and hit targets. */
function resolvePortShape(
  node: DiagramNode,
  item: PaletteItem,
  agentMode: boolean,
): PaletteShape {
  if (agentMode && node.paletteId.startsWith('aw-')) return 'process'
  return resolveNodeStyle(node, item).shape
}

type DragSession =
  | { type: 'pan'; startX: number; startY: number; originX: number; originY: number }
  | {
      type: 'node'
      id: string
      offsetX: number
      offsetY: number
      groupIds?: string[]
      groupStarts?: Record<string, { x: number; y: number }>
    }
  | {
      type: 'resize'
      id: string
      handle: FullResizeHandle
      aspect: ResizeAspect
      shape: PaletteShape
      startWorld: { x: number; y: number }
      origin: { x: number; y: number; width: number; height: number }
    }
  | { type: 'reconnect'; edgeId: string; end: ReconnectEnd }
  | {
      type: 'marquee'
      startWorld: { x: number; y: number }
      currentWorld: { x: number; y: number }
    }
  | null

interface PendingConnection {
  nodeId: string
  side: PortSide
}

function findPortAtWorld(
  world: { x: number; y: number },
  nodes: DiagramNode[],
  paletteById: Map<string, PaletteItem>,
  threshold: number,
  agentMode: boolean,
  options?: {
    excludeNodeId?: string
    isValidTarget?: (node: DiagramNode) => boolean
  },
): { nodeId: string; side: PortSide } | null {
  let best: { nodeId: string; side: PortSide; dist: number } | null = null

  for (const node of nodes) {
    if (options?.excludeNodeId && node.id === options.excludeNodeId) continue
    if (options?.isValidTarget && !options.isValidTarget(node)) continue
    const item = paletteById.get(node.paletteId)
    if (!item) continue
    const shape = resolvePortShape(node, item, agentMode)
    for (const side of PORT_SIDES) {
      const point = portPoint(node, shape, side)
      const dist = Math.hypot(world.x - point.x, world.y - point.y)
      if (dist < threshold && (!best || dist < best.dist)) {
        best = { nodeId: node.id, side, dist }
      }
    }
  }

  return best ? { nodeId: best.nodeId, side: best.side } : null
}

function isConnectableTarget(node: DiagramNode, agentMode: boolean): boolean {
  if (agentMode && isToolNode(node)) return false
  return true
}

/** Keep short labels on one line; split longer ones into ~2 balanced lines. */
function formatConnectorLabel(text: string, maxCharsPerLine = 28): string {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''
  if (normalized.includes('\n')) return normalized
  if (normalized.length <= maxCharsPerLine) return normalized

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length <= 2) return normalized

  const total = normalized.length
  const target = Math.ceil(total / 2)
  let best = 1
  let bestScore = Number.POSITIVE_INFINITY
  let length = 0
  for (let i = 0; i < words.length - 1; i++) {
    length += words[i].length + (i > 0 ? 1 : 0)
    // Prefer a break that also respects the available line width.
    const linePenalty = length > maxCharsPerLine ? (length - maxCharsPerLine) * 2 : 0
    const score = Math.abs(length - target) + linePenalty
    if (score < bestScore) {
      bestScore = score
      best = i + 1
    }
  }
  return `${words.slice(0, best).join(' ')}\n${words.slice(best).join(' ')}`
}

/** Label chip width: snug for short text, never wider than the gap between nodes. */
function connectorLabelWidth(text: string, maxAvailable: number, editing = false): number {
  const maxWidth = Math.max(24, Math.min(280, maxAvailable))
  const charsPerLine = Math.max(8, Math.min(40, Math.floor((maxWidth - 16) / 6.5)))
  const formatted = formatConnectorLabel(text || (editing ? 'Short label' : ''), charsPerLine)
  const longest = Math.max(
    1,
    ...formatted.split('\n').map((line) => line.length),
    editing ? 12 : 0,
  )
  // ~6.5px per character at 11px + horizontal padding.
  return Math.round(Math.min(maxWidth, Math.max(editing ? Math.min(96, maxWidth) : 24, longest * 6.5 + 16)))
}

function nodeContainsPoint(
  node: DiagramNode,
  shape: PaletteItem['shape'],
  world: { x: number; y: number },
): boolean {
  const { width, height } = getNodeSize(node, shape)
  return (
    world.x >= node.x &&
    world.x <= node.x + width &&
    world.y >= node.y &&
    world.y <= node.y + height
  )
}

interface DesignerCanvasProps {
  diagram: Diagram
  onChange: (updater: (previous: Diagram) => Diagram) => void
  paletteById: Map<string, PaletteItem>
  viewport: Viewport
  onViewportChange: (updater: (previous: Viewport) => Viewport) => void
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  snapToGrid: boolean
  showGrid: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  /** Fit all diagram content in view, centered on the canvas. */
  onFitToScreen?: () => void
  /** Agent workflow builder — rich agent cards and approval edge styling. */
  agentMode?: boolean
  transformDroppedNode?: (node: DiagramNode, item: PaletteItem) => DiagramNode
  /** Return null to cancel drop (e.g. tool with no agent on canvas). */
  finalizeDroppedNode?: (
    node: DiagramNode,
    diagram: Diagram,
    world: { x: number; y: number },
  ) => DiagramNode | null
  /** When true, nodes and edges cannot be selected or edited. */
  selectionDisabled?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

let idCounter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`

function applyResize(
  handle: FullResizeHandle,
  origin: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  snap: (value: number) => number,
  aspect: ResizeAspect,
  shape: PaletteShape,
): { x: number; y: number; width: number; height: number } {
  let width = origin.width
  let height = origin.height

  if (handle === 'e' || handle === 'ne' || handle === 'se') {
    width = snap(origin.width + dx)
  }
  if (handle === 'w' || handle === 'nw' || handle === 'sw') {
    width = snap(origin.width - dx)
  }
  if (handle === 's' || handle === 'se' || handle === 'sw') {
    height = snap(origin.height + dy)
  }
  if (handle === 'n' || handle === 'ne' || handle === 'nw') {
    height = snap(origin.height - dy)
  }

  const clamped = clampNodeSize(shape, width, height)
  width = clamped.width
  height = clamped.height

  if (aspect === 'square') {
    const size = Math.max(width, height)
    width = size
    height = size
  } else if (aspect === 'preserve') {
    const ratio = origin.width / origin.height
    const verticalHandle = handle === 'n' || handle === 's'
    if (verticalHandle) {
      width = height * ratio
    } else {
      height = width / ratio
    }
    const preserved = clampNodeSize(shape, width, height)
    width = preserved.width
    height = preserved.height
  }

  let x = origin.x
  let y = origin.y
  if (handle === 'w' || handle === 'nw' || handle === 'sw') {
    x = origin.x + origin.width - width
  }
  if (handle === 'n' || handle === 'ne' || handle === 'nw') {
    y = origin.y + origin.height - height
  }

  return { x, y, width, height }
}

export const DesignerCanvas = memo(function DesignerCanvas({
  diagram,
  onChange,
  paletteById,
  viewport,
  onViewportChange,
  selection,
  onSelectionChange,
  snapToGrid,
  showGrid,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  agentMode = false,
  transformDroppedNode,
  finalizeDroppedNode,
  selectionDisabled = false,
  onUndo,
  onRedo,
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isDark } = useTheme()
  const sessionRef = useRef<DragSession>(null)
  const [connectFrom, setConnectFrom] = useState<PendingConnection | null>(null)
  const [connectCursor, setConnectCursor] = useState<{ x: number; y: number } | null>(null)
  const [reconnectEnd, setReconnectEnd] = useState<{ edgeId: string; end: ReconnectEnd } | null>(
    null,
  )
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)
  const [isGrabbing, setIsGrabbing] = useState(false)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [snapTarget, setSnapTarget] = useState<{ nodeId: string; side: PortSide } | null>(null)
  const [edgeMenu, setEdgeMenu] = useState<EdgeContextMenuState | null>(null)
  const edgeClipboardRef = useRef<DiagramEdge[]>([])
  const [marquee, setMarquee] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [flowMotion, setFlowMotion] = useState(false)

  const snap = useCallback(
    (value: number) => (snapToGrid ? Math.round(value / GRID_STEP) * GRID_STEP : value),
    [snapToGrid],
  )

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - viewport.x) / viewport.scale,
        y: (clientY - rect.top - viewport.y) / viewport.scale,
      }
    },
    [viewport],
  )

  const buildRouteObstacles = useCallback(
    (nodes: DiagramNode[]) =>
      nodes.flatMap((node) => {
        const item = paletteById.get(node.paletteId)
        if (!item) return []
        return [nodeRouteObstacle(node, resolvePortShape(node, item, agentMode))]
      }),
    [paletteById, agentMode],
  )

  const resolveConnectionSides = useCallback(
    (
      nodes: DiagramNode[],
      fromNodeId: string,
      toNodeId: string,
      fixedFromSide?: PortSide,
      fixedToSide?: PortSide,
    ) => {
      const from = nodes.find((node) => node.id === fromNodeId)
      const to = nodes.find((node) => node.id === toNodeId)
      if (!from || !to) {
        return { fromSide: fixedFromSide ?? 'right', toSide: fixedToSide ?? 'left' }
      }
      const fromItem = paletteById.get(from.paletteId)
      const toItem = paletteById.get(to.paletteId)
      if (!fromItem || !toItem) {
        return { fromSide: fixedFromSide ?? 'right', toSide: fixedToSide ?? 'left' }
      }
      if (fixedFromSide && fixedToSide) {
        return { fromSide: fixedFromSide, toSide: fixedToSide }
      }
      return bestPortSidesForConnection(
        from,
        resolvePortShape(from, fromItem, agentMode),
        to,
        resolvePortShape(to, toItem, agentMode),
        {
          obstacles: buildRouteObstacles(nodes),
          fromNodeId: fromNodeId,
          toNodeId: toNodeId,
        },
        fixedFromSide,
      )
    },
    [paletteById, buildRouteObstacles, agentMode],
  )

  const addEdge = useCallback(
    (from: PendingConnection, toNodeId: string, fixedToSide?: PortSide) => {
      if (from.nodeId === toNodeId) return
      let createdId: string | null = null
      onChange((previous) => {
        const exists = previous.edges.some(
          (candidate) => candidate.from === from.nodeId && candidate.to === toNodeId,
        )
        if (exists) return previous
        const sides = resolveConnectionSides(
          previous.nodes,
          from.nodeId,
          toNodeId,
          from.side,
          fixedToSide,
        )
        createdId = nextId('edge')
        const edge: DiagramEdge = {
          id: createdId,
          from: from.nodeId,
          to: toNodeId,
          fromSide: sides.fromSide,
          toSide: sides.toSide,
          routing: DEFAULT_EDGE_ROUTING,
        }
        return { ...previous, edges: [...previous.edges, edge] }
      })
      setConnectFrom(null)
      setConnectCursor(null)
      setSnapTarget(null)
      if (createdId && !selectionDisabled) {
        onSelectionChange(selectSingleEdge(createdId))
      }
    },
    [onChange, resolveConnectionSides, onSelectionChange, selectionDisabled],
  )

  const applyReconnect = useCallback(
    (edgeId: string, end: ReconnectEnd, nodeId: string, side: PortSide) => {
      onChange((previous) => ({
        ...previous,
        edges: previous.edges.map((edge) => {
          if (edge.id !== edgeId || edge.locked) return edge
          const next =
            end === 'from'
              ? { ...edge, from: nodeId, fromSide: side }
              : { ...edge, to: nodeId, toSide: side }
          if (next.from === next.to) return edge
          return next
        }),
      }))
      setSnapTarget(null)
    },
    [onChange],
  )

  const updateEdgeEndpointSide = useCallback(
    (edgeId: string, end: ReconnectEnd, side: PortSide) => {
      onChange((previous) => ({
        ...previous,
        edges: previous.edges.map((edge) => {
          if (edge.id !== edgeId) return edge
          return end === 'from' ? { ...edge, fromSide: side } : { ...edge, toSide: side }
        }),
      }))
    },
    [onChange],
  )

  /* ---- zoom (native listener so preventDefault works) ---- */
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top
      onViewportChange((previous) => {
        const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08
        return zoomViewportAt(previous, factor, cursorX, cursorY)
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [onViewportChange])

  /* ---- keyboard: delete, escape, undo/redo, clipboard, duplicate ---- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const tag = target.tagName
      const inputType = tag === 'INPUT' ? (target as HTMLInputElement).type || 'text' : ''
      // Search / color / buttons must not block canvas Delete/Backspace.
      // Real text fields (label editors, etc.) still capture typing.
      const isTextEditing =
        tag === 'TEXTAREA' ||
        target.isContentEditable ||
        (tag === 'INPUT' &&
          !['button', 'checkbox', 'radio', 'file', 'reset', 'submit', 'color', 'search'].includes(
            inputType,
          ))

      if (event.key === 'Escape') {
        if (isTextEditing) return
        setConnectFrom(null)
        setConnectCursor(null)
        setReconnectEnd(null)
        setSnapTarget(null)
        setEdgeMenu(null)
        sessionRef.current = null
        setMarquee(null)
        if (!selectionDisabled) onSelectionChange(null)
        return
      }

      if (isTextEditing) return

      const meta = event.metaKey || event.ctrlKey

      if (meta && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        onUndo?.()
        return
      }
      if ((meta && event.key.toLowerCase() === 'z' && event.shiftKey) || (meta && event.key.toLowerCase() === 'y')) {
        event.preventDefault()
        onRedo?.()
        return
      }

      if (selectionDisabled) return

      const edgeIds = selectedEdgeIds(selection)
      const nodeIds = selectedNodeIds(selection)

      if (meta && event.key.toLowerCase() === 'c' && edgeIds.length > 0) {
        event.preventDefault()
        edgeClipboardRef.current = diagram.edges.filter((edge) => edgeIds.includes(edge.id))
        return
      }
      if (meta && event.key.toLowerCase() === 'x' && edgeIds.length > 0) {
        event.preventDefault()
        edgeClipboardRef.current = diagram.edges.filter((edge) => edgeIds.includes(edge.id))
        onChange((previous) => ({
          ...previous,
          edges: previous.edges.filter((edge) => !edgeIds.includes(edge.id) || edge.locked),
        }))
        onSelectionChange(null)
        return
      }
      if (meta && event.key.toLowerCase() === 'v' && edgeClipboardRef.current.length > 0) {
        event.preventDefault()
        const pasted = edgeClipboardRef.current.map((edge) => ({
          ...edge,
          id: nextId('edge'),
          locked: false,
        }))
        onChange((previous) => {
          const nodeSet = new Set(previous.nodes.map((node) => node.id))
          const valid = pasted.filter((edge) => nodeSet.has(edge.from) && nodeSet.has(edge.to))
          return { ...previous, edges: [...previous.edges, ...valid] }
        })
        return
      }
      if (meta && event.key.toLowerCase() === 'd' && edgeIds.length > 0) {
        event.preventDefault()
        onChange((previous) => {
          const clones = previous.edges
            .filter((edge) => edgeIds.includes(edge.id))
            .map((edge) => ({ ...edge, id: nextId('edge'), locked: false }))
          return { ...previous, edges: [...previous.edges, ...clones] }
        })
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selection) {
        event.preventDefault()
        event.stopPropagation()
        onChange((previous) => {
          if (edgeIds.length > 0) {
            return {
              ...previous,
              edges: previous.edges.filter((edge) => !edgeIds.includes(edge.id) || edge.locked),
            }
          }
          if (nodeIds.length === 0) return previous
          const removeIds = new Set(nodeIds)
          for (const node of previous.nodes) {
            if (node.mappedAgentId && removeIds.has(node.mappedAgentId)) {
              removeIds.add(node.id)
            }
          }
          return {
            nodes: previous.nodes.filter((node) => !removeIds.has(node.id)),
            edges: previous.edges.filter(
              (edge) => !removeIds.has(edge.from) && !removeIds.has(edge.to),
            ),
          }
        })
        onSelectionChange(null)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [
    selection,
    onChange,
    onSelectionChange,
    selectionDisabled,
    onUndo,
    onRedo,
    diagram.edges,
  ])

  /* ---- pointer interactions ---- */
  const handleBackgroundPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return
    containerRef.current?.setPointerCapture(event.pointerId)
    const world = toWorld(event.clientX, event.clientY)

    if (event.shiftKey && !selectionDisabled) {
      sessionRef.current = {
        type: 'marquee',
        startWorld: world,
        currentWorld: world,
      }
      setMarquee({ x: world.x, y: world.y, width: 0, height: 0 })
      setConnectFrom(null)
      setConnectCursor(null)
      setReconnectEnd(null)
      setSnapTarget(null)
      setEdgeMenu(null)
      return
    }

    sessionRef.current = {
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    }
    setIsGrabbing(true)
    onSelectionChange(null)
    setConnectFrom(null)
    setConnectCursor(null)
    setReconnectEnd(null)
    setSnapTarget(null)
    setEdgeMenu(null)
    setEditingNodeId(null)
    setHoveredEdgeId(null)
    setMarquee(null)
  }

  const handleNodePointerDown = (event: ReactPointerEvent, node: DiagramNode) => {
    if (event.button !== 0 || selectionDisabled) return
    event.stopPropagation()

    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.closest('[aria-label="Shape palette"]')
    ) {
      document.activeElement.blur()
    }
    containerRef.current?.focus({ preventScroll: true })

    // Completing a pending connection — snap to the best facing port on the target.
    if (connectFrom && connectFrom.nodeId !== node.id) {
      if (agentMode && isToolNode(node)) return
      addEdge(connectFrom, node.id)
      return
    }

    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    if (additive) {
      onSelectionChange(toggleNodeInSelection(selection, node.id))
      return
    }

    containerRef.current?.setPointerCapture(event.pointerId)
    const world = toWorld(event.clientX, event.clientY)
    const currentIds = selectedNodeIds(selection)
    const groupIds =
      currentIds.length > 1 && currentIds.includes(node.id) ? currentIds : undefined
    const groupStarts = groupIds
      ? Object.fromEntries(
          diagram.nodes
            .filter((candidate) => groupIds.includes(candidate.id))
            .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
        )
      : undefined

    sessionRef.current = {
      type: 'node',
      id: node.id,
      offsetX: world.x - node.x,
      offsetY: world.y - node.y,
      groupIds,
      groupStarts,
    }
    setIsGrabbing(true)

    if (groupIds) {
      onSelectionChange({ kind: 'nodes', ids: groupIds })
      return
    }

    onSelectionChange({ kind: 'node', id: node.id })
  }

  const handlePortPointerDown = (event: ReactPointerEvent, node: DiagramNode, side: PortSide) => {
    event.stopPropagation()
    if (selectionDisabled) return

    if (reconnectEnd) {
      applyReconnect(reconnectEnd.edgeId, reconnectEnd.end, node.id, side)
      setReconnectEnd(null)
      setConnectCursor(null)
      setSnapTarget(null)
      sessionRef.current = null
      return
    }

    const selectedEdge =
      selection?.kind === 'edge'
        ? diagram.edges.find((candidate) => candidate.id === selection.id)
        : undefined

    if (selectedEdge && !selectedEdge.locked) {
      if (selectedEdge.from === node.id && selectedEdge.fromSide !== side) {
        updateEdgeEndpointSide(selectedEdge.id, 'from', side)
        return
      }
      if (selectedEdge.to === node.id && selectedEdge.toSide !== side) {
        updateEdgeEndpointSide(selectedEdge.id, 'to', side)
        return
      }
    }

    if (connectFrom && connectFrom.nodeId !== node.id) {
      // Clicking a specific port on another node completes the connection there.
      addEdge(connectFrom, node.id, side)
      return
    }

    containerRef.current?.setPointerCapture(event.pointerId)
    setConnectFrom({ nodeId: node.id, side })
    setConnectCursor(toWorld(event.clientX, event.clientY))
    setSnapTarget(null)
    setEdgeMenu(null)
  }

  const handleEndpointDragPointerDown = (
    event: ReactPointerEvent,
    edgeId: string,
    end: ReconnectEnd,
  ) => {
    if (event.button !== 0) return
    const edge = diagram.edges.find((candidate) => candidate.id === edgeId)
    if (edge?.locked) return
    event.stopPropagation()
    containerRef.current?.setPointerCapture(event.pointerId)
    sessionRef.current = { type: 'reconnect', edgeId, end }
    setReconnectEnd({ edgeId, end })
    setConnectFrom(null)
    setConnectCursor(toWorld(event.clientX, event.clientY))
    setSnapTarget(null)
  }

  const handleResizePointerDown = (
    event: ReactPointerEvent,
    node: DiagramNode,
    item: PaletteItem,
    handle: FullResizeHandle,
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()
    containerRef.current?.setPointerCapture(event.pointerId)
    const { width, height } = getNodeSize(node, resolveNodeStyle(node, item).shape)
    const shape = resolveNodeStyle(node, item).shape
    sessionRef.current = {
      type: 'resize',
      id: node.id,
      handle,
      aspect: resizeAspect(shape),
      shape,
      startWorld: toWorld(event.clientX, event.clientY),
      origin: { x: node.x, y: node.y, width, height },
    }
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    const session = sessionRef.current
    const connecting = Boolean(connectFrom) || session?.type === 'reconnect'
    if (connecting) {
      const world = toWorld(event.clientX, event.clientY)
      const excludeId =
        connectFrom?.nodeId ??
        (session?.type === 'reconnect'
          ? diagram.edges.find((edge) => edge.id === session.edgeId)?.[
              session.end === 'from' ? 'to' : 'from'
            ]
          : undefined)
      const snapThreshold = MAGNETIC_SNAP_PX / viewport.scale
      const hit = findPortAtWorld(world, diagram.nodes, paletteById, snapThreshold, agentMode, {
        excludeNodeId: excludeId,
        isValidTarget: (node) => isConnectableTarget(node, agentMode),
      })
      setSnapTarget(hit)
      setConnectCursor(hit
        ? (() => {
            const node = diagram.nodes.find((candidate) => candidate.id === hit.nodeId)
            const item = node && paletteById.get(node.paletteId)
            if (!node || !item) return world
            return portPoint(node, resolvePortShape(node, item, agentMode), hit.side)
          })()
        : world)
    }

    if (!session || session.type === 'reconnect') return

    if (session.type === 'marquee') {
      const world = toWorld(event.clientX, event.clientY)
      session.currentWorld = world
      const x = Math.min(session.startWorld.x, world.x)
      const y = Math.min(session.startWorld.y, world.y)
      const width = Math.abs(world.x - session.startWorld.x)
      const height = Math.abs(world.y - session.startWorld.y)
      setMarquee({ x, y, width, height })
      return
    }

    if (session.type === 'pan') {
      const dx = event.clientX - session.startX
      const dy = event.clientY - session.startY
      onViewportChange((previous) => ({
        ...previous,
        x: session.originX + dx,
        y: session.originY + dy,
      }))
      return
    }

    const world = toWorld(event.clientX, event.clientY)

    if (session.type === 'node') {
      const { id, offsetX, offsetY, groupIds, groupStarts } = session
      const x = snap(world.x - offsetX)
      const y = snap(world.y - offsetY)
      const dragged = diagram.nodes.find((node) => node.id === id)
      const dx = dragged ? x - dragged.x : 0
      const dy = dragged ? y - dragged.y : 0
      onChange((previous) => {
        const moveIds =
          groupIds && groupStarts
            ? new Set(groupIds)
            : new Set([id])
        const nodes = previous.nodes.map((node) => {
          if (node.id === id) return { ...node, x, y }
          if (groupIds && groupStarts && moveIds.has(node.id)) {
            const start = groupStarts[node.id]
            if (!start) return node
            return { ...node, x: snap(start.x + dx), y: snap(start.y + dy) }
          }
          return node
        })
        const edges = previous.edges.map((edge) => {
          if (!moveIds.has(edge.from) && !moveIds.has(edge.to)) return edge
          if (edge.locked || agentMode) return edge
          const sides = resolveConnectionSides(nodes, edge.from, edge.to)
          return { ...edge, fromSide: sides.fromSide, toSide: sides.toSide }
        })
        return { ...previous, nodes, edges }
      })
      return
    }

    // Resize: adjust the dragged handle, keeping the opposite edge anchored.
    const { id, handle, aspect, shape, startWorld, origin } = session
    const dx = world.x - startWorld.x
    const dy = world.y - startWorld.y
    const next = applyResize(handle, origin, dx, dy, snap, aspect, shape)

    onChange((previous) => {
      const nodes = previous.nodes.map((node) =>
        node.id === id ? { ...node, ...next } : node,
      )
      const edges = previous.edges.map((edge) => {
        if (edge.from !== id && edge.to !== id) return edge
        if (edge.locked || agentMode) return edge
        const sides = resolveConnectionSides(nodes, edge.from, edge.to)
        return { ...edge, fromSide: sides.fromSide, toSide: sides.toSide }
      })
      return { ...previous, nodes, edges }
    })
  }

  const handlePointerUp = (event: ReactPointerEvent) => {
    const session = sessionRef.current
    const world = toWorld(event.clientX, event.clientY)
    const snapThreshold = MAGNETIC_SNAP_PX / viewport.scale

    if (session?.type === 'reconnect') {
      const portHit =
        snapTarget ??
        findPortAtWorld(world, diagram.nodes, paletteById, snapThreshold, agentMode, {
          isValidTarget: (node) => isConnectableTarget(node, agentMode),
        })

      if (portHit) {
        applyReconnect(session.edgeId, session.end, portHit.nodeId, portHit.side)
      } else {
        for (const node of diagram.nodes) {
          if (!isConnectableTarget(node, agentMode)) continue
          const item = paletteById.get(node.paletteId)
          if (!item) continue
          const shape = resolvePortShape(node, item, agentMode)
          if (!nodeContainsPoint(node, shape, world)) continue
          applyReconnect(
            session.edgeId,
            session.end,
            node.id,
            nearestSide(node, shape, world),
          )
          break
        }
      }

      setReconnectEnd(null)
      setConnectCursor(null)
      setSnapTarget(null)
      sessionRef.current = null
      setIsGrabbing(false)
      return
    }

    if (connectFrom) {
      const portHit =
        snapTarget ??
        findPortAtWorld(world, diagram.nodes, paletteById, snapThreshold, agentMode, {
          excludeNodeId: connectFrom.nodeId,
          isValidTarget: (node) => isConnectableTarget(node, agentMode),
        })
      if (portHit) {
        addEdge(connectFrom, portHit.nodeId, portHit.side)
      } else {
        for (const node of diagram.nodes) {
          if (node.id === connectFrom.nodeId) continue
          if (!isConnectableTarget(node, agentMode)) continue
          const item = paletteById.get(node.paletteId)
          if (!item) continue
          const shape = resolvePortShape(node, item, agentMode)
          if (!nodeContainsPoint(node, shape, world)) continue
          addEdge(connectFrom, node.id)
          break
        }
      }
      // Leave connectFrom set when no target so click-to-connect still works.
      setSnapTarget(null)
      sessionRef.current = null
      setIsGrabbing(false)
      return
    }

    if (session?.type === 'marquee') {
      const x1 = Math.min(session.startWorld.x, session.currentWorld.x)
      const y1 = Math.min(session.startWorld.y, session.currentWorld.y)
      const x2 = Math.max(session.startWorld.x, session.currentWorld.x)
      const y2 = Math.max(session.startWorld.y, session.currentWorld.y)
      const hitEdges = renderedEdges
        .filter(({ midpoint }) =>
          midpoint.x >= x1 && midpoint.x <= x2 && midpoint.y >= y1 && midpoint.y <= y2,
        )
        .map(({ edge }) => edge.id)
      const hitNodes = diagram.nodes.filter((node) => {
        const item = paletteById.get(node.paletteId)
        if (!item) return false
        const { width, height } = getNodeSize(node, resolvePortShape(node, item, agentMode))
        const nx2 = node.x + width
        const ny2 = node.y + height
        return node.x < x2 && nx2 > x1 && node.y < y2 && ny2 > y1
      }).map((node) => node.id)

      if (hitEdges.length > 0 && hitNodes.length === 0) {
        onSelectionChange(
          hitEdges.length === 1
            ? selectSingleEdge(hitEdges[0])
            : { kind: 'edges', ids: hitEdges },
        )
      } else if (hitNodes.length > 0) {
        onSelectionChange(
          hitNodes.length === 1
            ? { kind: 'node', id: hitNodes[0] }
            : { kind: 'nodes', ids: hitNodes },
        )
      } else {
        onSelectionChange(null)
      }
      setMarquee(null)
      sessionRef.current = null
      setIsGrabbing(false)
      return
    }

    sessionRef.current = null
    setIsGrabbing(false)
  }

  /* ---- palette drop ---- */
  const handleDrop = (event: ReactDragEvent) => {
    event.preventDefault()
    if (selectionDisabled) return
    const paletteId = event.dataTransfer.getData(DND_MIME)
    const item = paletteById.get(paletteId)
    if (!item) return
    const world = toWorld(event.clientX, event.clientY)
    const { width, height } =
      agentMode && paletteId.startsWith('aw-')
        ? isMappedToolPalette(paletteId)
          ? { width: TOOL_NODE_WIDTH, height: TOOL_NODE_HEIGHT }
          : { width: AGENT_NODE_WIDTH, height: AGENT_NODE_HEIGHT }
        : nodeSize(item.shape)
    let node: DiagramNode = transformDroppedNode
      ? transformDroppedNode(
          {
            id: nextId('node'),
            paletteId,
            label: item.label,
            x: snap(world.x - width / 2),
            y: snap(world.y - height / 2),
          },
          item,
        )
      : {
          id: nextId('node'),
          paletteId,
          label: item.label,
          x: snap(world.x - width / 2),
          y: snap(world.y - height / 2),
        }
    if (finalizeDroppedNode) {
      const finalized = finalizeDroppedNode(node, diagram, world)
      if (!finalized) return
      node = finalized
    }
    onChange((previous) => ({ ...previous, nodes: [...previous.nodes, node] }))
    onSelectionChange({ kind: 'node', id: node.id })
  }

  const commitLabel = (nodeId: string, label: string) => {
    onChange((previous) => ({
      ...previous,
      nodes: previous.nodes.map((node) =>
        node.id === nodeId ? { ...node, label: label.trim() || node.label } : node,
      ),
    }))
    setEditingNodeId(null)
  }

  const commitEdgeLabel = (edgeId: string, label: string) => {
    const trimmed = label.trim()
    onChange((previous) => ({
      ...previous,
      edges: previous.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, label: trimmed || undefined } : edge,
      ),
    }))
    setEditingEdgeId(null)
  }

  /* ---- derived render data ---- */
  const nodesById = useMemo(() => {
    const map = new Map<string, DiagramNode>()
    diagram.nodes.forEach((node) => map.set(node.id, node))
    return map
  }, [diagram.nodes])

  const routeObstacles = useMemo(
    () =>
      diagram.nodes.flatMap((node) => {
        const item = paletteById.get(node.paletteId)
        if (!item) return []
        return [nodeRouteObstacle(node, resolvePortShape(node, item, agentMode))]
      }),
    [diagram.nodes, paletteById, agentMode],
  )

  const agentLabelsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of diagram.nodes) {
      if (node.agent) map.set(node.id, node.label)
    }
    return map
  }, [diagram.nodes])

  const mappedToolCountByAgentId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const node of diagram.nodes) {
      if (!isToolNode(node) || !node.mappedAgentId) continue
      counts.set(node.mappedAgentId, (counts.get(node.mappedAgentId) ?? 0) + 1)
    }
    return counts
  }, [diagram.nodes])

  const mappingLines = useMemo(() => {
    if (!agentMode) return []
    return diagram.nodes.flatMap((node) => {
      if (!isToolNode(node) || !node.mappedAgentId) return []
      const agent = nodesById.get(node.mappedAgentId)
      if (!agent) return []
      const agentSize = agentNodeSize(agent)
      const toolSize = toolNodeSize(node)
      return [
        {
          id: `map-${node.id}`,
          x1: agent.x + agentSize.width / 2,
          y1: agent.y + agentSize.height,
          x2: node.x + toolSize.width / 2,
          y2: node.y,
        },
      ]
    })
  }, [agentMode, diagram.nodes, nodesById])

  const renderedEdges = useMemo(() => {
    const items = diagram.edges.flatMap((edge) => {
      const from = nodesById.get(edge.from)
      const to = nodesById.get(edge.to)
      const fromItem = from && paletteById.get(from.paletteId)
      const toItem = to && paletteById.get(to.paletteId)
      if (!from || !to || !fromItem || !toItem) return []
      const routing = resolveEdgeRouting(edge.routing)
      const fromPoint = portPoint(from, resolvePortShape(from, fromItem, agentMode), edge.fromSide)
      const toPoint = portPoint(to, resolvePortShape(to, toItem, agentMode), edge.toSide)
      const routeContext = {
        obstacles: routeObstacles,
        fromNodeId: edge.from,
        toNodeId: edge.to,
      }
      return [
        {
          edge,
          routing,
          fromPoint,
          toPoint,
          midpoint: edgeLabelPosition(
            fromPoint,
            edge.fromSide,
            toPoint,
            edge.toSide,
            routing,
            routeContext,
          ),
          path: buildEdgePath(
            fromPoint,
            edge.fromSide,
            toPoint,
            edge.toSide,
            routing,
            routeContext,
          ),
        },
      ]
    })
    return items.sort((a, b) => (a.edge.zIndex ?? 0) - (b.edge.zIndex ?? 0))
  }, [diagram.edges, nodesById, paletteById, routeObstacles, agentMode])

  const updateEdgesByIds = useCallback(
    (edgeIds: string[], updater: (edge: DiagramEdge) => DiagramEdge) => {
      const idSet = new Set(edgeIds)
      onChange((previous) => ({
        ...previous,
        edges: previous.edges.map((edge) => (idSet.has(edge.id) ? updater(edge) : edge)),
      }))
    },
    [onChange],
  )

  const deleteEdgesByIds = useCallback(
    (edgeIds: string[]) => {
      const idSet = new Set(edgeIds)
      onChange((previous) => ({
        ...previous,
        edges: previous.edges.filter((edge) => !idSet.has(edge.id) || edge.locked),
      }))
      onSelectionChange(null)
    },
    [onChange, onSelectionChange],
  )

  const duplicateEdgesByIds = useCallback(
    (edgeIds: string[]) => {
      onChange((previous) => {
        const clones = previous.edges
          .filter((edge) => edgeIds.includes(edge.id))
          .map((edge) => ({ ...edge, id: nextId('edge'), locked: false }))
        return { ...previous, edges: [...previous.edges, ...clones] }
      })
    },
    [onChange],
  )

  const reverseEdgesByIds = useCallback(
    (edgeIds: string[]) => {
      updateEdgesByIds(edgeIds, (edge) => {
        if (edge.locked) return edge
        return {
          ...edge,
          from: edge.to,
          to: edge.from,
          fromSide: edge.toSide,
          toSide: edge.fromSide,
        }
      })
    },
    [updateEdgesByIds],
  )

  const nudgeEdgeZIndex = useCallback(
    (edgeIds: string[], delta: number) => {
      updateEdgesByIds(edgeIds, (edge) => ({
        ...edge,
        zIndex: (edge.zIndex ?? 0) + delta,
      }))
    },
    [updateEdgesByIds],
  )

  const connectSourceNode = connectFrom ? nodesById.get(connectFrom.nodeId) : undefined
  const connectSourceItem = connectSourceNode
    ? paletteById.get(connectSourceNode.paletteId)
    : undefined

  const selectedEdgeIdsList = selectedEdgeIds(selection)
  const selectedEdge =
    selectedEdgeIdsList.length === 1
      ? diagram.edges.find((candidate) => candidate.id === selectedEdgeIdsList[0])
      : undefined

  const menuEdgeIds = edgeMenu?.edgeIds ?? []
  const menuPrimaryEdge =
    menuEdgeIds.length > 0
      ? diagram.edges.find((edge) => edge.id === menuEdgeIds[0])
      : undefined

  const reconnectPreview = useMemo(() => {
    if (!reconnectEnd || !connectCursor) return null
    const rendered = renderedEdges.find(({ edge }) => edge.id === reconnectEnd.edgeId)
    if (!rendered) return null
    const { edge, fromPoint, toPoint } = rendered
    if (reconnectEnd.end === 'from') {
      return previewEdgePath(toPoint, edge.toSide, connectCursor, 'to-fixed')
    }
    return previewEdgePath(fromPoint, edge.fromSide, connectCursor, 'from-fixed')
  }, [reconnectEnd, connectCursor, renderedEdges])

  const connectPreviewPath = useMemo(() => {
    if (!connectSourceNode || !connectSourceItem || !connectFrom || !connectCursor) return null
    const fromPoint = portPoint(
      connectSourceNode,
      resolvePortShape(connectSourceNode, connectSourceItem, agentMode),
      connectFrom.side,
    )
    return previewEdgePath(fromPoint, connectFrom.side, connectCursor, 'from-fixed')
  }, [connectSourceNode, connectSourceItem, connectFrom, connectCursor, agentMode])

  const isConnecting = Boolean(connectFrom || reconnectEnd)
  const gridSize = 24 * viewport.scale

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative h-full flex-1 touch-none overflow-hidden bg-[hsl(var(--canvas))] outline-none"
      style={{
        backgroundImage: showGrid
          ? 'radial-gradient(circle, hsl(var(--canvas-grid)) 1px, transparent 1px)'
          : undefined,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        cursor: connectFrom || reconnectEnd ? 'crosshair' : isGrabbing ? 'grabbing' : 'grab',
      }}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={handleDrop}
      role="application"
      aria-label="Diagram canvas"
    >
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Nodes (below connectors) */}
        {diagram.nodes.map((node) => {
          const item = paletteById.get(node.paletteId)
          if (!item) return null
          const { shape, colorOverrides } = resolveNodeStyle(node, item)
          const portShape = resolvePortShape(node, item, agentMode)
          const { width, height } = getNodeSize(node, portShape)
          const isSelected = isNodeInSelection(selection, node.id)
          const isEditing = editingNodeId === node.id
          const isConnectSource = connectFrom?.nodeId === node.id
          const isCompatibleTarget =
            isConnecting && !isConnectSource && isConnectableTarget(node, agentMode)
          const isInvalidTarget = isConnecting && !isConnectSource && !isCompatibleTarget
          const isSnapNode = snapTarget?.nodeId === node.id
          const isConnectTarget = Boolean(isCompatibleTarget)
          const isEdgeEndpoint =
            selectedEdge != null &&
            (node.id === selectedEdge.from || node.id === selectedEdge.to)
          const connectedPortSide = isEdgeEndpoint
            ? node.id === selectedEdge.from
              ? selectedEdge.fromSide
              : selectedEdge.toSide
            : null
          const toolNode = agentMode && isToolNode(node)
          const mappedUnderLabel =
            toolNode && node.mappedAgentId
              ? agentLabelsById.get(node.mappedAgentId)
              : undefined

          return (
            <div
              key={node.id}
              className={cn(
                'group/node absolute z-[1] select-none transition-opacity duration-150',
                selectionDisabled ? 'pointer-events-none' : 'cursor-inherit',
                isInvalidTarget && 'opacity-40',
                isCompatibleTarget && 'opacity-100',
              )}
              style={{ left: node.x, top: node.y, width, height }}
              onPointerDown={(event) => handleNodePointerDown(event, node)}
              onDoubleClick={(event) => {
                if (selectionDisabled) return
                event.stopPropagation()
                setEditingNodeId(node.id)
              }}
            >
              {agentMode && node.agent ? (
                <AgentNodeCard
                  node={node}
                  item={item}
                  isSelected={isSelected}
                  isDark={isDark}
                  mappedUnderLabel={mappedUnderLabel}
                  mappedToolCount={mappedToolCountByAgentId.get(node.id) ?? 0}
                  className="cursor-inherit h-full w-full"
                />
              ) : (
                <NodeShape
                  shape={shape}
                  fillColor={colorOverrides.fillColor}
                  borderColor={colorOverrides.borderColor}
                  isDark={isDark}
                  label={isEditing ? '' : node.label}
                  icon={item.icon}
                  className="cursor-inherit"
                />
              )}

              {isEditing && (
                <input
                  autoFocus
                  defaultValue={node.label}
                  onPointerDown={(event) => event.stopPropagation()}
                  onBlur={(event) => commitLabel(node.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitLabel(node.id, event.currentTarget.value)
                    if (event.key === 'Escape') setEditingNodeId(null)
                  }}
                  className="absolute inset-x-2 top-1/2 -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-center text-xs shadow focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label="Node label"
                />
              )}

              {/* Connection ports when not selected — discover on hover */}
              {!toolNode && !isSelected && !isEdgeEndpoint &&
                PORT_SIDES.map((side) => {
                  const anchor = portAnchor(portShape, side)
                  const isSnap = isSnapNode && snapTarget?.side === side
                  return (
                    <button
                      key={side}
                      type="button"
                      title={isConnectTarget ? 'Connect here' : 'Draw connection'}
                      aria-label={`${isConnectTarget ? 'Connect to' : 'Connect from'} ${node.label} (${side})`}
                      onPointerDown={(event) => handlePortPointerDown(event, node, side)}
                      style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
                      className={cn(
                        'absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-muted-foreground/60 opacity-0 transition-all duration-150 hover:!bg-sky-500 cursor-crosshair',
                        'group-hover/node:opacity-100',
                        isConnectTarget && 'opacity-100 bg-sky-400/80',
                        isSnap &&
                          'opacity-100 scale-150 bg-sky-400 shadow-[0_0_0_6px_rgba(56,189,248,0.35)]',
                      )}
                    />
                  )
                })}

              {/* Endpoint ports when a connector is selected */}
              {!toolNode && !isSelected && isEdgeEndpoint &&
                PORT_SIDES.map((side) => {
                  const anchor = portAnchor(portShape, side)
                  const isConnected = connectedPortSide === side
                  return (
                    <button
                      key={side}
                      type="button"
                      title={isConnected ? 'Current connection point' : 'Change connection point'}
                      aria-label={
                        isConnected
                          ? `Connected at ${side}`
                          : `Move connection to ${side}`
                      }
                      onPointerDown={(event) => handlePortPointerDown(event, node, side)}
                      style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
                      className={cn(
                        'absolute z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-colors hover:!bg-zinc-600',
                        isConnected
                          ? 'bg-zinc-700 opacity-100 ring-2 ring-zinc-400/40 dark:bg-zinc-300'
                          : 'bg-zinc-400/90 opacity-100 dark:bg-zinc-500',
                      )}
                    />
                  )
                })}

              {isSelected && !isEditing && !toolNode && (
                <NodeSelectionOverlay
                  shape={portShape}
                  onResizePointerDown={(event, handle) =>
                    handleResizePointerDown(event, node, item, handle)
                  }
                  onPortPointerDown={(event, side) => handlePortPointerDown(event, node, side)}
                  activePortSide={isConnectSource ? connectFrom?.side ?? null : null}
                  connectedPortSide={connectedPortSide}
                  isConnectTarget={isConnectTarget}
                  snapPortSide={isSnapNode ? snapTarget?.side ?? null : null}
                  compatibleTarget={isCompatibleTarget || isSnapNode}
                />
              )}
            </div>
          )
        })}

        {/* Connectors (above shapes so lines meet ports cleanly) */}
        <svg
          width={1}
          height={1}
          className="absolute left-0 top-0 z-20 overflow-visible"
        >
          <defs>
            <marker
              id="edge-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="currentColor" />
            </marker>
            <filter id="edge-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="edge-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {mappingLines.map((line) => (
            <line
              key={line.id}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#3b82f6"
              strokeWidth={1.5 / viewport.scale}
              strokeDasharray={`${6 / viewport.scale} ${4 / viewport.scale}`}
              strokeOpacity={0.45}
              className="pointer-events-none"
            />
          ))}
          {renderedEdges.map(({ edge, path, midpoint: labelPoint, fromPoint, toPoint }) => {
            const isSelected = isEdgeInSelection(selection, edge.id)
            const isHovered = hoveredEdgeId === edge.id && !isSelected
            const text = edge.label?.trim()
            const isEditing = editingEdgeId === edge.id
            const draggingFrom =
              reconnectEnd?.edgeId === edge.id && reconnectEnd.end === 'from'
            const draggingTo = reconnectEnd?.edgeId === edge.id && reconnectEnd.end === 'to'
            const edgeColors = resolveEdgeColors(
              { fillColor: edge.fillColor, borderColor: edge.borderColor },
              isDark,
            )
            const approvalEdge = agentMode && edgeNeedsApprovalStyle(edge)
            const baseStroke = approvalEdge ? '#8b5cf6' : edgeColors.border
            const accentStroke = isDark ? '#38bdf8' : '#0284c7'
            const stroke = isSelected ? accentStroke : isHovered ? baseStroke : baseStroke
            const strokeWidth = isSelected ? 2.75 : isHovered ? 2.25 : 1.75
            const dimmed = isConnecting && !isSelected
            // Cap label to the clear gap between ports so long text doesn't cover nodes.
            const endpointGap = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y)
            const labelWidth = connectorLabelWidth(text ?? '', endpointGap - 48, isEditing)
            const labelCharsPerLine = Math.max(8, Math.min(40, Math.floor((labelWidth - 16) / 6.5)))

            return (
            <g
              key={edge.id}
              className="transition-opacity duration-150"
              style={{
                color: stroke,
                opacity: edge.locked ? 0.85 : dimmed ? 0.35 : 1,
              }}
            >
              {(isHovered || isSelected) && (
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeOpacity={isSelected ? 0.35 : 0.22}
                  strokeWidth={strokeWidth + 4}
                  strokeLinejoin="miter"
                  strokeLinecap="butt"
                  className="pointer-events-none"
                  filter={isSelected ? 'url(#edge-glow-strong)' : 'url(#edge-glow)'}
                />
              )}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(24 / viewport.scale, 14)}
                className={cn(
                  'pointer-events-auto cursor-pointer',
                  selectionDisabled && 'pointer-events-none',
                )}
                onPointerEnter={() => setHoveredEdgeId(edge.id)}
                onPointerLeave={() =>
                  setHoveredEdgeId((current) => (current === edge.id ? null : current))
                }
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.preventDefault()
                  if (containerRef.current?.hasPointerCapture(event.pointerId)) {
                    containerRef.current.releasePointerCapture(event.pointerId)
                  }
                  sessionRef.current = null
                  setIsGrabbing(false)
                  setEdgeMenu(null)
                  // Free Backspace/Delete from sidebar search focus.
                  if (
                    document.activeElement instanceof HTMLElement &&
                    document.activeElement.closest('[aria-label="Shape palette"]')
                  ) {
                    document.activeElement.blur()
                  }
                  containerRef.current?.focus({ preventScroll: true })
                  const additive = event.shiftKey || event.metaKey || event.ctrlKey
                  onSelectionChange(
                    additive
                      ? toggleEdgeInSelection(selection, edge.id)
                      : selectSingleEdge(edge.id),
                  )
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  const ids = isEdgeInSelection(selection, edge.id)
                    ? selectedEdgeIds(selection)
                    : [edge.id]
                  if (!isEdgeInSelection(selection, edge.id)) {
                    onSelectionChange(selectSingleEdge(edge.id))
                  }
                  setEdgeMenu({ x: event.clientX, y: event.clientY, edgeIds: ids })
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  onSelectionChange(selectSingleEdge(edge.id))
                  setEditingEdgeId(edge.id)
                }}
              />
              <path
                d={path}
                fill="none"
                markerEnd="url(#edge-arrow)"
                stroke={stroke}
                strokeLinejoin="miter"
                strokeLinecap="butt"
                className={cn(
                  'pointer-events-none transition-[stroke-width] duration-150',
                  flowMotion && 'diagram-flow-edge',
                )}
                strokeWidth={strokeWidth}
                strokeDasharray={
                  flowMotion ? undefined : approvalEdge ? '6 4' : undefined
                }
                filter={isSelected || isHovered ? 'url(#edge-glow)' : undefined}
              />
              {isSelected && (
                <>
                  <circle
                    cx={fromPoint.x}
                    cy={fromPoint.y}
                    r={6}
                    className={cn(
                      'pointer-events-auto cursor-grab fill-sky-500 stroke-background stroke-2 active:cursor-grabbing dark:fill-sky-400',
                      draggingFrom && 'ring-2 ring-sky-300/60',
                      edge.locked && 'pointer-events-none opacity-50',
                    )}
                    onPointerDown={(event) =>
                      handleEndpointDragPointerDown(event, edge.id, 'from')
                    }
                  />
                  <circle
                    cx={toPoint.x}
                    cy={toPoint.y}
                    r={6}
                    className={cn(
                      'pointer-events-auto cursor-grab fill-sky-500 stroke-background stroke-2 active:cursor-grabbing dark:fill-sky-400',
                      draggingTo && 'ring-2 ring-sky-300/60',
                      edge.locked && 'pointer-events-none opacity-50',
                    )}
                    onPointerDown={(event) => handleEndpointDragPointerDown(event, edge.id, 'to')}
                  />
                </>
              )}
              {(text || isEditing) && (
                <foreignObject
                  x={labelPoint.x}
                  y={labelPoint.y}
                  width={1}
                  height={1}
                  className="pointer-events-auto overflow-visible"
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    onSelectionChange(selectSingleEdge(edge.id))
                    setEditingEdgeId(edge.id)
                  }}
                >
                  <div
                    className={cn(
                      'absolute left-0 top-0 -translate-x-1/2 transition-[width,transform] duration-150',
                      flowMotion
                        ? '-translate-y-[calc(100%+6px)]'
                        : '-translate-y-1/2',
                    )}
                    style={{ width: labelWidth }}
                  >
                    {isEditing ? (
                      <textarea
                        autoFocus
                        rows={Math.min(3, Math.max(2, (edge.label ?? '').split('\n').length))}
                        defaultValue={edge.label ?? ''}
                        onBlur={(event) => commitEdgeLabel(edge.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault()
                            commitEdgeLabel(edge.id, event.currentTarget.value)
                          }
                          if (event.key === 'Escape') setEditingEdgeId(null)
                        }}
                        className="box-border w-full resize-none border bg-background px-2 py-1 text-center text-[11px] leading-snug shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        aria-label="Connector label"
                        placeholder={'Short label on one or two lines'}
                      />
                    ) : (
                      <span
                        title={text}
                        className={cn(
                          'box-border block w-full border bg-background px-2 py-0.5 text-center text-[11px] font-medium leading-snug tracking-tight shadow-sm',
                          'whitespace-pre-line break-words',
                          isSelected && 'ring-1 ring-sky-400/40',
                        )}
                        style={{
                          backgroundColor: edgeColors.fill,
                          borderColor: isSelected ? accentStroke : edgeColors.border,
                        }}
                      >
                        {formatConnectorLabel(text ?? '', labelCharsPerLine)}
                      </span>
                    )}
                  </div>
                </foreignObject>
              )}
            </g>
            )
          })}
          {connectPreviewPath && (
            <path
              d={connectPreviewPath}
              fill="none"
              strokeDasharray="6 4"
              className="pointer-events-none stroke-sky-500 dark:stroke-sky-400"
              strokeLinejoin="miter"
              strokeLinecap="butt"
              strokeWidth={2}
              filter="url(#edge-glow)"
            />
          )}
          {reconnectPreview && (
            <path
              d={reconnectPreview}
              fill="none"
              strokeDasharray="6 4"
              className="pointer-events-none stroke-sky-500 dark:stroke-sky-400"
              strokeLinejoin="miter"
              strokeLinecap="butt"
              strokeWidth={2}
              filter="url(#edge-glow)"
            />
          )}
          {marquee && (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              fill="rgba(56, 189, 248, 0.08)"
              stroke="rgb(14, 165, 233)"
              strokeWidth={1 / viewport.scale}
              strokeDasharray={`${4 / viewport.scale} ${3 / viewport.scale}`}
              className="pointer-events-none"
            />
          )}
        </svg>
      </div>

      {edgeMenu && menuPrimaryEdge && (
        <EdgeContextMenu
          state={edgeMenu}
          routing={resolveEdgeRouting(menuPrimaryEdge.routing)}
          locked={Boolean(menuPrimaryEdge.locked)}
          onClose={() => setEdgeMenu(null)}
          onDelete={() => deleteEdgesByIds(menuEdgeIds)}
          onDuplicate={() => duplicateEdgesByIds(menuEdgeIds)}
          onCopy={() => {
            edgeClipboardRef.current = diagram.edges.filter((edge) =>
              menuEdgeIds.includes(edge.id),
            )
          }}
          onCut={() => {
            edgeClipboardRef.current = diagram.edges.filter((edge) =>
              menuEdgeIds.includes(edge.id),
            )
            deleteEdgesByIds(menuEdgeIds)
          }}
          onReverse={() => reverseEdgesByIds(menuEdgeIds)}
          onAddLabel={() => {
            const id = menuEdgeIds[0]
            if (!id) return
            onSelectionChange(selectSingleEdge(id))
            setEditingEdgeId(id)
          }}
          onToggleLock={() =>
            updateEdgesByIds(menuEdgeIds, (edge) => ({
              ...edge,
              locked: !menuPrimaryEdge.locked,
            }))
          }
          onRoutingChange={(routing) =>
            updateEdgesByIds(menuEdgeIds, (edge) => ({ ...edge, routing }))
          }
          onBringForward={() => nudgeEdgeZIndex(menuEdgeIds, 1)}
          onSendBackward={() => nudgeEdgeZIndex(menuEdgeIds, -1)}
        />
      )}

      {/* Empty state hint */}
      {diagram.nodes.length === 0 && !agentMode && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-background/70 px-8 py-6 text-center backdrop-blur-sm">
            <MousePointerClick className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Drag shapes from the left to start designing</p>
            <p className="text-xs text-muted-foreground">
              Scroll to zoom · drag the background to pan · double-click a shape to rename it
            </p>
          </div>
        </div>
      )}

      {/* Connect-mode hint */}
      {connectFrom && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border bg-background/90 px-4 py-1.5 text-xs shadow-md backdrop-blur">
          Drag to a target shape or port — magnetic snap when close ·{' '}
          <kbd className="font-mono">Esc</kbd> to cancel
        </div>
      )}

      {/* Reconnect-mode hint */}
      {reconnectEnd && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border bg-background/90 px-4 py-1.5 text-xs shadow-md backdrop-blur">
          Drop on a port or shape to reconnect — <kbd className="font-mono">Esc</kbd> to cancel
        </div>
      )}

      <div className="pointer-events-auto absolute bottom-4 right-4 z-20">
        <CanvasZoomControls
          scale={viewport.scale}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFitToScreen={onFitToScreen}
          fitToScreenDisabled={diagram.nodes.length === 0}
          flowMotion={flowMotion}
          onToggleFlowMotion={() => setFlowMotion((value) => !value)}
          flowMotionDisabled={diagram.edges.length === 0}
        />
      </div>
    </div>
  )
})
