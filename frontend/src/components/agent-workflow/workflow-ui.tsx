import { memo, type ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'

/** Pill filter for catalog dialogs. */
export const CatalogFilterChip = memo(function CatalogFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      className={cn('h-7 rounded-full px-3 text-xs', !active && 'bg-background')}
      onClick={onClick}
    >
      {children}
    </Button>
  )
})

/** Empty catalog search result. */
export const CatalogEmptyState = memo(function CatalogEmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
      {message}
    </p>
  )
})

/** Reusable sidebar section header. */
export const SidebarSection = memo(function SidebarSection({
  title,
  subtitle,
  count,
  action,
  collapsed,
  onToggle,
}: {
  title: string
  subtitle?: string
  count?: number
  action?: ReactNode
  collapsed?: boolean
  onToggle?: () => void
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-start gap-1.5">
        {onToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-1 h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onToggle}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
            title={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        )}
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {count !== undefined && (
        <Badge variant="outline" className="h-5 shrink-0 text-[10px] font-normal tabular-nums">
          {count}
        </Badge>
      )}
      {action}
    </div>
  )
})

/** Empty state when no workflow tabs exist yet. */
export const WorkflowEmptyHint = memo(function WorkflowEmptyHint({
  onCreateTab,
  compact = false,
}: {
  onCreateTab?: () => void
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-indigo-500/25 bg-indigo-500/5 text-center',
        compact ? 'px-3 py-4' : 'px-4 py-8',
      )}
    >
      <p className={cn('font-medium text-foreground', compact ? 'text-[11px]' : 'text-sm')}>
        No other workflows yet
      </p>
      <p className={cn('mt-1 text-muted-foreground', compact ? 'text-[10px] leading-relaxed' : 'text-xs')}>
        Create a workflow in a new tab, build it there, then mount it here.
      </p>
      {onCreateTab && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn('gap-1.5', compact ? 'mt-3 h-8 text-xs' : 'mt-4')}
          onClick={onCreateTab}
        >
          <Plus className="h-3.5 w-3.5" />
          New workflow tab
        </Button>
      )}
    </div>
  )
})
