import { memo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import { MobileAppDrawerTrigger } from '@/components/agent-workflow/MobileAppDrawer'
import { SettingsMenu } from '@/components/agent-workflow/SettingsMenu'
import type { DeploymentStatus } from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import { APP_NAME, ROUTES } from '@/constants'
import { getSession } from '@/services/project-auth-store'
import { cn } from '@/utils/cn'
import type { MobileWorkspaceTab } from '@/components/agent-workflow/MobileWorkspaceNav'

const TAB_META: Record<
  MobileWorkspaceTab,
  { title: string; subtitle: string }
> = {
  design: {
    title: 'Canvas',
    subtitle: 'Build and connect agents',
  },
  library: {
    title: 'Library',
    subtitle: 'Blocks, workflows, and imports',
  },
  inspect: {
    title: 'Inspect',
    subtitle: 'Node settings and run controls',
  },
  logs: {
    title: 'Logs',
    subtitle: 'Trace, validation, and output',
  },
}

interface MobileWorkspaceHeaderProps {
  tab: MobileWorkspaceTab
  workflowName: string
  onWorkflowNameChange: (name: string) => void
  version: number
  status: DeploymentStatus
  isDirty?: boolean
  validationErrorCount: number
  isValidated: boolean
  onSave: () => void
  onValidate: () => void
  onDeploy: () => void
  onGenerate?: () => void
  onExecute?: () => void
  canExecute?: boolean
  isExecuting?: boolean
  onNavigateHome?: () => void
  onOpenSettings?: () => void
  onOpenAppMenu?: () => void
  serverModelConfig?: WorkflowModelConfig
  llmConfigured?: boolean
}

export const MobileWorkspaceHeader = memo(function MobileWorkspaceHeader({
  tab,
  workflowName,
  onWorkflowNameChange,
  version,
  status,
  isDirty = false,
  validationErrorCount,
  isValidated,
  onSave,
  onValidate,
  onDeploy,
  onGenerate,
  onExecute,
  canExecute = false,
  isExecuting = false,
  onNavigateHome,
  onOpenSettings,
  onOpenAppMenu,
  serverModelConfig,
  llmConfigured = false,
}: MobileWorkspaceHeaderProps) {
  const meta = TAB_META[tab]
  const showDesignControls = tab === 'design'
  const session = getSession()
  const userInitials = (session?.fullName || session?.email || 'U').slice(0, 1).toUpperCase()
  const userLabel = session
    ? [session.fullName || session.email, session.displayName].filter(Boolean).join(' · ')
    : undefined

  return (
    <header className="relative z-40 shrink-0 border-b border-border bg-card pt-[max(0.5rem,env(safe-area-inset-top))] shadow-sm">
      <div className="flex h-12 items-center gap-1.5 px-3">
        {onOpenAppMenu ? <MobileAppDrawerTrigger onClick={onOpenAppMenu} /> : null}
        {tab === 'design' ? (
          onNavigateHome ? (
            <button
              type="button"
              onClick={onNavigateHome}
              className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              aria-label={`${APP_NAME} home`}
            >
              <Logo size={LOGO_SIZE_WORKSPACE} rounded="md" />
            </button>
          ) : (
            <Link to={ROUTES.home} className="shrink-0" aria-label={`${APP_NAME} home`}>
              <Logo size={LOGO_SIZE_WORKSPACE} rounded="md" />
            </Link>
          )
        ) : (
          <Link
            to={ROUTES.agentWorkflow}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="Back to canvas"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          {showDesignControls ? (
            <Input
              value={workflowName}
              onChange={(event) => onWorkflowNameChange(event.target.value)}
              className="h-9 border-transparent bg-transparent px-1 text-[15px] font-semibold tracking-tight shadow-none focus-visible:border-input focus-visible:bg-background"
              aria-label="Workflow name"
            />
          ) : (
            <>
              <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                {meta.title}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{meta.subtitle}</p>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <SettingsMenu
            onOpenWorkflowSettings={onOpenSettings}
            onExecuteWorkflow={onExecute}
            canExecute={canExecute && !isExecuting}
            onDeployWorkflow={showDesignControls ? onDeploy : undefined}
            canDeploy={isValidated}
            modelConfig={serverModelConfig}
            llmConfigured={llmConfigured}
            side="bottom"
            align="end"
          />
          <div
            className="rounded-full p-0.5"
            title="Profile"
          >
            <ProfileMenu
              showSignOut={Boolean(session)}
              userInitials={userInitials}
              userLabel={userLabel}
              side="bottom"
              align="end"
              avatarSize="sm"
              triggerClassName="h-9 w-9 rounded-full"
            />
          </div>
        </div>
      </div>

      {showDesignControls ? (
        <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-2.5">
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 text-[10px] font-medium capitalize',
              status === 'deployed'
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-border/80 bg-muted/50 text-muted-foreground',
            )}
          >
            {status}
          </Badge>
          <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
            v{version}
          </Badge>
          {isDirty ? (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500/35 bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-300"
            >
              Unsaved
            </Badge>
          ) : null}
          {validationErrorCount > 0 ? (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500/35 bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-300"
            >
              {validationErrorCount} issue{validationErrorCount === 1 ? '' : 's'}
            </Badge>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {onGenerate ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onGenerate}
                className="h-8 w-8 text-red-700 dark:text-red-300"
                aria-label="Generate workflow"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onSave}
              className="h-8 w-8"
              aria-label="Save draft"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onValidate}
              className="h-8 w-8"
              aria-label="Validate"
            >
              <ShieldCheck className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  )
})
