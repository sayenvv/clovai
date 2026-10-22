import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import { ExecutionSidebarPanel } from '@/components/agent-workflow/ExecutionSidebarPanel'
import type { ExecutionPlanStep, WorkflowRunState } from '@/types/agent-workflow'

interface ExecutionTimelineShellProps {
  workflowName: string
  stepCount: number
  pendingSteps: ExecutionPlanStep[]
  runState: WorkflowRunState
  input: string
  onInputChange: (value: string) => void
  onRunAgain: () => void
  onCancel?: () => void
  onSubmitApproval: (value: string) => void
  onSubmitFeedback?: (value: string) => void
  isRunning: boolean
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
}

/** The execute page's chat panel: the same chat as the editor's run panel, in a resizable column. */
export const ExecutionTimelineShell = memo(function ExecutionTimelineShell({
  workflowName,
  stepCount,
  pendingSteps,
  runState,
  input,
  onInputChange,
  onRunAgain,
  onCancel,
  onSubmitApproval,
  onSubmitFeedback,
  isRunning,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
}: ExecutionTimelineShellProps) {
  if (collapsed) {
    return (
      <aside
        className="relative flex h-full shrink-0 flex-col border-l border-r border-border/60 bg-background"
        style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
      >
        <div className="flex flex-col items-center gap-2 border-b border-border/60 py-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse} aria-label="Expand chat panel">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span
            className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]"
            style={{ transform: 'rotate(180deg)' }}
          >
            Chat
          </span>
        </div>
      </aside>
    )
  }

  const completedCount = runState.trace.filter((step) => step.status === 'completed').length

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-r border-border/60 bg-background"
      style={{ width }}
    >
      <DesignerResizeHandle side="right" onPointerDown={onResizePointerDown} ariaLabel="Resize chat panel" />

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Chat</p>
          <p className="truncate text-[11px] text-muted-foreground">{workflowName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge
            variant="outline"
            className="text-[10px] tabular-nums"
            title={`${completedCount} of ${stepCount || pendingSteps.length} steps completed`}
          >
            {completedCount}/{stepCount || pendingSteps.length}
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleCollapse} aria-label="Collapse chat panel">
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ExecutionSidebarPanel
          testInput={input}
          onTestInputChange={onInputChange}
          onExecute={onRunAgain}
          isExecuting={isRunning}
          canExecute={pendingSteps.length > 0}
          runStatus={runState.status}
          runId={runState.runId}
          onCancel={onCancel}
          approvalPrompt={runState.approvalPrompt}
          onSubmitApproval={onSubmitApproval}
          onSubmitFeedback={onSubmitFeedback}
          stepOutputs={runState.stepOutputs}
          trace={runState.trace}
          messages={runState.messages}
          finalResponse={runState.finalResponse}
          errors={runState.errors}
          emptyHint="Send a message to run it. Replies appear here; events and traces are in the inspector on the right."
        />
      </div>
    </aside>
  )
})
