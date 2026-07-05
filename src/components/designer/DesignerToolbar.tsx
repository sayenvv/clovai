import { memo } from 'react'
import { Download, Eraser, Maximize, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DesignerToolbarProps {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onClear: () => void
  onExport: () => void
  isEmpty: boolean
}

/** Top toolbar of the designer workspace. */
export const DesignerToolbar = memo(function DesignerToolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onResetView,
  onClear,
  onExport,
  isEmpty,
}: DesignerToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b bg-background px-3 py-1.5">
      <Button variant="ghost" size="icon" onClick={onZoomOut} aria-label="Zoom out">
        <ZoomOut />
      </Button>
      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon" onClick={onZoomIn} aria-label="Zoom in">
        <ZoomIn />
      </Button>
      <Button variant="ghost" size="icon" onClick={onResetView} aria-label="Reset view">
        <Maximize />
      </Button>

      <div className="mx-2 h-5 w-px bg-border" aria-hidden />

      <Button variant="ghost" size="sm" onClick={onClear} disabled={isEmpty}>
        <Eraser /> Clear
      </Button>
      <Button variant="ghost" size="sm" onClick={onExport} disabled={isEmpty}>
        <Download /> Export JSON
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="gradient" className="hidden sm:inline-flex">
          Coming soon
        </Badge>
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Clovai Engine — multi-agent AI generation, launching soon"
        >
          <Sparkles /> Generate with AI
        </Button>
      </div>
    </div>
  )
})
