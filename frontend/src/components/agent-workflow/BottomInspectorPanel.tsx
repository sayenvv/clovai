import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  Clock,
  Loader2,
  PanelBottomClose,
  Terminal,
  XCircle,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { BOTTOM_PANEL_COLLAPSED_HEIGHT } from '@/components/agent-workflow/panel-layout'
import type {
  ExecutionTraceStep,
  WorkflowExecutionEvent,
  WorkflowValidationIssue,
} from '@/types/agent-workflow'

export type InspectorTab = 'trace' | 'logs' | 'errors' | 'warnings' | 'validation'

interface BottomInspectorPanelProps {
  validationIssues: WorkflowValidationIssue[]
  trace: ExecutionTraceStep[]
  logs: string[]
  executionEvents: WorkflowExecutionEvent[]
  executionErrors: WorkflowExecutionEvent[]
  executionWarnings: WorkflowExecutionEvent[]
  isExecuting?: boolean
  activeTab?: InspectorTab
  onActiveTabChange?: (tab: InspectorTab) => void
  stepOutputs?: Record<string, string>
  height: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
}

export const BottomInspectorPanel = memo(function BottomInspectorPanel({
  validationIssues,
  trace,
  logs,
  executionEvents,
  executionErrors,
  executionWarnings,
  isExecuting = false,
  activeTab = 'trace',
  onActiveTabChange,
  stepOutputs = {},
  height,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
}: BottomInspectorPanelProps) {
  const validationErrors = validationIssues.filter((issue) => issue.severity === 'error')
  const validationWarnings = validationIssues.filter((issue) => issue.severity === 'warning')
  const validationCount = validationErrors.length + validationWarnings.length
  const runtimeErrorCount = executionErrors.length
  const runtimeWarningCount = executionWarnings.length
  const logEvents = executionEvents

  if (collapsed) {
    return (
      <div
        className="flex shrink-0 items-center justify-between border-t border-border bg-card/80 px-3 backdrop-blur-sm"
        style={{ height: BOTTOM_PANEL_COLLAPSED_HEIGHT }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">Output</span>
          {isExecuting && (
            <Badge variant="outline" className="h-4 gap-1 border-0 bg-primary/10 px-1.5 text-[9px] text-primary">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Running
            </Badge>
          )}
          {runtimeErrorCount > 0 && (
            <Badge variant="outline" className="h-4 border-0 bg-red-500/10 px-1 text-[9px] text-red-600">
              {runtimeErrorCount} err
            </Badge>
          )}
          {validationCount > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[9px]">
              {validationCount}
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
      className="relative flex shrink-0 flex-col overflow-hidden border-t border-border bg-card/80 backdrop-blur-sm"
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

      <Tabs
        value={activeTab}
        onValueChange={(value) => onActiveTabChange?.(value as InspectorTab)}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border pr-2">
          <TabsList className="h-9 flex-wrap bg-transparent p-0 pl-3">
            <TabsTrigger
              value="trace"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Trace
              {trace.length > 0 && (
                <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                  {trace.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <Terminal className="mr-1.5 h-3.5 w-3.5" />
              Logs
            </TabsTrigger>
            <TabsTrigger
              value="errors"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Errors
              {runtimeErrorCount > 0 && (
                <Badge variant="outline" className="ml-1.5 h-4 border-0 bg-red-500/10 px-1 text-[9px] text-red-600">
                  {runtimeErrorCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="warnings"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Warnings
              {runtimeWarningCount > 0 && (
                <Badge variant="outline" className="ml-1.5 h-4 border-0 bg-amber-500/10 px-1 text-[9px] text-amber-700">
                  {runtimeWarningCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="validation"
              className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent"
            >
              Validation
              {validationCount > 0 && (
                <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[9px]">
                  {validationCount}
                </Badge>
              )}
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

        <div className="relative min-h-0 flex-1">
          <TabsContent value="trace" className="absolute inset-0 mt-0 overflow-y-auto p-3">
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
                        {step.durationMs != null && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {step.durationMs}ms
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.message}</p>
                      {(step.output ?? (step.nodeId ? stepOutputs[step.nodeId] : undefined)) && (
                        <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">
                          {step.output ?? (step.nodeId ? stepOutputs[step.nodeId] : '')}
                        </pre>
                      )}
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                        {step.timestamp}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="logs" className="absolute inset-0 mt-0 overflow-y-auto p-3 font-mono text-xs">
            {logEvents.length === 0 && logs.length === 0 ? (
              <EmptyHint message="Run a simulation or execute the workflow to see runtime logs." />
            ) : (
              <div className="space-y-1">
                {logs.map((line, index) => (
                  <TerminalLine key={`log-${index}`} level="info" timestamp="" message={line} />
                ))}
                {logEvents.map((event) => (
                  <TerminalLine
                    key={event.id}
                    level={event.level}
                    timestamp={event.timestamp}
                    message={event.message}
                    detail={event.detail}
                    kind={event.kind}
                    agentName={event.agentName}
                    nodeId={event.nodeId}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="errors" className="absolute inset-0 mt-0 overflow-y-auto p-3">
            {executionErrors.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                No runtime errors.
              </div>
            ) : (
              <div className="space-y-1.5 font-mono text-xs">
                {executionErrors.map((event) => (
                  <TerminalLine
                    key={event.id}
                    level="error"
                    timestamp={event.timestamp}
                    message={event.message}
                    detail={event.detail}
                    kind={event.kind}
                    agentName={event.agentName}
                    nodeId={event.nodeId}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="warnings" className="absolute inset-0 mt-0 overflow-y-auto p-3">
            {executionWarnings.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                No runtime warnings.
              </div>
            ) : (
              <div className="space-y-1.5 font-mono text-xs">
                {executionWarnings.map((event) => (
                  <TerminalLine
                    key={event.id}
                    level="warning"
                    timestamp={event.timestamp}
                    message={event.message}
                    detail={event.detail}
                    kind={event.kind}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="validation" className="absolute inset-0 mt-0 overflow-y-auto p-3">
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
        </div>
      </Tabs>
    </div>
  )
})

function TerminalLine({
  level,
  timestamp,
  message,
  detail,
  kind,
  agentName,
  nodeId,
}: {
  level: WorkflowExecutionEvent['level'] | 'info'
  timestamp: string
  message: string
  detail?: string
  kind?: WorkflowExecutionEvent['kind']
  agentName?: string
  nodeId?: string
}) {
  const levelStyles = {
    info: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-300',
    error: 'text-red-700 dark:text-red-300',
  }
  const prefix = level === 'error' ? 'ERR' : level === 'warning' ? 'WRN' : level === 'success' ? 'OK ' : 'LOG'

  return (
    <div className={cn('rounded px-1 py-0.5', levelStyles[level])}>
      <span className="text-muted-foreground/80">
        {timestamp ? `[${formatLogTimestamp(timestamp)}] ` : ''}
        <span className="font-semibold">{prefix}</span>
        {kind ? ` ${kind}` : ''}
        {' · '}
      </span>
      {agentName && (
        <span className="font-semibold text-foreground/90">
          {agentName}
          {nodeId ? ` (${nodeId})` : ''}
          {' · '}
        </span>
      )}
      {message}
      {detail && (
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded border border-border/60 bg-muted/30 p-1.5 text-[10px] leading-relaxed text-muted-foreground/90">
          {detail}
        </pre>
      )}
    </div>
  )
}

function formatLogTimestamp(iso: string): string {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return iso
  return new Date(parsed).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

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
