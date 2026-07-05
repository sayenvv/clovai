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
}

const PageTab = memo(function PageTab({
  page,
  isActive,
  canDelete,
  onSelect,
  onRename,
  onDelete,
}: {
  page: DiagramPage
  isActive: boolean
  canDelete: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)

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
        className="h-6 w-24 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Page name"
      />
    )
  }

  return (
    <div
      className={cn(
        'group flex cursor-pointer select-none items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors',
        isActive
          ? 'bg-accent font-semibold text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      )}
      onClick={onSelect}
      onDoubleClick={() => setIsEditing(true)}
      role="tab"
      aria-selected={isActive}
      title="Double-click to rename"
    >
      <span className="max-w-32 truncate">{page.name}</span>
      <span className="text-[10px] tabular-nums opacity-60">{page.diagram.nodes.length}</span>
      {canDelete && (
        <button
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${page.name}`}
          className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
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
}: PagesBarProps) {
  return (
    <div
      className="flex items-center gap-1 overflow-x-auto border-t bg-background px-2 py-1"
      role="tablist"
      aria-label="Diagram pages"
    >
      {pages.map((page) => (
        <PageTab
          key={page.id}
          page={page}
          isActive={page.id === activePageId}
          canDelete={pages.length > 1}
          onSelect={() => onSelect(page.id)}
          onRename={(name) => onRename(page.id, name)}
          onDelete={() => onDelete(page.id)}
        />
      ))}

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onAdd}
        aria-label="Add page"
        title="Add page"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <span className="ml-auto shrink-0 pr-1 text-[11px] text-muted-foreground">
        {pages.length} {pages.length === 1 ? 'page' : 'pages'}
      </span>
    </div>
  )
})
