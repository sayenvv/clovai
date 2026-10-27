import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/utils/cn'

interface DesignerResizeHandleProps {
  side: 'left' | 'right'
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  ariaLabel?: string
  /** Show three dots in the middle of the line, the code editor's grip, so the edge reads as draggable. */
  grip?: boolean
  /** Double-clicking the line hides the panel, as in the code editor. */
  onDoubleClick?: () => void
}

/** Draggable edge handle for resizable designer panels. */
export const DesignerResizeHandle = memo(function DesignerResizeHandle({
  side,
  onPointerDown,
  ariaLabel = 'Resize panel',
  grip = false,
  onDoubleClick,
}: DesignerResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        'group/sash absolute top-0 z-10 h-full w-2 cursor-ew-resize touch-none',
        side === 'left' ? '-left-1' : '-right-1',
      )}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border transition-colors hover:bg-primary/50" />
      {grip ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-[3px] rounded-[2px] border border-border bg-[hsl(var(--chrome))] px-[2px] py-1"
        >
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-[3px] rounded-full bg-foreground/35 transition-colors group-hover/sash:bg-primary" />
          ))}
        </span>
      ) : null}
    </div>
  )
})
