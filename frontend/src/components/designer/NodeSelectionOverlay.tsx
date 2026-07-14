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
  { handle: 'sw', className: 'left-0 top-full cursor-nwse-resize' },
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
  connectedPortSide?: PortSide | null
  isConnectTarget: boolean
  snapPortSide?: PortSide | null
  compatibleTarget?: boolean
  /** Agent workflow: hollow vertex ports. Flowchart: chevron handles. */
  portStyle?: 'chevron' | 'vertex'
}

/** Selection chrome: resize corners + connector ports. */
export const NodeSelectionOverlay = memo(function NodeSelectionOverlay({
  shape,
  onResizePointerDown,
  onPortPointerDown,
  activePortSide,
  connectedPortSide,
  isConnectTarget,
  snapPortSide,
  compatibleTarget,
  portStyle = 'chevron',
}: NodeSelectionOverlayProps) {
  const useVertex = portStyle === 'vertex'

  return (
    <>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-10 transition-all duration-200',
          useVertex
            ? cn(
                'rounded-[10px] border border-foreground/20',
                compatibleTarget && 'border-sky-500/50 shadow-[0_0_0_3px_rgba(56,189,248,0.12)]',
              )
            : cn(
                'border border-dashed',
                compatibleTarget
                  ? 'border-sky-400/80 shadow-[0_0_0_3px_rgba(56,189,248,0.18)]'
                  : 'border-zinc-400 dark:border-zinc-500',
              ),
        )}
        aria-hidden
      />

      {RESIZE_HANDLES.map(({ handle, className }) => (
        <button
          key={handle}
          type="button"
          aria-label={`Resize ${handle}`}
          onPointerDown={(event) => onResizePointerDown(event, handle)}
          className={cn(
            'absolute z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-500 shadow-sm transition-transform hover:scale-125 dark:bg-zinc-400',
            className,
          )}
        />
      ))}

      {CONNECTOR_SIDES.map((side) => {
        const anchor = portAnchor(shape, side)
        const Icon = CONNECTOR_ICON[side]
        const isActive = activePortSide === side
        const isConnected = connectedPortSide === side
        const isSnap = snapPortSide === side
        const isOutput = side === 'right' || side === 'bottom'
        const isFlowSide = side === 'left' || side === 'right'

        return (
          <button
            key={side}
            type="button"
            title={
              isConnected
                ? 'Change connection point'
                : isConnectTarget || isSnap
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
              'absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-150',
              useVertex
                ? cn(
                    'border-[1.5px] border-[#52525B] bg-[#27272A] shadow-[0_0_0_2px_rgba(39,39,42,0.95)]',
                    isFlowSide ? 'h-3 w-3' : 'h-2.5 w-2.5',
                    'hover:scale-125 hover:border-[#A1A1AA]',
                    isActive && 'scale-125 border-[#A1A1AA]',
                    isConnected && 'border-[#A1A1AA] bg-[#A1A1AA]',
                    isSnap && 'scale-125 border-sky-400 bg-sky-500/20',
                    isConnectTarget && !isActive && !isConnected && !isSnap && 'border-[#A1A1AA]/80',
                  )
                : cn(
                    'h-4 w-4 border-2 border-white text-white shadow-md',
                    'hover:scale-125 hover:shadow-[0_0_0_4px_rgba(56,189,248,0.25)]',
                    isOutput ? 'bg-sky-500 dark:bg-sky-400' : 'bg-emerald-500 dark:bg-emerald-400',
                    isActive && 'scale-125 ring-2 ring-sky-300 ring-offset-1 ring-offset-transparent',
                    isConnected &&
                      'scale-125 bg-zinc-700 ring-2 ring-zinc-400/50 ring-offset-1 ring-offset-transparent dark:bg-zinc-300 dark:text-zinc-900',
                    isSnap &&
                      'scale-150 bg-sky-400 shadow-[0_0_0_6px_rgba(56,189,248,0.35)] ring-2 ring-sky-200',
                    isConnectTarget && !isActive && !isConnected && !isSnap && 'animate-pulse',
                  ),
            )}
          >
            {!useVertex && <Icon className="h-2.5 w-2.5 stroke-[2.5]" aria-hidden />}
          </button>
        )
      })}
    </>
  )
})

export type ResizeEdge = 'n' | 's' | 'e' | 'w'
export type FullResizeHandle = ResizeHandle | ResizeEdge
