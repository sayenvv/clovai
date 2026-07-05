import { memo, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface DesignerPanelHeaderProps {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  badge?: ReactNode
  onClose?: () => void
  closeLabel?: string
  className?: string
}

/** Shared header for designer side panels (properties, code export, etc.). */
export const DesignerPanelHeader = memo(function DesignerPanelHeader({
  icon,
  title,
  description,
  badge,
  onClose,
  closeLabel = 'Close panel',
  className,
}: DesignerPanelHeaderProps) {
  return (
    <div className={cn('flex items-start gap-2 border-b px-4 py-3', className)}>
      <span className="mt-0.5 shrink-0 text-primary" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {badge}
        </div>
        {description && (
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</div>
        )}
      </div>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
})
