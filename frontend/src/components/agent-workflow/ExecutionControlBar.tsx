import { memo, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  Square,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'
import type { WorkflowRunState } from '@/types/agent-workflow'

interface ExecutionControlBarProps {
  runState: WorkflowRunState
  onCancel: () => void
  onReset: () => void
  onSubmitApproval: (value: string) => void
}

const STATUS_LABELS: Record<WorkflowRunState['status'], string> = {
  idle: 'Ready',
  running: 'Running',
  'waiting-approval': 'Awaiting approval',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const ExecutionControlBar = memo(function ExecutionControlBar({
  runState,
  onCancel,
  onReset,
  onSubmitApproval,
}: ExecutionControlBarProps) {
  const [approvalInput, setApprovalInput] = useState('')

  if (runState.status === 'idle') return null

  const isActive = runState.status === 'running' || runState.status === 'waiting-approval'
  const completedCount = runState.completedNodeIds.length
  const totalSteps = runState.trace.length

  const statusVariant =
    runState.status === 'completed'
      ? 'success'
      : runState.status === 'failed'
        ? 'error'
        : runState.status === 'cancelled'
          ? 'muted'
          : runState.status === 'waiting-approval'
            ? 'warning'
            : 'active'

  return (
    <div className="shrink-0 border-b border-border bg-card/90 px-3 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {isActive && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
          {runState.status === 'completed' && (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          {runState.status === 'failed' && (
            <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span className="text-xs font-semibold text-foreground">Workflow execution</span>
          <ExecutionStatusBadge variant={statusVariant} label={STATUS_LABELS[runState.status]} />
          {totalSteps > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {completedCount}/{totalSteps} agents
            </span>
          )}
          {runState.runId && (
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {runState.runId}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isActive && (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onCancel}>
              <Square className="h-3 w-3 fill-current" />
              Stop
            </Button>
          )}
          {!isActive && (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Back to design
            </Button>
          )}
        </div>
      </div>

      {runState.approvalPrompt && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
            Human approval required before &ldquo;{runState.approvalPrompt.nextAgentName}&rdquo;
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{runState.approvalPrompt.message}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Textarea
              value={approvalInput}
              onChange={(event) => setApprovalInput(event.target.value)}
              placeholder={`Approval note for ${runState.approvalPrompt.role}…`}
              className="min-h-[60px] flex-1 resize-none font-mono text-xs"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 bg-amber-600 text-white hover:bg-amber-700"
              disabled={!approvalInput.trim()}
              onClick={() => {
                onSubmitApproval(approvalInput)
                setApprovalInput('')
              }}
            >
              Approve &amp; continue
            </Button>
          </div>
        </div>
      )}
    </div>
  )
})

function ExecutionStatusBadge({
  variant,
  label,
}: {
  variant: 'active' | 'success' | 'error' | 'warning' | 'muted'
  label: string
}) {
  const styles = {
    active: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    error: 'bg-red-500/10 text-red-700 dark:text-red-300',
    warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
    muted: 'bg-muted text-muted-foreground',
  }
  return (
    <Badge variant="outline" className={cn('h-5 border-0 px-2 text-[10px] font-medium', styles[variant])}>
      {label}
    </Badge>
  )
}
