import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { cn } from '@/utils/cn'
import { portAnchor, type PortSide } from './diagram-types'
import type { PaletteShape } from '@/types/config'

export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'
export type ResizeHandle = ResizeCorner

const RESIZE_HANDLES: Array<{ handle: ResizeCorner; className: string }> = [
  { handle: 'nw', className: 'left-0 top-0 cursor-nwse-resize' },
  { handle: 'ne', className: 'left-full top-0 cursor-nesw-resize' },
  { handle: 'se', className: 'left-full top-full cursor-nwse-resize' },
  { handle: 'sw', className: 'left-0 top-full cursor-nesw-resize' },
]

const CONNECTOR_SIDES: PortSide[] = ['top', 'right', 'bottom', 'left']

const CONNECTOR_ICON: Record<PortSide, typeof ChevronUp> = {
  top: ChevronUp,
  right: ChevronRight,
  bottom: ChevronDown,
  left: ChevronLeft,
}

interface NodeSelectionOverlayProps {
  shape: PaletteShape
  onResizePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: ResizeHandle,
  ) => void
  onPortPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, side: PortSide) => void
  activePortSide?: PortSide | null
  /** Port currently used by a selected connector on this shape. */
  connectedPortSide?: PortSide | null
  isConnectTarget: boolean
}

/** Figma / draw.io style selection: dashed box, corner resize, edge connector arrows. */
export const NodeSelectionOverlay = memo(function NodeSelectionOverlay({
  shape,
  onResizePointerDown,
  onPortPointerDown,
  activePortSide,
  connectedPortSide,
  isConnectTarget,
}: NodeSelectionOverlayProps) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-10 border border-dashed border-zinc-400 dark:border-zinc-500"
        aria-hidden
      />

      {RESIZE_HANDLES.map(({ handle, className }) => (
        <button
          key={handle}
          type="button"
          aria-label={`Resize ${handle}`}
          onPointerDown={(event) => onResizePointerDown(event, handle)}
          className={cn(
            'absolute z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-500 shadow-sm dark:bg-zinc-400',
            className,
          )}
        />
      ))}

      {CONNECTOR_SIDES.map((side) => {
        const anchor = portAnchor(shape, side)
        const Icon = CONNECTOR_ICON[side]
        const isActive = activePortSide === side
        const isConnected = connectedPortSide === side

        return (
          <button
            key={side}
            type="button"
            title={
              isConnected
                ? 'Change connection point'
                : isConnectTarget
                  ? 'Connect here'
                  : 'Drag to connect'
            }
            aria-label={
              isConnected
                ? `Change connection to ${side}`
                : isConnectTarget
                  ? `Connect to ${side}`
                  : `Connect from ${side}`
            }
            onPointerDown={(event) => onPortPointerDown(event, side)}
            style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }}
            className={cn(
              'absolute z-30 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-zinc-500 text-white shadow-sm transition-transform hover:scale-110 dark:bg-zinc-400',
              isActive && 'scale-110 ring-2 ring-zinc-300 ring-offset-1 ring-offset-transparent dark:ring-zinc-600',
              isConnected && 'scale-110 bg-zinc-700 ring-2 ring-zinc-400/50 ring-offset-1 ring-offset-transparent dark:bg-zinc-300 dark:text-zinc-900',
              isConnectTarget && !isActive && !isConnected && 'bg-zinc-400 dark:bg-zinc-500',
            )}
          >
            <Icon className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden />
          </button>
        )
      })}
    </>
  )
})

/** Resize handles used by applyResize — includes edges for programmatic use. */
export type ResizeEdge = 'n' | 's' | 'e' | 'w'
export type FullResizeHandle = ResizeHandle | ResizeEdge
