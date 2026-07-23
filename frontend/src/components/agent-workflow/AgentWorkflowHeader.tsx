import { memo } from 'react'
import { LayoutDashboard, Rocket, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ConsoleButton } from '@/components/agent-workflow/ConsoleButton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import type { DeploymentStatus } from '@/types/agent-workflow'
import { APP_NAME } from '@/constants'
import { getSession } from '@/services/project-auth-store'

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
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
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
            className="hidden max-w-[10rem] truncate border-indigo-500/30 bg-indigo-500/5 text-[10px] font-normal text-indigo-700 dark:text-indigo-300 sm:inline-flex"
            title={projectLabel}
          >
            {projectLabel}
          </Badge>
        )}
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
          v{version}
        </Badge>
        <Badge
          variant="outline"
          className="shrink-0 border-red-500/30 bg-red-500/5 text-[10px] font-normal capitalize text-red-700 dark:text-red-300"
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

      <div className="flex shrink-0 items-center gap-1.5">
        <ConsoleButton />
        {onGenerate ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            className="border-red-500/25 bg-gradient-to-r from-red-500/[0.08] to-rose-500/[0.06] text-red-700 hover:from-red-500/[0.12] hover:to-rose-500/[0.1] dark:text-red-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onSave}>
          <Save className="h-3.5 w-3.5" />
          Save draft
        </Button>
        <Button variant="outline" size="sm" onClick={onValidate}>
          <ShieldCheck className="h-3.5 w-3.5" />
          Validate
        </Button>
        {status === 'deployed' && onViewInstance ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewInstance}
            className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            View instance
          </Button>
        ) : null}
        <Button size="sm" disabled={!isValidated} onClick={onDeploy} className="bg-red-600 hover:bg-red-700">
          <Rocket className="h-3.5 w-3.5" />
          Deploy
        </Button>
      </div>
    </header>
  )
})
