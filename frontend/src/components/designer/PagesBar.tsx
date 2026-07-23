import { memo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import type { DiagramPage } from './diagram-types'

interface PagesBarProps {
  pages: DiagramPage[]
  activePageId: string
  onSelect: (pageId: string) => void
  onAdd: () => void
  onRename: (pageId: string, name: string) => void
  onDelete: (pageId: string) => void
  /** Larger touch targets + clearer chrome for phone layouts. */
  density?: 'compact' | 'comfortable'
}

const PageTab = memo(function PageTab({
  page,
  isActive,
  canDelete,
  density,
  onSelect,
  onRename,
  onDelete,
}: {
  page: DiagramPage
  isActive: boolean
  canDelete: boolean
  density: 'compact' | 'comfortable'
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const comfortable = density === 'comfortable'

  const commit = (value: string) => {
    const name = value.trim()
    if (name) onRename(name)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        defaultValue={page.name}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value)
          if (event.key === 'Escape') setIsEditing(false)
        }}
        className={cn(
          'rounded-md border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary',
          comfortable ? 'h-9 w-32 text-sm' : 'h-6 w-24 text-xs',
        )}
        aria-label="Page name"
      />
    )
  }

  return (
    <div
      className={cn(
        'group flex cursor-pointer select-none items-center gap-1.5 rounded-lg transition-colors',
        comfortable ? 'min-h-9 px-3 py-1.5 text-sm' : 'rounded-md px-2.5 py-1 text-xs',
        isActive
          ? 'bg-accent font-semibold text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
      onClick={onSelect}
      onDoubleClick={() => setIsEditing(true)}
      role="tab"
      aria-selected={isActive}
      title="Double-click to rename"
    >
      <span className={cn('truncate', comfortable ? 'max-w-40' : 'max-w-32')}>{page.name}</span>
      <span className="text-[10px] tabular-nums opacity-60">{page.diagram.nodes.length}</span>
      {canDelete && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${page.name}`}
          className={cn(
            'ml-0.5 rounded p-0.5 transition-opacity hover:bg-background hover:text-destructive',
            comfortable
              ? 'opacity-70'
              : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <X className={comfortable ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
        </button>
      )}
    </div>
  )
})

/** Bottom sheet-tab bar for switching between diagram pages. */
export const PagesBar = memo(function PagesBar({
  pages,
  activePageId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  density = 'compact',
}: PagesBarProps) {
  const comfortable = density === 'comfortable'

  return (
    <div
      className={cn(
        'relative z-20 flex shrink-0 items-center gap-1.5 overflow-x-auto border-t bg-card',
        comfortable
          ? 'gap-2 border-border/80 px-3 py-2.5 shadow-[0_-6px_18px_-12px_rgba(0,0,0,0.35)]'
          : 'bg-background px-2 py-1',
      )}
      role="tablist"
      aria-label="Workflow tabs"
    >
      {pages.map((page) => (
        <PageTab
          key={page.id}
          page={page}
          isActive={page.id === activePageId}
          canDelete={pages.length > 1}
          density={density}
          onSelect={() => onSelect(page.id)}
          onRename={(name) => onRename(page.id, name)}
          onDelete={() => onDelete(page.id)}
        />
      ))}

      <Button
        type="button"
        variant={comfortable ? 'secondary' : 'ghost'}
        size="icon"
        className={cn('shrink-0', comfortable ? 'h-9 w-9 rounded-lg' : 'h-6 w-6')}
        onClick={onAdd}
        aria-label="Add workflow tab"
        title="New workflow tab"
      >
        <Plus className={comfortable ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </Button>

      <span
        className={cn(
          'ml-auto shrink-0 pr-1 text-muted-foreground',
          comfortable ? 'text-xs font-medium' : 'text-[11px]',
        )}
      >
        {pages.length} {pages.length === 1 ? 'workflow' : 'workflows'}
      </span>
    </div>
  )
})
