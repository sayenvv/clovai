import { memo } from 'react'
import { Rocket, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import type { DeploymentStatus } from '@/types/agent-workflow'
import { APP_NAME } from '@/constants'

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
}: AgentWorkflowHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-3 backdrop-blur-sm">
      {onNavigateHome ? (
        <button
          type="button"
          onClick={onNavigateHome}
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
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
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
          v{version}
        </Badge>
        <Badge
          variant="outline"
          className="shrink-0 border-violet-500/30 bg-violet-500/5 text-[10px] font-normal capitalize text-violet-700 dark:text-violet-300"
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
          <Badge variant="outline" className="shrink-0 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300">
            {validationErrorCount} issue{validationErrorCount === 1 ? '' : 's'}
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {onGenerate ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            className="border-violet-500/25 bg-gradient-to-r from-violet-500/[0.08] to-fuchsia-500/[0.06] text-violet-700 hover:from-violet-500/[0.12] hover:to-fuchsia-500/[0.1] dark:text-violet-300"
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
        <Button size="sm" disabled={!isValidated} onClick={onDeploy} className="bg-violet-600 hover:bg-violet-700">
          <Rocket className="h-3.5 w-3.5" />
          Deploy
        </Button>
      </div>

      <ProfileMenu />
    </header>
  )
})
