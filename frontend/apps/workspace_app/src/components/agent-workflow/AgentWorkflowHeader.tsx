import { memo } from 'react'
import { MessageSquareText, Rocket, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import type { DeploymentStatus } from '@/types/agent-workflow'
import { APP_NAME } from '@/constants'
import { getSession } from '@/services/project-auth-store'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
/** Shortcut label for opening the AI chat (handled by the page). */
const ASK_AI_SHORTCUT_LABEL = IS_MAC ? '⌘K' : 'Ctrl K'

interface AgentWorkflowHeaderProps {
  workflowName: string
  onWorkflowNameChange: (name: string) => void
  version: number
  status: DeploymentStatus
  validationErrorCount: number
  isDirty?: boolean
  onSave: () => void
  onValidate: () => void
  onDeploy: () => void
  /** Opens the Workflow AI chat. */
  onGenerate?: () => void
  isValidated: boolean
  onNavigateHome?: () => void
  onViewInstance?: () => void
}

export const AgentWorkflowHeader = memo(function AgentWorkflowHeader({
  workflowName,
  onWorkflowNameChange,
  version,
  status,
  validationErrorCount,
  isDirty = false,
  onSave,
  onValidate,
  onDeploy,
  onGenerate,
  isValidated,
  onNavigateHome,
  onViewInstance,
}: AgentWorkflowHeaderProps) {
  const session = getSession()
  const projectLabel = session
    ? session.accountType === 'company'
      ? session.displayName
      : `${session.displayName}`
    : null
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-3 backdrop-blur-sm">
      {onNavigateHome ? (
        <button
          type="button"
          onClick={onNavigateHome}
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          aria-label={`${APP_NAME} home`}
        >
          <Logo size={LOGO_SIZE_WORKSPACE} />
        </button>
      ) : (
        <Link to="/" className="shrink-0" aria-label={`${APP_NAME} home`}>
          <Logo size={LOGO_SIZE_WORKSPACE} />
        </Link>
      )}

      <div className="h-5 w-px bg-border" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Input
          value={workflowName}
          onChange={(event) => onWorkflowNameChange(event.target.value)}
          className="h-8 max-w-xs border-transparent bg-transparent px-2 text-sm font-semibold shadow-none focus-visible:border-input focus-visible:bg-background"
          aria-label="Workflow name"
        />
        {projectLabel && (
          <Badge
            variant="outline"
            className="hidden max-w-[10rem] truncate border-border bg-muted/60 text-[10px] font-normal text-muted-foreground sm:inline-flex"
            title={projectLabel}
          >
            {projectLabel}
          </Badge>
        )}
        <Badge variant="outline" className="shrink-0 border-border font-mono text-[10px] font-normal text-muted-foreground">
          v{version}
        </Badge>
        <Badge
          variant="outline"
          className="shrink-0 border-border bg-muted/60 text-[10px] font-medium capitalize text-foreground"
        >
          {status}
        </Badge>
        {isDirty && (
          <Badge
            variant="outline"
            className="shrink-0 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
          >
            Unsaved
          </Badge>
        )}
        {validationErrorCount > 0 && (
          <Badge
            variant="outline"
            className="shrink-0 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
          >
            {validationErrorCount} issue{validationErrorCount === 1 ? '' : 's'}
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 overflow-x-auto sm:gap-1.5">
        {onGenerate ? (
          <>
            <button
              type="button"
              onClick={onGenerate}
              className="mr-1 hidden h-8 w-56 items-center gap-2 rounded-lg border border-border bg-background/70 pl-2.5 pr-1.5 text-left text-xs text-muted-foreground shadow-sm transition-colors hover:border-foreground/20 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex lg:w-72"
              aria-label="Ask Workflow AI"
              aria-keyshortcuts="Meta+K Control+K"
              title={`Ask Workflow AI (${ASK_AI_SHORTCUT_LABEL})`}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-foreground dark:text-foreground" />
              <span className="min-w-0 flex-1 truncate">Ask AI to build a workflow…</span>
              <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-px font-sans text-[10px] font-medium text-muted-foreground">
                {ASK_AI_SHORTCUT_LABEL}
              </kbd>
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
              className="md:hidden"
              aria-label="Ask Workflow AI"
            >
              <MessageSquareText className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onSave} className="hidden md:inline-flex">
          <Save className="h-3.5 w-3.5" />
          Save draft
        </Button>
        <Button variant="outline" size="sm" onClick={onValidate}>
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Validate</span>
        </Button>
        {status === 'deployed' && onViewInstance ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewInstance}
            className="hidden border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 sm:inline-flex"
          >
            <Rocket className="h-3.5 w-3.5" />
            Deployments
          </Button>
        ) : null}
        <Button size="sm" disabled={!isValidated} onClick={onDeploy} className="bg-primary hover:bg-primary/90">
          <Rocket className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Deploy</span>
        </Button>
      </div>
    </header>
  )
})
