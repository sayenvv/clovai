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
  DND_MIME,
  nearestSide,
  nodeSize,
  portPoint,
  SIDE_DIRECTION,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type PortSide,
  type Viewport,
} from './diagram-types'
import type { PaletteItem } from '@/types/config'

const MIN_SCALE = 0.4
const MAX_SCALE = 2.5
const PORT_SIDES: PortSide[] = ['top', 'right', 'bottom', 'left']

type Selection = { kind: 'node' | 'edge'; id: string } | null

type DragSession =
  | { type: 'pan'; startX: number; startY: number; originX: number; originY: number }
  | { type: 'node'; id: string; offsetX: number; offsetY: number }
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
}

let idCounter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`

function edgePath(
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

const PORT_POSITION_CLASSES: Record<PortSide, string> = {
  top: '-top-1.5 left-1/2 -translate-x-1/2',
  right: '-right-1.5 top-1/2 -translate-y-1/2',
  bottom: '-bottom-1.5 left-1/2 -translate-x-1/2',
  left: '-left-1.5 top-1/2 -translate-y-1/2',
}

export const DesignerCanvas = memo(function DesignerCanvas({
  diagram,
  onChange,
  paletteById,
  viewport,
  onViewportChange,
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<DragSession>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [connectFrom, setConnectFrom] = useState<PendingConnection | null>(null)
  const [connectCursor, setConnectCursor] = useState<{ x: number; y: number } | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

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
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, previous.scale * factor))
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
        setSelection(null)
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
        setSelection(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection, onChange])

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
    setSelection(null)
    setConnectFrom(null)
    setEditingNodeId(null)
  }

  const handleNodePointerDown = (event: ReactPointerEvent, node: DiagramNode, item: PaletteItem) => {
    if (event.button !== 0) return
    event.stopPropagation()

    // Completing a pending connection: attach to the side nearest the cursor.
    if (connectFrom && connectFrom.nodeId !== node.id) {
      const world = toWorld(event.clientX, event.clientY)
      addEdge(connectFrom, node.id, nearestSide(node, item.shape, world))
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
    setSelection({ kind: 'node', id: node.id })
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
    } else {
      const world = toWorld(event.clientX, event.clientY)
      const { id, offsetX, offsetY } = session
      onChange((previous) => ({
        ...previous,
        nodes: previous.nodes.map((node) =>
          node.id === id ? { ...node, x: world.x - offsetX, y: world.y - offsetY } : node,
        ),
      }))
    }
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
      x: world.x - width / 2,
      y: world.y - height / 2,
    }
    onChange((previous) => ({ ...previous, nodes: [...previous.nodes, node] }))
    setSelection({ kind: 'node', id: node.id })
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
        return [
          {
            edge,
            path: edgePath(
              portPoint(from, fromItem.shape, edge.fromSide),
              edge.fromSide,
              portPoint(to, toItem.shape, edge.toSide),
              edge.toSide,
            ),
          },
        ]
      }),
    [diagram.edges, nodesById, paletteById],
  )

  const connectSourceNode = connectFrom ? nodesById.get(connectFrom.nodeId) : undefined
  const connectSourceItem = connectSourceNode
    ? paletteById.get(connectSourceNode.paletteId)
    : undefined

  const gridSize = 24 * viewport.scale

  return (
    <div
      ref={containerRef}
      className="relative h-full flex-1 touch-none overflow-hidden bg-background"
      style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
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
          {renderedEdges.map(({ edge, path }) => (
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
                  setSelection({ kind: 'edge', id: edge.id })
                }}
              />
              <path
                d={path}
                fill="none"
                markerEnd="url(#edge-arrow)"
                className={cn(
                  'pointer-events-none stroke-muted-foreground',
                  selection?.kind === 'edge' && selection.id === edge.id && 'stroke-primary',
                )}
                strokeWidth={selection?.kind === 'edge' && selection.id === edge.id ? 2.5 : 1.75}
              />
            </g>
          ))}
          {connectSourceNode && connectSourceItem && connectFrom && connectCursor && (
            <path
              d={edgePath(
                portPoint(connectSourceNode, connectSourceItem.shape, connectFrom.side),
                connectFrom.side,
                connectCursor,
                'left',
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
          const { width, height } = nodeSize(item.shape)
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
                shape={item.shape}
                color={item.color}
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

              {/* Connection ports on all four sides */}
              {PORT_SIDES.map((side) => (
                <button
                  key={side}
                  title={isConnectTarget ? 'Connect here' : 'Draw connection'}
                  aria-label={`${isConnectTarget ? 'Connect to' : 'Connect from'} ${node.label} (${side})`}
                  onPointerDown={(event) => handlePortPointerDown(event, node, side)}
                  className={cn(
                    'absolute z-10 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/60 opacity-0 transition-all hover:!scale-125 hover:!bg-primary',
                    PORT_POSITION_CLASSES[side],
                    'group-hover/node:opacity-100',
                    (isSelected || isConnectTarget) && 'opacity-100',
                    isConnectSource && connectFrom?.side === side && 'scale-125 bg-primary opacity-100',
                    isConnectTarget && 'bg-primary/50',
                  )}
                />
              ))}
            </div>
          )
        })}
      </div>

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
