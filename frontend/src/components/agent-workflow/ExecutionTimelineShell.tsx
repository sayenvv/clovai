import { memo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  PanelRightClose,
  Play,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import { ExecutionFileUploadButton } from '@/components/agent-workflow/ExecutionFileUploadButton'
import { cn } from '@/utils/cn'
import type { ExecutionPlanStep, WorkflowRunState } from '@/types/agent-workflow'

interface ExecutionTimelineShellProps {
  workflowName: string
  stepCount: number
  pendingSteps: ExecutionPlanStep[]
  runState: WorkflowRunState
  input: string
  onInputChange: (value: string) => void
  onRunAgain: () => void
  onSubmitApproval: (value: string) => void
  isRunning: boolean
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
}

export const ExecutionTimelineShell = memo(function ExecutionTimelineShell({
  workflowName,
  stepCount,
  pendingSteps,
  runState,
  input,
  onInputChange,
  onRunAgain,
  onSubmitApproval,
  isRunning,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
}: ExecutionTimelineShellProps) {
  const [approvalInput, setApprovalInput] = useState('')

  if (collapsed) {
    return (
      <aside
        className="relative flex h-full shrink-0 flex-col border-l border-r border-border/60 bg-background"
        style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
      >
        <div className="flex flex-col items-center gap-2 border-b border-border/60 py-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span
            className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]"
            style={{ transform: 'rotate(180deg)' }}
          >
            Timeline
          </span>
        </div>
      </aside>
    )
  }

  const completedCount = runState.trace.filter((step) => step.status === 'completed').length
  const displaySteps =
    runState.trace.length > 0
      ? runState.trace
      : pendingSteps.map((step, index) => ({
          id: `pending-${step.nodeId}`,
          nodeId: step.nodeId,
          agentName: step.agentName,
          status: 'pending' as const,
          message: index === 0 ? 'First step in execution order' : 'Waiting for upstream agents',
          timestamp: new Date().toISOString(),
        }))
  const summaryText = runState.finalResponse
    ? tryParseSummary(runState.finalResponse)
    : null

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-r border-border/60 bg-background"
      style={{ width }}
    >
      <DesignerResizeHandle
        side="right"
        onPointerDown={onResizePointerDown}
        ariaLabel="Resize timeline panel"
      />

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Timeline</p>
          <p className="truncate text-[11px] text-muted-foreground">{workflowName}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onToggleCollapse}>
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <Select className="h-8 flex-1 text-xs" defaultValue="latest" disabled={isRunning}>
          <option value="latest">Checkpoint · latest run</option>
          {runState.runId && <option value={runState.runId}>{runState.runId}</option>}
        </Select>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {completedCount}/{stepCount}
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {displaySteps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 px-3 py-8 text-center text-xs text-muted-foreground">
            Add agents in the editor, then run the workflow to see the execution timeline.
          </p>
        ) : (
          <ol className="relative space-y-0">
            <span className="absolute bottom-2 left-[11px] top-2 w-px bg-border" aria-hidden />
            {displaySteps.map((step, index) => (
              <li key={step.id} className="relative flex gap-3 pb-4 pl-0">
                <StepDot status={step.status} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs font-medium text-foreground">
                      {index + 1}. {step.agentName}
                    </p>
                    <StepBadge status={step.status} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {runState.trace.length > 0
                      ? `${new Date(step.timestamp).toLocaleTimeString()}${'durationMs' in step && step.durationMs != null ? ` · ${step.durationMs}ms` : ''}`
                      : `Step ${index + 1} of ${stepCount}`}
                  </p>
                  {step.message && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{step.message}</p>
                  )}
                  {index > 0 && step.status === 'running' && (
                    <p className="mt-1 font-mono text-[10px] text-primary">Run #{index + 1}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {runState.approvalPrompt && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold">Human approval</p>
            </div>
            <p className="text-[11px] text-muted-foreground">{runState.approvalPrompt.message}</p>
            <Textarea
              rows={2}
              value={approvalInput}
              onChange={(event) => setApprovalInput(event.target.value)}
              placeholder="Enter decision…"
              className="mt-2 text-xs"
            />
            <Button
              size="sm"
              className="mt-2 w-full"
              disabled={!approvalInput.trim()}
              onClick={() => {
                onSubmitApproval(approvalInput)
                setApprovalInput('')
              }}
            >
              Approve & continue
            </Button>
          </div>
        )}

        {runState.status === 'completed' && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Workflow Complete
              </p>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">Final Output</p>
            <p className="mt-1 text-xs leading-relaxed text-foreground">
              {summaryText ?? 'Execution finished successfully.'}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/60 bg-background p-3 backdrop-blur-sm">
        <div className="rounded-[22px] border border-border/60 bg-background p-2.5 shadow-sm transition-colors focus-within:border-ring/40 focus-within:ring-2 focus-within:ring-ring/10 dark:border-zinc-700/70 dark:focus-within:border-zinc-600 dark:focus-within:ring-zinc-500/10">
          <Textarea
            rows={2}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Ask for workflow changes"
            className="min-h-[52px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 dark:text-white dark:placeholder:text-zinc-500"
            disabled={isRunning}
            spellCheck={false}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                if (!isRunning) onRunAgain()
              }
            }}
          />
          <div className="flex items-center gap-1 pt-1">
            <ExecutionFileUploadButton
              variant="icon"
              disabled={isRunning}
              onInputLoaded={onInputChange}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ml-auto h-9 gap-1.5 px-4 text-xs dark:bg-black dark:text-white dark:hover:bg-zinc-950"
              onClick={onRunAgain}
              disabled={isRunning}
              aria-label={runState.status === 'idle' ? 'Execute workflow' : 'Run again'}
              title={runState.status === 'idle' ? 'Execute workflow' : 'Run again'}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : runState.status === 'idle' ? (
                <Play className="h-3.5 w-3.5 fill-current" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to execute</p>
      </div>
    </aside>
  )
})

function StepDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'relative z-[1] mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background',
        status === 'completed' && 'bg-emerald-500 text-white',
        status === 'running' && 'bg-primary/15 text-primary',
        status === 'waiting-approval' && 'bg-amber-500/20 text-amber-500',
        status === 'pending' && 'bg-muted text-muted-foreground',
        status === 'error' && 'bg-red-500 text-white',
      )}
    >
      {status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5" />}
      {status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {status === 'waiting-approval' && <Clock className="h-3 w-3" />}
    </span>
  )
}

function StepBadge({ status }: { status: string }) {
  const label = status.replace('-', ' ')
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-5 shrink-0 border-0 px-1.5 text-[9px] capitalize',
        status === 'completed' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        status === 'running' && 'bg-primary/10 text-primary',
        status === 'waiting-approval' && 'bg-amber-500/10 text-amber-700',
        status === 'pending' && 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </Badge>
  )
}

function tryParseSummary(finalResponse: string): string | null {
  try {
    const parsed = JSON.parse(finalResponse) as { output?: string; status?: string }
    if (typeof parsed.output === 'string') {
      try {
        const inner = JSON.parse(parsed.output) as { summary?: string }
        if (inner.summary) return inner.summary
      } catch {
        return parsed.output.slice(0, 200)
      }
    }
  } catch {
    return finalResponse.slice(0, 200)
  }
  return null
}
