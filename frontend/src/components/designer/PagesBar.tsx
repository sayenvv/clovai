import { memo, useState } from 'react'
import { Check, GitBranch, MoreHorizontal, Plus, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  groupWorkflowPages,
  resolveActiveMainPageId,
  type DiagramPage,
} from './diagram-types'

interface PagesBarProps {
  pages: DiagramPage[]
  activePageId: string
  onSelect: (pageId: string) => void
  onAdd?: () => void
  onRename: (pageId: string, name: string) => void
  onDelete: (pageId: string) => void
  onSetActiveMain?: (pageId: string) => void
  onAddSubToMain?: (pageId: string) => void
  activeMainPageId?: string
  density?: 'compact' | 'comfortable'
}

const PageTab = memo(function PageTab({
  page,
  isActive,
  isCurrentMain,
  canDelete,
  density,
  variant,
  inGroup = false,
  onSelect,
  onRename,
  onDelete,
  onSetActive,
  onAddSubToMain,
}: {
  page: DiagramPage
  isActive: boolean
  isCurrentMain?: boolean
  canDelete: boolean
  density: 'compact' | 'comfortable'
  variant: 'main' | 'sub'
  inGroup?: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onSetActive?: () => void
  onAddSubToMain?: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const comfortable = density === 'comfortable'
  const isSub = variant === 'sub'
  const showAsMain = !isSub && Boolean(isCurrentMain)
  const hasMenu = Boolean(onSetActive || onAddSubToMain)

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
          'rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none ring-1 ring-foreground/10',
          comfortable ? 'h-8 w-36' : 'h-7 w-32',
        )}
        aria-label="Page name"
      />
    )
  }

  return (
    <div
      className={cn(
        'relative flex shrink-0 cursor-pointer select-none items-center gap-1.5 px-2.5 transition-colors',
        comfortable ? 'text-[13px]' : 'text-xs',
        inGroup ? 'h-7 rounded-md' : 'h-full',
        isActive
          ? inGroup
            ? 'bg-background font-medium text-foreground shadow-sm ring-1 ring-border'
            : 'h-full bg-background font-medium text-foreground after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:rounded-b-full after:bg-foreground'
          : inGroup
            ? 'text-muted-foreground hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]'
            : 'text-muted-foreground/70 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]',
      )}
      onClick={onSelect}
      onDoubleClick={() => setIsEditing(true)}
      role="tab"
      aria-selected={isActive}
      aria-current={showAsMain ? 'true' : undefined}
      title="Double-click to rename"
    >
      {isSub ? (
        <GitBranch className="h-3 w-3 shrink-0 opacity-60" />
      ) : (
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            showAsMain ? 'bg-foreground' : isActive ? 'bg-foreground/50' : 'bg-muted-foreground/35',
          )}
          aria-hidden
        />
      )}
      <span className="max-w-32 truncate">{page.name}</span>
      {(canDelete || hasMenu) ? (
        <div className="flex shrink-0 items-center">
          {hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Actions for ${page.name}`}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" onClick={(event) => event.stopPropagation()}>
                {onSetActive ? (
                  <DropdownMenuItem disabled={showAsMain} onSelect={() => onSetActive()}>
                    <Check /> Set as active
                  </DropdownMenuItem>
                ) : null}
                {onAddSubToMain ? (
                  <DropdownMenuItem onSelect={() => onAddSubToMain()}>
                    <GitBranch /> Add sub-workflow
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canDelete && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
              aria-label={`Delete ${page.name}`}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
})

function canDeletePage(page: DiagramPage, group: { main: DiagramPage; subs: DiagramPage[] }, totalPages: number): boolean {
  if (totalPages <= 1) return false
  if (page.id === group.main.id && group.subs.length > 0) return false
  return true
}

/** Bottom sheet-tab bar for switching between diagram pages. */
export const PagesBar = memo(function PagesBar({
  pages,
  activePageId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onSetActiveMain,
  onAddSubToMain,
  activeMainPageId,
  density = 'compact',
}: PagesBarProps) {
  const comfortable = density === 'comfortable'
  const groups = groupWorkflowPages(pages)
  const currentMainId = onSetActiveMain
    ? resolveActiveMainPageId(pages, activeMainPageId)
    : resolveActiveMainPageId(pages, activePageId)

  return (
    <div
      className={cn(
        'relative z-20 flex shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-muted/70 px-2',
        comfortable ? 'h-12' : 'h-10',
      )}
      role="tablist"
      aria-label="Workflow tabs"
    >
      {groups.map((group) => {
        const grouped = group.subs.length > 0
        return (
          <div
            key={group.main.id}
            className={cn(
              'flex min-w-0 shrink-0 items-center',
              grouped
                ? 'gap-0.5 rounded-lg border border-border bg-muted px-0.5 py-0.5'
                : 'h-full',
            )}
            role="group"
            aria-label={
              grouped ? `${group.main.name} with nested sub-workflows` : group.main.name
            }
          >
            <PageTab
              page={group.main}
              isActive={group.main.id === activePageId}
              isCurrentMain={group.main.id === currentMainId}
              canDelete={canDeletePage(group.main, group, pages.length)}
              density={density}
              variant="main"
              inGroup={grouped}
              onSelect={() => onSelect(group.main.id)}
              onRename={(name) => onRename(group.main.id, name)}
              onDelete={() => onDelete(group.main.id)}
              onSetActive={onSetActiveMain ? () => onSetActiveMain(group.main.id) : undefined}
              onAddSubToMain={onAddSubToMain ? () => onAddSubToMain(group.main.id) : undefined}
            />
            {grouped ? (
              <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
            ) : null}
            {group.subs.map((sub) => (
              <PageTab
                key={sub.id}
                page={sub}
                isActive={sub.id === activePageId}
                canDelete={canDeletePage(sub, group, pages.length)}
                density={density}
                variant="sub"
                inGroup
                onSelect={() => onSelect(sub.id)}
                onRename={(name) => onRename(sub.id, name)}
                onDelete={() => onDelete(sub.id)}
              />
            ))}
          </div>
        )
      })}

      <button
        type="button"
        onClick={onAdd}
        aria-label="Add main workflow"
        title="New main workflow"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-background hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
})
