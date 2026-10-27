import { memo, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Diagram, Viewport } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import { DesignerCanvas } from '@/components/designer/DesignerCanvas'
import { AGENT_NODE_HEIGHT, AGENT_NODE_WIDTH } from '@/components/agent-workflow/agent-workflow-defaults'
import { AGENT_DOCK_HANG } from '@/components/agent-workflow/AgentNodeCard'
import { cn } from '@/utils/cn'

const MAP_WIDTH = 168
/** The card takes the canvas's shape, within these heights. */
const MAP_MIN_HEIGHT = 84
const MAP_MAX_HEIGHT = 128
/** Never zoom the map in past this, so a small workflow still reads as a map. */
const MAP_MAX_SCALE = 0.115
/** Room around the content inside the card, in screen pixels. */
const MAP_INSET = 20

const noop = () => {}

type Rect = { x: number; y: number; width: number; height: number }

/** The canvas area the screen shows, in canvas units. */
function screenRect(viewport: Viewport, areaSize: { width: number; height: number }): Rect {
  return {
    x: -viewport.x / viewport.scale,
    y: -viewport.y / viewport.scale,
    width: areaSize.width / viewport.scale,
    height: areaSize.height / viewport.scale,
  }
}

/**
 * A top view of the whole canvas in its corner: the workflow, drawn by the canvas itself (small
 * and read-only, so it looks exactly like the canvas), and a frame for what the screen shows.
 * Drag the frame to move the view, or click anywhere on the map to jump there.
 */
export const CanvasMinimap = memo(function CanvasMinimap({
  diagram,
  paletteById,
  viewport,
  areaSize,
  onViewportChange,
}: {
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  /** The main canvas's view, drawn as the frame. */
  viewport: Viewport
  areaSize: { width: number; height: number }
  onViewportChange: (updater: (previous: Viewport) => Viewport) => void
}) {
  // Same shape as the canvas, so a screen that shows the whole workflow fills the card.
  const mapHeight =
    areaSize.width > 0
      ? Math.round(Math.min(MAP_MAX_HEIGHT, Math.max(MAP_MIN_HEIGHT, (MAP_WIDTH * areaSize.height) / areaSize.width)))
      : MAP_MIN_HEIGHT

  const screen = screenRect(viewport, areaSize)

  // The map stays put like the full image beside a zoomed product photo: it fits the workflow
  // alone (agents' hanging pills included), and only the screen's frame moves and resizes on it.
  const fitted = useMemo<Viewport>(() => {
    const rects: Rect[] = diagram.nodes.map((node) => ({
      x: node.x,
      y: node.y,
      width: node.width ?? AGENT_NODE_WIDTH,
      height: (node.height ?? AGENT_NODE_HEIGHT) + (node.agent && !node.mappedAgentId ? AGENT_DOCK_HANG : 0),
    }))
    if (rects.length === 0) return { x: MAP_WIDTH / 2, y: mapHeight / 2, scale: MAP_MAX_SCALE }
    const minX = Math.min(...rects.map((rect) => rect.x))
    const minY = Math.min(...rects.map((rect) => rect.y))
    const maxX = Math.max(...rects.map((rect) => rect.x + rect.width))
    const maxY = Math.max(...rects.map((rect) => rect.y + rect.height))
    const scale = Math.min(
      (MAP_WIDTH - MAP_INSET * 2) / Math.max(1, maxX - minX),
      (mapHeight - MAP_INSET * 2) / Math.max(1, maxY - minY),
      MAP_MAX_SCALE,
    )
    return { scale, x: MAP_WIDTH / 2 - ((minX + maxX) / 2) * scale, y: mapHeight / 2 - ((minY + maxY) / 2) * scale }
  }, [diagram.nodes, mapHeight])

  // Held for the length of a drag, so an edit landing mid-drag cannot shift the map under the pointer.
  const dragRef = useRef<{ map: Viewport; grabX: number; grabY: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const map = dragRef.current?.map ?? fitted

  const frame = {
    left: map.x + screen.x * map.scale,
    top: map.y + screen.y * map.scale,
    width: screen.width * map.scale,
    height: screen.height * map.scale,
  }
  // Drawn clipped to the card, so its border stays in sight when the view runs past the map
  // (zoomed out, or scrolled off to a side): it then hugs that edge.
  const shownLeft = Math.max(0, Math.min(MAP_WIDTH - 4, frame.left))
  const shownTop = Math.max(0, Math.min(mapHeight - 4, frame.top))
  const shownFrame = {
    left: shownLeft,
    top: shownTop,
    width: Math.max(4, Math.min(MAP_WIDTH, frame.left + frame.width) - shownLeft),
    height: Math.max(4, Math.min(mapHeight, frame.top + frame.height) - shownTop),
  }

  /** Put the screen's top-left at this map point (in card pixels). */
  const moveScreenTo = (left: number, top: number, held: Viewport) => {
    const worldX = (left - held.x) / held.scale
    const worldY = (top - held.y) / held.scale
    onViewportChange((previous) => ({ ...previous, x: -worldX * previous.scale, y: -worldY * previous.scale }))
  }

  const pointIn = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const stopDrag = () => {
    dragRef.current = null
    setDragging(false)
  }

  return (
    <div
      data-canvas-minimap
      className={cn(
        'relative overflow-hidden rounded-md border border-border bg-[hsl(var(--canvas))] shadow-[0_4px_16px_-6px_rgba(16,24,40,0.16)] dark:border-white/[0.18]',
        // The canvas copy keeps the card's background instead of painting its own.
        '[&_[role=application]]:!bg-transparent',
      )}
      style={{ width: MAP_WIDTH, height: mapHeight }}
    >
      {/* The real canvas, inert: the layer above takes every pointer */}
      <div className="pointer-events-none absolute inset-0" aria-hidden inert>
        <DesignerCanvas
          diagram={diagram}
          onChange={noop}
          paletteById={paletteById}
          viewport={map}
          onViewportChange={noop}
          selection={null}
          onSelectionChange={noop}
          snapToGrid={false}
          showGrid={false}
          onZoomIn={noop}
          onZoomOut={noop}
          agentMode
          selectionDisabled
        />
      </div>

      {/* What the screen shows: everything outside it is shaded */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute rounded-[3px] border-[1.5px] transition-colors duration-150',
          'shadow-[0_0_0_9999px_hsl(var(--foreground)/0.07)]',
          dragging ? 'border-foreground/80' : 'border-foreground/55',
        )}
        style={shownFrame}
      />

      <div
        role="button"
        tabIndex={-1}
        aria-label="Workflow map. Drag the frame or click to move the view."
        className={cn('absolute inset-0 touch-none', dragging ? 'cursor-grabbing' : 'cursor-pointer')}
        onPointerDown={(event) => {
          event.stopPropagation()
          event.currentTarget.setPointerCapture(event.pointerId)
          const point = pointIn(event)
          const inside =
            point.x >= frame.left &&
            point.x <= frame.left + frame.width &&
            point.y >= frame.top &&
            point.y <= frame.top + frame.height
          // Grabbing the frame keeps the offset; clicking elsewhere centres the frame there first.
          const grabX = inside ? point.x - frame.left : frame.width / 2
          const grabY = inside ? point.y - frame.top : frame.height / 2
          dragRef.current = { map, grabX, grabY }
          setDragging(true)
          if (!inside) moveScreenTo(point.x - grabX, point.y - grabY, map)
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag) return
          const point = pointIn(event)
          moveScreenTo(point.x - drag.grabX, point.y - drag.grabY, drag.map)
        }}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      />
    </div>
  )
})
