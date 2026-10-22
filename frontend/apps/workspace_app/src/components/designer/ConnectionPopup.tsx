import { memo } from 'react'
import { GitBranch, Lock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { EDGE_ROUTING_OPTIONS, type EdgeRouting } from './diagram-types'

interface ConnectionPopupProps {
  screenPosition: { x: number; y: number }
  routing: EdgeRouting
  label: string
  locked?: boolean
  onRoutingChange: (routing: EdgeRouting) => void
  onLabelChange: (label: string) => void
  onLabelCommit: (label: string) => void
  onLockedChange?: (locked: boolean) => void
  onClose: () => void
}

/** Floating popup shown when a connector is selected. */
export const ConnectionPopup = memo(function ConnectionPopup({
  screenPosition,
  routing,
  label,
  locked = false,
  onRoutingChange,
  onLabelChange,
  onLabelCommit,
  onLockedChange,
  onClose,
}: ConnectionPopupProps) {
  return (
    <div
      className="pointer-events-auto absolute z-20 w-60 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border bg-popover p-3 shadow-xl"
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="connector-routing" className="text-xs font-medium">
            Routing
          </Label>
          <Select
            id="connector-routing"
            value={routing}
            onChange={(event) => onRoutingChange(event.target.value as EdgeRouting)}
            className="h-8 text-xs"
            aria-label="Connector routing"
          >
            {EDGE_ROUTING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {onLockedChange && (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0">
                <Label htmlFor="lock-connector" className="text-xs font-medium">
                  Lock connector
                </Label>
                <p className="text-[11px] text-muted-foreground">Keep anchors fixed</p>
              </div>
            </div>
            <Switch
              id="lock-connector"
              checked={locked}
              onCheckedChange={onLockedChange}
              aria-label="Lock connector"
            />
          </div>
        )}
      </div>
    </div>
  )
})
