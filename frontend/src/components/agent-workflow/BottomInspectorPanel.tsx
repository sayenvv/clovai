import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  Clock,
  PanelBottomClose,
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

      <Tabs defaultValue="validation" className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border pr-2">
          <TabsList className="h-9 bg-transparent p-0 pl-3">
            <TabsTrigger
              value="logs"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <Terminal className="mr-1.5 h-3.5 w-3.5" />
              Logs
            </TabsTrigger>
            <TabsTrigger
              value="test"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <TestTube2 className="mr-1.5 h-3.5 w-3.5" />
              Test
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

        <TabsContent value="logs" className="mt-0 flex-1 overflow-y-auto p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <EmptyHint message="Run a test or deploy to see runtime logs." />
          ) : (
            logs.map((line, index) => (
              <div key={index} className="text-muted-foreground">
                {line}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="test" className="mt-0 flex-1 overflow-y-auto p-3">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Sample input (JSON)
          </label>
          <textarea
            value={testInput}
            onChange={(event) => onTestInputChange(event.target.value)}
            className="h-[calc(100%-2rem)] w-full resize-none rounded-md border border-border bg-background p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            placeholder='{ "query": "Summarize the quarterly report" }'
          />
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
            <EmptyHint message="Click Test to run the workflow and view the execution trace." />
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
