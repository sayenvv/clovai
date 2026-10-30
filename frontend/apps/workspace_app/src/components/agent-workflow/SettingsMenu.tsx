import { memo, useEffect, useState, useSyncExternalStore } from 'react'
import { ExternalLink, LayoutDashboard, Moon, Play, Rocket, Settings2, Sparkles, Sun } from 'lucide-react'
import { WorkflowIcon as Workflow } from '@/components/shared/WorkflowIcon'
import { Badge } from '@/components/ui/badge'
import { ModelLogo } from '@/components/agent-workflow/model-providers'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'
import { TokenBudgetBar } from '@/components/agent-workflow/TokenBudgetBar'
import { ROUTES } from '@/constants'
import { getSession } from '@/services/project-auth-store'
import { ensureTokenUsage, readTokenUsage, subscribeTokenUsage } from '@/services/token-usage-store'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

interface SettingsMenuProps {
  onOpenWorkflowSettings?: () => void
  onExecuteWorkflow?: () => void
  canExecute?: boolean
  onDeployWorkflow?: () => void
  canDeploy?: boolean
  modelConfig?: WorkflowModelConfig
  llmConfigured?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** The workflow canvas's view options (grid and snapping). */
  canvasView?: CanvasViewSettings
  /** Overrides the trigger's size and colours (e.g. the compact top bar). */
  triggerClassName?: string
}

export interface CanvasViewSettings {
  showGrid: boolean
  onShowGridChange: (enabled: boolean) => void
  snapToGrid: boolean
  onSnapToGridChange: (enabled: boolean) => void
  /** The workflow map in the canvas corner. */
  showMap?: boolean
  onShowMapChange?: (enabled: boolean) => void
}

/** Settings dropdown — same interaction pattern as the profile menu. */
export const SettingsMenu = memo(function SettingsMenu({
  onOpenWorkflowSettings,
  onExecuteWorkflow,
  canExecute = false,
  onDeployWorkflow,
  canDeploy = false,
  modelConfig,
  llmConfigured = false,
  side = 'right',
  align = 'end',
  canvasView,
  triggerClassName,
}: SettingsMenuProps) {
  const { theme, toggleTheme } = useTheme()
  const session = getSession()
  const [usageOpen, setUsageOpen] = useState(false)
  // The same allowance the token card shows, kept in local storage and updated by every run.
  const allowance = useSyncExternalStore(subscribeTokenUsage, readTokenUsage, () => null)
  const usagePct = allowance && allowance.tokenLimit > 0 ? Math.round((allowance.tokensUsed / allowance.tokenLimit) * 100) : null

  useEffect(() => {
    void ensureTokenUsage()
  }, [])

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('h-9 w-9 rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground', triggerClassName)}
                  aria-label="Open settings"
                >
                  <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={8}
              className="border-border/80 bg-popover/95 px-2.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm"
            >
              Settings
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent side={side} align={align} sideOffset={8} className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Workspace
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setUsageOpen(true)}>
              <Sparkles />
              AI usage
              {usagePct !== null ? (
                <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[9px] font-normal">
                  {usagePct}%
                </Badge>
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={ROUTES.workspaceSettings()}>
                <LayoutDashboard />
                Dashboard
                <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
            {onOpenWorkflowSettings ? (
              <DropdownMenuItem onSelect={() => onOpenWorkflowSettings()}>
                <Workflow />
                Workflow settings…
              </DropdownMenuItem>
            ) : null}
            {onExecuteWorkflow ? (
              <DropdownMenuItem
                disabled={!canExecute}
                onSelect={() => {
                  if (!canExecute) return
                  onExecuteWorkflow()
                }}
              >
                <Play />
                Execute workflow…
              </DropdownMenuItem>
            ) : null}
            {onDeployWorkflow ? (
              <DropdownMenuItem
                disabled={!canDeploy}
                onSelect={() => {
                  if (!canDeploy) return
                  onDeployWorkflow()
                }}
              >
                <Rocket />
                Deploy workflow…
              </DropdownMenuItem>
            ) : null}
            {canvasView ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Canvas
                </DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={canvasView.showGrid}
                  onCheckedChange={(checked) => canvasView.onShowGridChange(checked === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  Show grid
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={canvasView.snapToGrid}
                  onCheckedChange={(checked) => canvasView.onSnapToGridChange(checked === true)}
                  onSelect={(event) => event.preventDefault()}
                >
                  Snap to grid
                </DropdownMenuCheckboxItem>
                {canvasView.onShowMapChange ? (
                  <DropdownMenuCheckboxItem
                    checked={canvasView.showMap ?? true}
                    onCheckedChange={(checked) => canvasView.onShowMapChange?.(checked === true)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    Show map
                  </DropdownMenuCheckboxItem>
                ) : null}
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={toggleTheme}>
              {theme === 'dark' ? <Sun /> : <Moon />}
              Switch to {theme === 'dark' ? 'light' : 'dark'} mode
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-base">AI usage</DialogTitle>
            <DialogDescription>
              Your credits for this period. The dashboard has the full breakdown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Plan</p>
              <Badge variant="outline" className="text-[10px] font-normal">
                {session?.accountType === 'company' ? 'Team' : 'Personal'}
              </Badge>
            </div>
            <TokenBudgetBar />
            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ModelLogo hints={[modelConfig?.provider, modelConfig?.model]} className="h-4 w-4" />
                Active model
              </div>
              <p className="mt-1 truncate font-mono text-[11px]">
                {modelConfig?.model?.trim() || 'Not configured'}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {llmConfigured
                  ? `Provider · ${modelConfig?.provider ?? 'server'} · max ${modelConfig?.maxTokens ?? '—'} tokens`
                  : 'Configure server LLM settings to enable generation.'}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8 w-full rounded-lg">
              <a href={ROUTES.workspaceSettings('usage')} onClick={() => setUsageOpen(false)}>
                <LayoutDashboard className="h-3.5 w-3.5" />
                Open dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
