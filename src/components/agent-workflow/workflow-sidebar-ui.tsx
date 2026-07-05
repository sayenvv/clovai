import { memo, useMemo, useState } from 'react'
import { GitBranch, Layers, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'
import type { DiagramDocument, DiagramPage } from '@/components/designer/diagram-types'
import { countAgentsInPage } from '@/components/agent-workflow/sub-workflow-ops'

export const SIDEBAR_WORKFLOW_PREVIEW_LIMIT = 3

export function listMountableWorkflows(
  doc: DiagramDocument,
  activePageId: string,
): DiagramPage[] {
  return doc.pages.filter((page) => page.id !== activePageId)
}

interface WorkflowListItemProps {
  page: DiagramPage
  agentCount: number
  onMount: (pageId: string) => void
  compact?: boolean
}

export function WorkflowListItem({
  page,
  agentCount,
  onMount,
  compact = false,
}: WorkflowListItemProps) {
  return (
    <button
      type="button"
      onClick={() => onMount(page.id)}
      title={`Mount "${page.name}" as a sub-workflow agent`}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg border border-border/70 bg-background text-left transition-all',
        'hover:border-indigo-400/40 hover:bg-indigo-500/5',
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/15 dark:text-indigo-300">
        <GitBranch className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{page.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {agentCount} agent{agentCount === 1 ? '' : 's'} · Sub-workflow
        </p>
      </div>
      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

interface WorkflowStoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: DiagramDocument
  activePageId: string
  onMountWorkflow: (pageId: string) => void
  onCreateWorkflowTab?: () => void
}

export const WorkflowStoreDialog = memo(function WorkflowStoreDialog({
  open,
  onOpenChange,
  doc,
  activePageId,
  onMountWorkflow,
  onCreateWorkflowTab,
}: WorkflowStoreDialogProps) {
  const [query, setQuery] = useState('')

  const workflows = useMemo(() => listMountableWorkflows(doc, activePageId), [doc, activePageId])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return workflows
    return workflows.filter((page) => page.name.toLowerCase().includes(term))
  }, [workflows, query])

  const handleMount = (pageId: string) => {
    onMountWorkflow(pageId)
    onOpenChange(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery('')
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <DialogTitle>Workflow library</DialogTitle>
              <DialogDescription className="mt-1">
                Mount reusable workflows from other tabs onto this canvas as sub-workflow agents.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {workflows.length}
            </Badge>
          </div>
        </DialogHeader>

        <div className="shrink-0 border-b border-border px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workflows…"
              className="h-9 pl-9"
              aria-label="Search workflows"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((page) => (
                <WorkflowListItem
                  key={page.id}
                  page={page}
                  agentCount={countAgentsInPage(doc, page.id)}
                  onMount={handleMount}
                />
              ))}
            </div>
          ) : workflows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-indigo-500/30 bg-indigo-500/5 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No workflows yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a workflow in a new tab, then mount it here on other pages.
              </p>
              {onCreateWorkflowTab && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => {
                    onCreateWorkflowTab()
                    handleOpenChange(false)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New workflow tab
                </Button>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No workflows match your search.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
