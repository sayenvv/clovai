import { memo, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, CircleDot, FolderClosed, GitCommitHorizontal } from 'lucide-react'
import { ServerLlmModelIndicator } from '@/components/agent-workflow/ServerLlmModelIndicator'
import { WorkspaceMembersTrigger } from '@/components/designer/WorkspaceMembersTrigger'
import type { DeploymentStatus } from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import { getSession } from '@/services/project-auth-store'
import { cn } from '@/utils/cn'

interface WorkspaceStatusBarProps {
  version: number
  status: DeploymentStatus
  isDirty: boolean
  validationErrorCount: number
  /** Runs validation (the issues item). */
  onValidate?: () => void
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
  validationErrorCount,
  onValidate,
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

      <StatusItem
        onClick={validationErrorCount > 0 ? onValidate : undefined}
        title={validationErrorCount > 0 ? 'Show issues' : 'No issues found'}
      >
        {validationErrorCount > 0 ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-amber-700 dark:text-amber-300">
              {validationErrorCount} issue{validationErrorCount === 1 ? '' : 's'}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>No issues</span>
          </>
        )}
      </StatusItem>

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
