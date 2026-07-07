import { memo } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CanvasZoomControlsProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
}

/** Floating zoom controls for canvas overlays. */
export const CanvasZoomControls = memo(function CanvasZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
}: CanvasZoomControlsProps) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-0.5 rounded-lg border bg-background/90 p-0.5 shadow-md backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut} aria-label="Zoom out">
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn} aria-label="Zoom in">
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
})
