import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/utils/cn'

interface DesignerResizeHandleProps {
  side: 'left' | 'right'
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  ariaLabel?: string
}

/** Draggable edge handle for resizable designer panels. */
export const DesignerResizeHandle = memo(function DesignerResizeHandle({
  side,
  onPointerDown,
  ariaLabel = 'Resize panel',
}: DesignerResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className={cn(
        'absolute top-0 z-10 h-full w-2 cursor-ew-resize touch-none',
        side === 'left' ? '-left-1' : '-right-1',
      )}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border transition-colors hover:bg-primary/50" />
    </div>
  )
})
