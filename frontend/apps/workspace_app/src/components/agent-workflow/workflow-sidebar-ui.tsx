import { memo, useMemo, useState } from 'react'
import { GitBranch, Layers, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { DiagramDocument, DiagramPage } from '@/components/designer/diagram-types'
import { CatalogDialogShell } from '@/components/agent-workflow/CatalogDialogShell'
import { countAgentsInPage } from '@/components/agent-workflow/sub-workflow-ops'
import { WorkflowEmptyHint } from '@/components/agent-workflow/workflow-ui'
import { SIDEBAR_PREVIEW_LIMIT } from '@/components/agent-workflow/agent-workflow-defaults'

export { SIDEBAR_PREVIEW_LIMIT as SIDEBAR_WORKFLOW_PREVIEW_LIMIT }

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

  const handleCreateTab = onCreateWorkflowTab
    ? () => {
        onCreateWorkflowTab()
        handleOpenChange(false)
      }
    : undefined

  return (
    <CatalogDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={<Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />}
      title="Workflow library"
      description="Mount reusable workflows from other tabs onto this canvas as sub-workflow agents."
      count={workflows.length}
      countLabel="workflows"
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="Search workflows…"
    >
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
        <WorkflowEmptyHint onCreateTab={handleCreateTab} />
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No workflows match your search.</p>
      )}
    </CatalogDialogShell>
  )
})
