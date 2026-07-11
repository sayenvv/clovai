import { memo } from 'react'
import { Play, Scan, Square, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface CanvasZoomControlsProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  /** Fit all content in view, centered on screen. */
  onFitToScreen?: () => void
  fitToScreenDisabled?: boolean
  /** Animate connectors as a flowing diagram. */
  flowMotion?: boolean
  onToggleFlowMotion?: () => void
  flowMotionDisabled?: boolean
}

/** Floating zoom controls for canvas overlays. */
export const CanvasZoomControls = memo(function CanvasZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  fitToScreenDisabled = false,
  flowMotion = false,
  onToggleFlowMotion,
  flowMotionDisabled = false,
}: CanvasZoomControlsProps) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-0.5 rounded-lg border bg-background/90 p-0.5 shadow-md backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {onToggleFlowMotion && (
        <>
          <Button
            variant={flowMotion ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('h-7 gap-1.5 px-2 text-[11px]', flowMotion && 'text-primary')}
            onClick={onToggleFlowMotion}
            disabled={flowMotionDisabled}
            aria-pressed={flowMotion}
            aria-label={flowMotion ? 'Stop flow animation' : 'Play flow animation'}
            title={
              flowMotionDisabled
                ? 'Add connectors to animate flow'
                : flowMotion
                  ? 'Stop flow animation'
                  : 'Animate connectors as a flow diagram'
            }
          >
            {flowMotion ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span className="hidden sm:inline">{flowMotion ? 'Stop' : 'Flow'}</span>
          </Button>
          <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
        </>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut} aria-label="Zoom out">
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn} aria-label="Zoom in">
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>
      {onFitToScreen && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onFitToScreen}
          disabled={fitToScreenDisabled}
          aria-label="Fit to screen"
          title="Fit content to screen"
        >
          <Scan className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
})
