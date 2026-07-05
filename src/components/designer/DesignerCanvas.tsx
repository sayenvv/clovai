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
import { NodeShape } from './NodeShape'
import {
  buildEdgePath,
  DND_MIME,
  edgeLabelPosition,
  getNodeSize,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
  nearestSide,
  nodeSize,
  portAnchor,
  portPoint,
  resizeAspect,
  resolveNodeStyle,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type EdgeRouting,
  type PortSide,
  type ResizeAspect,
  type Viewport,
} from './diagram-types'
import { ConnectionPopup } from './ConnectionPopup'
import { clampViewportScale } from '@/constants/designer'
import type { PaletteItem } from '@/types/config'

const GRID_STEP = 12
const PORT_SIDES: PortSide[] = ['top', 'right', 'bottom', 'left']

export type Selection = { kind: 'node' | 'edge'; id: string } | null

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'
type ResizeEdge = 'n' | 's' | 'e' | 'w'
type ResizeHandle = ResizeCorner | ResizeEdge

type DragSession =
  | { type: 'pan'; startX: number; startY: number; originX: number; originY: number }
  | { type: 'node'; id: string; offsetX: number; offsetY: number }
  | {
      type: 'resize'
      id: string
      handle: ResizeHandle
      aspect: ResizeAspect
      startWorld: { x: number; y: number }
      origin: { x: number; y: number; width: number; height: number }
    }
  | null

interface PendingConnection {
  nodeId: string
  side: PortSide
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
}

let idCounter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`

const RESIZE_CORNERS: Array<{ handle: ResizeCorner; className: string }> = [
  { handle: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize' },
  { handle: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize' },
  { handle: 'sw', className: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
  { handle: 'se', className: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
]

const RESIZE_EDGES: Array<{ handle: ResizeEdge; className: string }> = [
  { handle: 'n', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize' },
  { handle: 's', className: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
  { handle: 'e', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
  { handle: 'w', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
]

function applyResize(
  handle: ResizeHandle,
  origin: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  snap: (value: number) => number,
  aspect: ResizeAspect,
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

  width = Math.max(MIN_NODE_WIDTH, width)
  height = Math.max(MIN_NODE_HEIGHT, height)

  if (aspect === 'square') {
    const size = Math.max(width, height)
    width = size
    height = size
  } else if (aspect === 'preserve') {
    const ratio = origin.width / origin.height
    const verticalHandle = handle === 'n' || handle === 's'
    if (verticalHandle) {
      width = Math.max(MIN_NODE_WIDTH, height * ratio)
      height = width / ratio
    } else {
      height = Math.max(MIN_NODE_HEIGHT, width / ratio)
      width = height * ratio
    }
    width = Math.max(MIN_NODE_WIDTH, width)
    height = Math.max(MIN_NODE_HEIGHT, height)
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
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<DragSession>(null)
  const [connectFrom, setConnectFrom] = useState<PendingConnection | null>(null)
  const [connectCursor, setConnectCursor] = useState<{ x: number; y: number } | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)

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

  const addEdge = useCallback(
    (from: PendingConnection, toNodeId: string, toSide: PortSide) => {
      if (from.nodeId === toNodeId) return
      const edge: DiagramEdge = {
        id: nextId('edge'),
        from: from.nodeId,
        to: toNodeId,
        fromSide: from.side,
        toSide,
        routing: 'curved',
      }
      onChange((previous) => {
        const exists = previous.edges.some(
          (candidate) => candidate.from === edge.from && candidate.to === edge.to,
        )
        if (exists) return previous
        return { ...previous, edges: [...previous.edges, edge] }
      })
      setConnectFrom(null)
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
        const scale = clampViewportScale(previous.scale * factor)
        const ratio = scale / previous.scale
        return {
          scale,
          x: cursorX - (cursorX - previous.x) * ratio,
          y: cursorY - (cursorY - previous.y) * ratio,
        }
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [onViewportChange])

  /* ---- keyboard: delete selection, escape cancels connect/edit ---- */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (event.key === 'Escape') {
        setConnectFrom(null)
        onSelectionChange(null)
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selection) {
        event.preventDefault()
        onChange((previous) => {
          if (selection.kind === 'edge') {
            return { ...previous, edges: previous.edges.filter((edge) => edge.id !== selection.id) }
          }
          return {
            nodes: previous.nodes.filter((node) => node.id !== selection.id),
            edges: previous.edges.filter(
              (edge) => edge.from !== selection.id && edge.to !== selection.id,
            ),
          }
        })
        onSelectionChange(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection, onChange, onSelectionChange])

  /* ---- pointer interactions ---- */
  const handleBackgroundPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return
    containerRef.current?.setPointerCapture(event.pointerId)
    sessionRef.current = {
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    }
    onSelectionChange(null)
    setConnectFrom(null)
    setEditingNodeId(null)
  }

  const handleNodePointerDown = (event: ReactPointerEvent, node: DiagramNode, item: PaletteItem) => {
    if (event.button !== 0) return
    event.stopPropagation()

    // Completing a pending connection: attach to the side nearest the cursor.
    if (connectFrom && connectFrom.nodeId !== node.id) {
      const world = toWorld(event.clientX, event.clientY)
      addEdge(connectFrom, node.id, nearestSide(node, resolveNodeStyle(node, item).shape, world))
      return
    }

    containerRef.current?.setPointerCapture(event.pointerId)
    const world = toWorld(event.clientX, event.clientY)
    sessionRef.current = {
      type: 'node',
      id: node.id,
      offsetX: world.x - node.x,
      offsetY: world.y - node.y,
    }
    onSelectionChange({ kind: 'node', id: node.id })
  }

  const handlePortPointerDown = (event: ReactPointerEvent, node: DiagramNode, side: PortSide) => {
    event.stopPropagation()
    if (connectFrom && connectFrom.nodeId !== node.id) {
      // Clicking a specific port on another node completes the connection there.
      addEdge(connectFrom, node.id, side)
      return
    }
    setConnectFrom({ nodeId: node.id, side })
    setConnectCursor(toWorld(event.clientX, event.clientY))
  }

  const handleResizePointerDown = (
    event: ReactPointerEvent,
    node: DiagramNode,
    item: PaletteItem,
    handle: ResizeHandle,
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
      startWorld: toWorld(event.clientX, event.clientY),
      origin: { x: node.x, y: node.y, width, height },
    }
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (connectFrom) setConnectCursor(toWorld(event.clientX, event.clientY))

    const session = sessionRef.current
    if (!session) return

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
      const { id, offsetX, offsetY } = session
      const x = snap(world.x - offsetX)
      const y = snap(world.y - offsetY)
      onChange((previous) => ({
        ...previous,
        nodes: previous.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
      }))
      return
    }

    // Resize: adjust the dragged handle, keeping the opposite edge anchored.
    const { id, handle, aspect, startWorld, origin } = session
    const dx = world.x - startWorld.x
    const dy = world.y - startWorld.y
    const next = applyResize(handle, origin, dx, dy, snap, aspect)

    onChange((previous) => ({
      ...previous,
      nodes: previous.nodes.map((node) =>
        node.id === id ? { ...node, ...next } : node,
      ),
    }))
  }

  const handlePointerUp = () => {
    sessionRef.current = null
  }

  /* ---- palette drop ---- */
  const handleDrop = (event: ReactDragEvent) => {
    event.preventDefault()
    const paletteId = event.dataTransfer.getData(DND_MIME)
    const item = paletteById.get(paletteId)
    if (!item) return
    const world = toWorld(event.clientX, event.clientY)
    const { width, height } = nodeSize(item.shape)
    const node: DiagramNode = {
      id: nextId('node'),
      paletteId,
      label: item.label,
      x: snap(world.x - width / 2),
      y: snap(world.y - height / 2),
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

  const renderedEdges = useMemo(
    () =>
      diagram.edges.flatMap((edge) => {
        const from = nodesById.get(edge.from)
        const to = nodesById.get(edge.to)
        const fromItem = from && paletteById.get(from.paletteId)
        const toItem = to && paletteById.get(to.paletteId)
        if (!from || !to || !fromItem || !toItem) return []
        const routing = edge.routing ?? 'curved'
        const fromPoint = portPoint(from, resolveNodeStyle(from, fromItem).shape, edge.fromSide)
        const toPoint = portPoint(to, resolveNodeStyle(to, toItem).shape, edge.toSide)
        return [
          {
            edge,
            routing,
            fromPoint,
            toPoint,
            midpoint: edgeLabelPosition(fromPoint, edge.fromSide, toPoint, edge.toSide, routing),
            path: buildEdgePath(fromPoint, edge.fromSide, toPoint, edge.toSide, routing),
          },
        ]
      }),
    [diagram.edges, nodesById, paletteById],
  )

  const selectedEdgePopup = useMemo(() => {
    if (selection?.kind !== 'edge') return null
    const rendered = renderedEdges.find(({ edge }) => edge.id === selection.id)
    if (!rendered) return null
    const mid = rendered.midpoint
    return {
      edge: rendered.edge,
      routing: rendered.routing,
      label: rendered.edge.label ?? '',
      screenPosition: {
        x: mid.x * viewport.scale + viewport.x,
        y: mid.y * viewport.scale + viewport.y,
      },
    }
  }, [selection, renderedEdges, viewport])

  const updateEdgeRouting = useCallback(
    (edgeId: string, routing: EdgeRouting) => {
      onChange((previous) => ({
        ...previous,
        edges: previous.edges.map((edge) => (edge.id === edgeId ? { ...edge, routing } : edge)),
      }))
    },
    [onChange],
  )

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      onChange((previous) => ({
        ...previous,
        edges: previous.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, label: label.length > 0 ? label : undefined } : edge,
        ),
      }))
    },
    [onChange],
  )

  const commitEdgeLabelValue = useCallback(
    (edgeId: string, label: string) => {
      const trimmed = label.trim()
      onChange((previous) => ({
        ...previous,
        edges: previous.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, label: trimmed.length > 0 ? trimmed : undefined } : edge,
        ),
      }))
    },
    [onChange],
  )

  const connectSourceNode = connectFrom ? nodesById.get(connectFrom.nodeId) : undefined
  const connectSourceItem = connectSourceNode
    ? paletteById.get(connectSourceNode.paletteId)
    : undefined

  const gridSize = 24 * viewport.scale

  return (
    <div
      ref={containerRef}
      className="relative h-full flex-1 touch-none overflow-hidden bg-[hsl(var(--canvas))]"
      style={{
        backgroundImage: showGrid
          ? 'radial-gradient(circle, hsl(var(--canvas-grid)) 1px, transparent 1px)'
          : undefined,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        cursor: connectFrom ? 'crosshair' : undefined,
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
        {/* Edges */}
        <svg width={1} height={1} className="absolute left-0 top-0 overflow-visible">
          <defs>
            <marker
              id="edge-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
            </marker>
          </defs>
          {renderedEdges.map(({ edge, path, midpoint: labelPoint }) => {
            const isSelected = selection?.kind === 'edge' && selection.id === edge.id
            const text = edge.label?.trim()
            const isEditing = editingEdgeId === edge.id

            return (
            <g key={edge.id}>
              {/* Fat invisible hit area for easy selection */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={14 / viewport.scale}
                className="cursor-pointer"
                onPointerDown={(event) => {
                  event.stopPropagation()
                  onSelectionChange({ kind: 'edge', id: edge.id })
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  onSelectionChange({ kind: 'edge', id: edge.id })
                  setEditingEdgeId(edge.id)
                }}
              />
              <path
                d={path}
                fill="none"
                markerEnd="url(#edge-arrow)"
                className={cn(
                  'pointer-events-none stroke-muted-foreground',
                  isSelected && 'stroke-primary',
                )}
                strokeWidth={isSelected ? 2.5 : 1.75}
              />
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
                    onSelectionChange({ kind: 'edge', id: edge.id })
                    setEditingEdgeId(edge.id)
                  }}
                >
                  <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2">
                    {isEditing ? (
                      <input
                        autoFocus
                        defaultValue={edge.label ?? ''}
                        onBlur={(event) => commitEdgeLabel(edge.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            commitEdgeLabel(edge.id, event.currentTarget.value)
                          }
                          if (event.key === 'Escape') setEditingEdgeId(null)
                        }}
                        className="min-w-[4rem] max-w-40 rounded border bg-background px-1.5 py-0.5 text-center text-[11px] shadow focus:outline-none focus:ring-1 focus:ring-primary"
                        aria-label="Connector label"
                      />
                    ) : (
                      <span
                        className={cn(
                          'inline-block whitespace-nowrap rounded border bg-background px-1.5 py-0.5 text-[11px] font-medium leading-tight shadow-sm',
                          isSelected && 'border-primary ring-1 ring-primary/30',
                        )}
                      >
                        {text}
                      </span>
                    )}
                  </div>
                </foreignObject>
              )}
            </g>
            )
          })}
          {connectSourceNode && connectSourceItem && connectFrom && connectCursor && (
            <path
              d={buildEdgePath(
                portPoint(
                  connectSourceNode,
                  resolveNodeStyle(connectSourceNode, connectSourceItem).shape,
                  connectFrom.side,
                ),
                connectFrom.side,
                connectCursor,
                'left',
                'curved',
              )}
              fill="none"
              strokeDasharray="6 4"
              className="pointer-events-none stroke-primary"
              strokeWidth={1.75}
            />
          )}
        </svg>

        {/* Nodes */}
        {diagram.nodes.map((node) => {
          const item = paletteById.get(node.paletteId)
          if (!item) return null
          const { shape, color } = resolveNodeStyle(node, item)
          const { width, height } = getNodeSize(node, shape)
          const isSelected = selection?.kind === 'node' && selection.id === node.id
          const isEditing = editingNodeId === node.id
          const isConnectSource = connectFrom?.nodeId === node.id
          const isConnectTarget = Boolean(connectFrom) && !isConnectSource

          return (
            <div
              key={node.id}
              className="group/node absolute cursor-grab select-none active:cursor-grabbing"
              style={{ left: node.x, top: node.y, width, height }}
              onPointerDown={(event) => handleNodePointerDown(event, node, item)}
              onDoubleClick={(event) => {
                event.stopPropagation()
                setEditingNodeId(node.id)
              }}
            >
              <NodeShape
                shape={shape}
                color={color}
                label={isEditing ? '' : node.label}
                selected={isSelected}
              />

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

              {/* Connection ports, anchored to the actual shape outline */}
              {PORT_SIDES.map((side) => {
                const anchor = portAnchor(shape, side)
                return (
                  <button
                    key={side}
                    title={isConnectTarget ? 'Connect here' : 'Draw connection'}
                    aria-label={`${isConnectTarget ? 'Connect to' : 'Connect from'} ${node.label} (${side})`}
                    onPointerDown={(event) => handlePortPointerDown(event, node, side)}
                    style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
                    className={cn(
                      'absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-muted-foreground/60 opacity-0 transition-opacity hover:!bg-primary',
                      'group-hover/node:opacity-100',
                      (isSelected || isConnectTarget) && 'opacity-100',
                      isConnectSource && connectFrom?.side === side && 'bg-primary opacity-100',
                      isConnectTarget && 'bg-primary/50',
                    )}
                  />
                )
              })}

              {/* Resize handles: corners + edge midpoints */}
              {isSelected &&
                !isEditing && (
                  <>
                    {RESIZE_EDGES.map(({ handle, className }) => (
                      <div
                        key={handle}
                        role="presentation"
                        aria-hidden
                        onPointerDown={(event) => handleResizePointerDown(event, node, item, handle)}
                        className={cn(
                          'absolute z-20 rounded-sm border border-primary bg-background shadow-sm',
                          handle === 'n' || handle === 's' ? 'h-2 w-7' : 'h-7 w-2',
                          className,
                        )}
                      />
                    ))}
                    {RESIZE_CORNERS.map(({ handle, className }) => (
                      <div
                        key={handle}
                        role="presentation"
                        aria-hidden
                        onPointerDown={(event) => handleResizePointerDown(event, node, item, handle)}
                        className={cn(
                          'absolute z-20 h-2.5 w-2.5 rounded-[3px] border border-primary bg-background shadow-sm',
                          className,
                        )}
                      />
                    ))}
                  </>
                )}
            </div>
          )
        })}
      </div>

      {/* Connector options popup */}
      {selectedEdgePopup && (
        <ConnectionPopup
          screenPosition={selectedEdgePopup.screenPosition}
          routing={selectedEdgePopup.routing}
          label={selectedEdgePopup.label}
          onRoutingChange={(routing) => updateEdgeRouting(selectedEdgePopup.edge.id, routing)}
          onLabelChange={(label) => updateEdgeLabel(selectedEdgePopup.edge.id, label)}
          onLabelCommit={(label) => commitEdgeLabelValue(selectedEdgePopup.edge.id, label)}
          onClose={() => onSelectionChange(null)}
        />
      )}

      {/* Empty state hint */}
      {diagram.nodes.length === 0 && (
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
          Click a target shape (or one of its ports) to connect — <kbd className="font-mono">Esc</kbd>{' '}
          to cancel
        </div>
      )}
    </div>
  )
})
