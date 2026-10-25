import { memo, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDot, CircleX, FolderClosed, GitCommitHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ServerLlmModelIndicator } from '@/components/agent-workflow/ServerLlmModelIndicator'
import { WorkspaceMembersTrigger } from '@/components/designer/WorkspaceMembersTrigger'
import type { DeploymentStatus, WorkflowValidationIssue } from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import { getSession } from '@/services/project-auth-store'
import { cn } from '@/utils/cn'

interface WorkspaceStatusBarProps {
  version: number
  status: DeploymentStatus
  isDirty: boolean
  /** The canvas's current problems, listed when the issues item is clicked. */
  issues: WorkflowValidationIssue[]
  /** Select and open the node or connector an issue is about. */
  onSelectIssue?: (issue: WorkflowValidationIssue) => void
  toolId: string
  onManageAccess?: () => void
  serverModelConfig?: WorkflowModelConfig
  llmConfigured?: boolean
  llmConfigLoading?: boolean
}

/**
 * The editor's full-width status bar, like VS Code's: project, deployment status and version,
 * save state and validation issues on the left; the model and the workspace members on the right.
 */
export const WorkspaceStatusBar = memo(function WorkspaceStatusBar({
  version,
  status,
  isDirty,
  issues,
  onSelectIssue,
  toolId,
  onManageAccess,
  serverModelConfig,
  llmConfigured = false,
  llmConfigLoading = false,
}: WorkspaceStatusBarProps) {
  const projectLabel = getSession()?.displayName ?? null
  const deployed = status === 'deployed'

  return (
    <footer
      className="flex h-8 shrink-0 items-center gap-1 border-t border-border bg-card px-2 text-[11px] text-muted-foreground"
      aria-label="Workspace status"
    >
      {projectLabel && (
        <StatusItem title={`Project: ${projectLabel}`}>
          <FolderClosed className="h-3.5 w-3.5" />
          <span className="max-w-[12rem] truncate">{projectLabel}</span>
        </StatusItem>
      )}

      <StatusItem title={deployed ? 'Deployed' : `Status: ${status}`}>
        <CircleDot className={cn('h-3.5 w-3.5', deployed && 'text-emerald-500')} />
        <span className="capitalize">{status}</span>
      </StatusItem>

      <StatusItem title={`Version ${version}`}>
        <GitCommitHorizontal className="h-3.5 w-3.5" />
        <span className="font-mono">v{version}</span>
      </StatusItem>

      <StatusItem title={isDirty ? 'Unsaved changes' : 'All changes saved'}>
        {isDirty ? (
          <>
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
            <span className="text-amber-700 dark:text-amber-300">Unsaved changes</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Saved</span>
          </>
        )}
      </StatusItem>

      <IssuesItem issues={issues} onSelectIssue={onSelectIssue} />

      <div className="min-w-0 flex-1" aria-hidden />

      {serverModelConfig ? (
        <ServerLlmModelIndicator
          modelConfig={serverModelConfig}
          configured={llmConfigured}
          isLoading={llmConfigLoading}
          variant="compact"
          className="h-6 border-transparent bg-transparent shadow-none hover:shadow-none"
        />
      ) : null}

      <div className="mx-1 h-4 w-px bg-border" aria-hidden />

      <WorkspaceMembersTrigger toolId={toolId} onManageAccess={onManageAccess} />
    </footer>
  )
})

/** One status bar entry: plain text, or a quiet button when it does something. */
function StatusItem({
  children,
  title,
  onClick,
}: {
  children: ReactNode
  title?: string
  onClick?: () => void
}) {
  const className = 'flex h-6 shrink-0 items-center gap-1.5 rounded px-2 whitespace-nowrap'
  if (!onClick) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        className,
        'transition-colors hover:bg-accent hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {children}
    </button>
  )
}

/** "2 issues": opens the list of errors and warnings; picking one jumps to its node or connector. */
function IssuesItem({
  issues,
  onSelectIssue,
}: {
  issues: WorkflowValidationIssue[]
  onSelectIssue?: (issue: WorkflowValidationIssue) => void
}) {
  if (issues.length === 0) {
    return (
      <StatusItem title="No issues found">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>No issues</span>
      </StatusItem>
    )
  }
  const errors = issues.filter((issue) => issue.severity === 'error')
  // Errors first: they block a run
  const sorted = [...errors, ...issues.filter((issue) => issue.severity !== 'error')]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Show issues"
          className="flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AlertTriangle className={cn('h-3.5 w-3.5', errors.length ? 'text-red-500' : 'text-amber-500')} />
          <span className={errors.length ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}>
            {issues.length} issue{issues.length === 1 ? '' : 's'}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="max-h-80 w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto">
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
          {errors.length} error{errors.length === 1 ? '' : 's'} · {issues.length - errors.length} warning
          {issues.length - errors.length === 1 ? '' : 's'}
        </DropdownMenuLabel>
        {sorted.map((issue) => {
          const target = Boolean(issue.nodeId || issue.edgeId)
          return (
            <DropdownMenuItem
              key={issue.id}
              disabled={!target}
              onSelect={() => onSelectIssue?.(issue)}
              className="items-start gap-2 text-[12px] leading-snug data-[disabled]:opacity-100"
            >
              {issue.severity === 'error' ? (
                <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              )}
              <span className="min-w-0 flex-1">{issue.message}</span>
              {target ? <span className="shrink-0 text-[10.5px] text-muted-foreground">Show</span> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
