import { memo, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, Bot, CheckCircle2, CircleX, FileStack, Search, Wrench, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Diagram, DiagramPage } from '@/components/designer/diagram-types'
import { isAgentNode, isToolNode } from '@/components/agent-workflow/tool-agent-mapping'
import { APP_NAME } from '@/constants'
import type { WorkflowValidationIssue } from '@/types/agent-workflow'
import { cn } from '@/utils/cn'

/** The top bar's small square icon buttons. */
const ICON_BUTTON =
  'flex h-6 w-6 items-center justify-center rounded-[3px] text-foreground/70 transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface SearchHit {
  kind: 'agent' | 'tool' | 'page'
  id: string
  label: string
  detail: string
}

interface WorkspaceTopBarProps {
  diagram: Diagram
  pages: DiagramPage[]
  activePageId: string
  onOpenNode: (nodeId: string) => void
  onSelectPage: (pageId: string) => void
  issues: WorkflowValidationIssue[]
  onSelectIssue: (issue: WorkflowValidationIssue) => void
}

/**
 * The thin app bar over the workspace: product name on the left, a search over the workflow's agents,
 * tools and pages in the centre, then notifications.
 */
export const WorkspaceTopBar = memo(function WorkspaceTopBar({
  diagram,
  pages,
  activePageId,
  onOpenNode,
  onSelectPage,
  issues,
  onSelectIssue,
}: WorkspaceTopBarProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const hits = useMemo<SearchHit[]>(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const found: SearchHit[] = []
    for (const node of diagram.nodes) {
      if (!node.label.toLowerCase().includes(needle)) continue
      if (isAgentNode(node)) found.push({ kind: 'agent', id: node.id, label: node.label, detail: 'Agent' })
      else if (isToolNode(node)) {
        const owner = diagram.nodes.find((candidate) => candidate.id === node.mappedAgentId)?.label
        found.push({ kind: 'tool', id: node.id, label: node.label, detail: owner ? `Tool · ${owner}` : 'Tool' })
      }
    }
    for (const page of pages) {
      if (page.id !== activePageId && page.name.toLowerCase().includes(needle)) {
        found.push({ kind: 'page', id: page.id, label: page.name, detail: 'Workflow page' })
      }
    }
    return found.slice(0, 8)
  }, [query, diagram.nodes, pages, activePageId])

  const pick = (hit: SearchHit) => {
    if (hit.kind === 'page') onSelectPage(hit.id)
    else onOpenNode(hit.id)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const errors = issues.filter((issue) => issue.severity === 'error')

  return (
    <header className="relative z-40 flex h-8 shrink-0 items-center border-b border-border bg-[hsl(var(--chrome))] pl-3 pr-2">
      <span className="w-40 shrink-0 truncate text-[11.5px] font-medium text-foreground/85">{APP_NAME}</span>

      {/* Search: the workflow's agents, tools and pages */}
      <div className="flex flex-1 justify-center">
        <div className="relative w-full max-w-[400px]">
          <div className="flex h-6 items-center gap-2 rounded-[2px] bg-[hsl(var(--chrome-input))] px-2">
            <Search className="h-3 w-3 shrink-0 text-foreground/60" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setCursor(0)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setCursor((index) => Math.min(index + 1, hits.length - 1))
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setCursor((index) => Math.max(index - 1, 0))
                } else if (event.key === 'Enter' && hits[cursor]) {
                  pick(hits[cursor])
                } else if (event.key === 'Escape') {
                  setQuery('')
                  inputRef.current?.blur()
                }
              }}
              placeholder="Search agents, tools and workflows"
              aria-label="Search the workflow"
              className="min-w-0 flex-1 bg-transparent text-center text-[11px] text-foreground outline-none placeholder:text-foreground/70 focus:text-left focus:placeholder:text-muted-foreground"
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-foreground/60 hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            ) : (
              <X className="h-3 w-3 shrink-0 text-foreground/40" aria-hidden />
            )}
          </div>
          {open && query.trim() ? (
            <div className="absolute left-0 right-0 top-7 overflow-hidden rounded-[3px] border border-border bg-popover py-1 shadow-lg">
              {hits.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-muted-foreground">Nothing matches “{query.trim()}”.</p>
              ) : (
                hits.map((hit, index) => {
                  const Icon = hit.kind === 'agent' ? Bot : hit.kind === 'tool' ? Wrench : FileStack
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(hit)}
                      onMouseEnter={() => setCursor(index)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px]',
                        index === cursor ? 'bg-accent text-accent-foreground' : 'text-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">{hit.label}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{hit.detail}</span>
                    </button>
                  )
                })
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Notifications, Ask AI, settings, help */}
      <div className="flex shrink-0 items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(ICON_BUTTON, 'relative')} aria-label={`${issues.length} notifications`} title="Notifications">
              <Bell className="h-3.5 w-3.5" strokeWidth={1.75} />
              {issues.length > 0 ? (
                <span
                  className={cn(
                    'absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full',
                    errors.length ? 'bg-red-500' : 'bg-amber-500',
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="max-h-80 w-[24rem] overflow-y-auto">
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
              {issues.length === 0
                ? 'Notifications'
                : `${errors.length} error${errors.length === 1 ? '' : 's'} · ${issues.length - errors.length} warning${issues.length - errors.length === 1 ? '' : 's'}`}
            </DropdownMenuLabel>
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-2 text-[12px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                No issues on this workflow.
              </div>
            ) : (
              [...errors, ...issues.filter((issue) => issue.severity !== 'error')].map((issue) => (
                <DropdownMenuItem
                  key={issue.id}
                  disabled={!issue.nodeId && !issue.edgeId}
                  onSelect={() => onSelectIssue(issue)}
                  className="items-start gap-2 text-[12px] leading-snug data-[disabled]:opacity-100"
                >
                  {issue.severity === 'error' ? (
                    <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  )}
                  <span className="min-w-0 flex-1">{issue.message}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
})
