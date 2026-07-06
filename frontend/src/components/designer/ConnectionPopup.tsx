import { memo } from 'react'
import { GitBranch, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { EdgeRouting } from './diagram-types'

interface ConnectionPopupProps {
  screenPosition: { x: number; y: number }
  routing: EdgeRouting
  label: string
  onRoutingChange: (routing: EdgeRouting) => void
  onLabelChange: (label: string) => void
  onLabelCommit: (label: string) => void
  onClose: () => void
}

/** Floating popup shown when a connector is selected — label text and
 *  straight (90° orthogonal) vs curved routing. */
export const ConnectionPopup = memo(function ConnectionPopup({
  screenPosition,
  routing,
  label,
  onRoutingChange,
  onLabelChange,
  onLabelCommit,
  onClose,
}: ConnectionPopupProps) {
  const isStraight = routing === 'orthogonal'

  return (
    <div
      className="pointer-events-auto absolute z-20 w-56 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border bg-popover p-3 shadow-lg"
      style={{ left: screenPosition.x, top: screenPosition.y }}
      role="dialog"
      aria-label="Connector options"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-sm font-semibold">Connector</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-6 w-6"
          onClick={onClose}
          aria-label="Close connector options"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="connector-label" className="text-xs font-medium">
            Label
          </Label>
          <Input
            id="connector-label"
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            onBlur={(event) => onLabelCommit(event.target.value)}
            placeholder="e.g. Yes, No, Retry"
            className="h-8 text-xs"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="straight-connector" className="text-xs font-medium">
              Straight connector
            </Label>
            <p className="text-[11px] text-muted-foreground">90° corners only</p>
          </div>
          <Switch
            id="straight-connector"
            checked={isStraight}
            onCheckedChange={(checked) => onRoutingChange(checked ? 'orthogonal' : 'curved')}
            aria-label="Toggle straight connector"
          />
        </div>
      </div>
    </div>
  )
})
