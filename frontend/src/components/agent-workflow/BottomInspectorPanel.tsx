import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  Clock,
  Loader2,
  PanelBottomClose,
  Play,
  Terminal,
  TestTube2,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { BOTTOM_PANEL_COLLAPSED_HEIGHT } from '@/components/agent-workflow/panel-layout'
import type { ExecutionTraceStep, WorkflowValidationIssue } from '@/types/agent-workflow'

interface BottomInspectorPanelProps {
  validationIssues: WorkflowValidationIssue[]
  trace: ExecutionTraceStep[]
  logs: string[]
  testInput: string
  onTestInputChange: (value: string) => void
  onSimulate: () => void
  onExecute: () => void
  isExecuting?: boolean
  canExecute?: boolean
  height: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
}

export const BottomInspectorPanel = memo(function BottomInspectorPanel({
  validationIssues,
  trace,
  logs,
  testInput,
  onTestInputChange,
  onSimulate,
  onExecute,
  isExecuting = false,
  canExecute = true,
  height,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
}: BottomInspectorPanelProps) {
  const errors = validationIssues.filter((issue) => issue.severity === 'error')
  const warnings = validationIssues.filter((issue) => issue.severity === 'warning')
  const issueCount = errors.length + warnings.length

  if (collapsed) {
    return (
      <div
        className="flex shrink-0 items-center justify-between border-t border-border bg-card/80 px-3 backdrop-blur-sm"
        style={{ height: BOTTOM_PANEL_COLLAPSED_HEIGHT }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">Output</span>
          {issueCount > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[9px]">
              {issueCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleCollapse}
          aria-label="Expand output panel"
          title="Expand output"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className="relative shrink-0 border-t border-border bg-card/80 backdrop-blur-sm"
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize output panel"
        onPointerDown={onResizePointerDown}
        className="absolute inset-x-0 top-0 z-20 flex h-2 -translate-y-1/2 cursor-ns-resize touch-none items-center justify-center"
      >
        <span className="h-1 w-10 rounded-full bg-border transition-colors hover:bg-violet-500/50" />
      </div>

      <Tabs defaultValue="test" className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border pr-2">
          <TabsList className="h-9 bg-transparent p-0 pl-3">
            <TabsTrigger
              value="test"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <TestTube2 className="mr-1.5 h-3.5 w-3.5" />
              Test & run
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <Terminal className="mr-1.5 h-3.5 w-3.5" />
              Logs
            </TabsTrigger>
            <TabsTrigger
              value="validation"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Validation
              {issueCount > 0 && (
                <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                  {issueCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="trace"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Execution trace
            </TabsTrigger>
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleCollapse}
            aria-label="Collapse output panel"
            title="Collapse output"
          >
            <PanelBottomClose className="h-4 w-4" />
          </Button>
        </div>

        <TabsContent value="test" className="mt-0 flex min-h-0 flex-1 flex-col p-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Workflow input</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Provide JSON input — required before executing agents in this workflow.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onSimulate}>
                <TestTube2 className="h-3.5 w-3.5" />
                Simulate
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canExecute || isExecuting}
                onClick={onExecute}
                className="h-8 gap-1.5 bg-emerald-600 text-xs text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {isExecuting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {isExecuting ? 'Launching…' : 'Execute workflow'}
              </Button>
            </div>
          </div>
          <textarea
            value={testInput}
            onChange={(event) => onTestInputChange(event.target.value)}
            className="min-h-0 flex-1 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed shadow-inner focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            placeholder='{\n  "query": "Summarize the quarterly report"\n}'
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-0 flex-1 overflow-y-auto p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <EmptyHint message="Run a simulation or execute the workflow to see runtime logs." />
          ) : (
            logs.map((line, index) => (
              <div key={index} className="text-muted-foreground">
                {line}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="validation" className="mt-0 flex-1 overflow-y-auto p-3">
          {validationIssues.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Workflow passed validation — ready to deploy.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {validationIssues.map((issue) => (
                <li
                  key={issue.id}
                  className={cn(
                    'flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs',
                    issue.severity === 'error'
                      ? 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300'
                      : 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200',
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="trace" className="mt-0 flex-1 overflow-y-auto p-3">
          {trace.length === 0 ? (
            <EmptyHint message="Simulate or execute the workflow to view the execution trace." />
          ) : (
            <ol className="space-y-2">
              {trace.map((step, index) => (
                <li key={step.id} className="flex gap-3 rounded-lg border border-border px-3 py-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{step.agentName}</span>
                      <TraceStatusBadge status={step.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.message}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                      {step.timestamp}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
})

function TraceStatusBadge({ status }: { status: ExecutionTraceStep['status'] }) {
  const styles: Record<ExecutionTraceStep['status'], string> = {
    pending: 'bg-slate-500/10 text-slate-600',
    running: 'bg-blue-500/10 text-blue-600',
    completed: 'bg-emerald-500/10 text-emerald-600',
    'waiting-approval': 'bg-violet-500/10 text-violet-600',
    error: 'bg-red-500/10 text-red-600',
    skipped: 'bg-muted text-muted-foreground',
  }
  return (
    <Badge variant="outline" className={cn('h-4 border-0 px-1.5 text-[9px] capitalize', styles[status])}>
      {status.replace('-', ' ')}
    </Badge>
  )
}

function EmptyHint({ message }: { message: string }) {
  return <p className="text-xs text-muted-foreground">{message}</p>
}
