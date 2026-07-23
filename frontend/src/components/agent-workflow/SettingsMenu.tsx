import { memo, useMemo, useState } from 'react'
import { Cpu, Moon, Play, Rocket, Settings2, Sparkles, Sun, Workflow } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { getSession } from '@/services/project-auth-store'
import { cn } from '@/utils/cn'
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
}

const MONTHLY_TOKEN_LIMIT = 100_000
const MONTHLY_RUN_LIMIT = 250

function readUsageSnapshot(workspaceId: string | undefined) {
  const key = `eleven-nodes-ai-usage-${workspaceId ?? 'local'}`
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as { tokens?: number; runs?: number }
      return {
        tokens: Math.max(0, Number(parsed.tokens) || 12_480),
        runs: Math.max(0, Number(parsed.runs) || 18),
      }
    }
  } catch {
    // ignore
  }
  return { tokens: 12_480, runs: 18 }
}

function UsageMeter({
  label,
  used,
  limit,
  unit,
}: {
  label: string
  used: number
  limit: number
  unit: string
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            pct >= 90 ? 'bg-amber-500' : 'bg-foreground/70',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
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
}: SettingsMenuProps) {
  const { theme, toggleTheme } = useTheme()
  const session = getSession()
  const [usageOpen, setUsageOpen] = useState(false)
  const usage = useMemo(() => readUsageSnapshot(session?.workspaceId), [session?.workspaceId])
  const usagePct = Math.round((usage.tokens / MONTHLY_TOKEN_LIMIT) * 100)

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
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
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
              <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[9px] font-normal">
                {usagePct}%
              </Badge>
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
              Token allotment and workflow runs for this workspace month.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Plan</p>
              <Badge variant="outline" className="text-[10px] font-normal">
                {session?.accountType === 'company' ? 'Team' : 'Personal'}
              </Badge>
            </div>
            <UsageMeter label="Tokens" used={usage.tokens} limit={MONTHLY_TOKEN_LIMIT} unit="tok" />
            <UsageMeter label="Workflow runs" used={usage.runs} limit={MONTHLY_RUN_LIMIT} unit="runs" />
            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
