import { memo, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Clock,
  History,
  Trash2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { ChatMarkdown, fenceJson } from '@/components/agent-workflow/ChatMarkdown'
import {
  clearExecutions,
  deleteExecution,
  useExecutions,
  type ExecutionRecord,
} from '@/services/execution-history-store'
import type { ExecutionTraceStep } from '@/types/agent-workflow'

const STATUS_META: Record<ExecutionRecord['status'], { label: string; icon: typeof CheckCircle2; tone: string }> = {
  completed: { label: 'Completed', icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
  failed: { label: 'Failed', icon: XCircle, tone: 'text-red-600 dark:text-red-400' },
  cancelled: { label: 'Cancelled', icon: CircleSlash, tone: 'text-muted-foreground' },
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

function runDuration(record: ExecutionRecord): number {
  return new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime()
}

function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

/** An agent's output for a step: its trace output, its stored step output, or its last reply. */
function stepOutput(record: ExecutionRecord, step: ExecutionTraceStep): string {
  if (step.output?.trim()) return step.output
  if (step.nodeId && record.stepOutputs[step.nodeId]?.trim()) return record.stepOutputs[step.nodeId]
  const replies = record.messages.filter(
    (message) => message.kind === 'response' && (message.nodeId === step.nodeId || message.agentName === step.agentName),
  )
  return replies.map((message) => message.content).join('\n\n')
}

/** Text that looks like JSON is shown as a code block. */
function asMarkdown(text: string): string {
  const trimmed = text.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[') ? fenceJson(trimmed) : trimmed
}

function StatusIcon({ status, className }: { status: ExecutionRecord['status']; className?: string }) {
  const meta = STATUS_META[status]
  return <meta.icon className={cn('shrink-0', meta.tone, className)} aria-label={meta.label} />
}

function StepRow({ record, step, last }: { record: ExecutionRecord; step: ExecutionTraceStep; last: boolean }) {
  const output = stepOutput(record, step)
  const [open, setOpen] = useState(step.status === 'error')
  const tone =
    step.status === 'completed'
      ? 'bg-emerald-500'
      : step.status === 'error'
        ? 'bg-red-500'
        : step.status === 'skipped' || step.status === 'pending'
          ? 'bg-muted-foreground/40'
          : 'bg-amber-500'
  return (
    <li className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-x-3">
      <div className="relative flex justify-center">
        <span className={cn('mt-[7px] h-2.5 w-2.5 rounded-full ring-4 ring-background', tone)} aria-hidden />
        {!last ? <span className="absolute bottom-0 left-1/2 top-5 w-px -translate-x-1/2 bg-border" aria-hidden /> : null}
      </div>
      <div className={cn('min-w-0', !last && 'pb-4')}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={!output && !step.message}
          className="group flex w-full min-w-0 items-center gap-2 py-1 text-left"
        >
          <span className="truncate text-[13px] font-semibold text-foreground">{step.agentName}</span>
          <span className="shrink-0 text-[11px] capitalize text-muted-foreground">{step.status.replace('-', ' ')}</span>
          {step.durationMs ? (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">· {formatDuration(step.durationMs)}</span>
          ) : null}
          {!open && output ? (
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground/80">{output.replace(/\s+/g, ' ')}</span>
          ) : (
            <span className="flex-1" />
          )}
          {output || step.message ? (
            <ChevronRight
              className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
            />
          ) : null}
        </button>
        {open ? (
          <div className="mt-1.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
            {output ? (
              <ChatMarkdown content={asMarkdown(output)} />
            ) : (
              <p className="text-[12px] text-muted-foreground">{step.message}</p>
            )}
          </div>
        ) : null}
      </div>
    </li>
  )
}

function ExecutionDetail({ record }: { record: ExecutionRecord }) {
  const meta = STATUS_META[record.status]
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <StatusIcon status={record.status} className="h-5 w-5" />
          <h2 className="truncate text-lg font-semibold text-foreground">{record.workflowName}</h2>
          <span className={cn('text-xs font-medium', meta.tone)}>{meta.label}</span>
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{new Date(record.startedAt).toLocaleString()}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(runDuration(record))}
          </span>
          <span>{record.trace.length} step{record.trace.length === 1 ? '' : 's'}</span>
          {record.runId ? <span className="font-mono">{record.runId}</span> : null}
        </p>
      </header>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Input</h3>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] text-foreground shadow-sm">
          {record.input.trim() || <span className="text-muted-foreground">No input</span>}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Agent trace</h3>
        {record.trace.length === 0 ? (
          <p className="text-xs text-muted-foreground">No steps were recorded.</p>
        ) : (
          <ol>
            {record.trace.map((step, index) => (
              <StepRow key={step.id} record={record} step={step} last={index === record.trace.length - 1} />
            ))}
          </ol>
        )}
      </section>

      {record.finalResponse ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Final output</h3>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] px-4 py-3 shadow-sm">
            <ChatMarkdown content={asMarkdown(record.finalResponse)} />
          </div>
        </section>
      ) : null}

      {record.errors.length > 0 || record.warnings.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Issues</h3>
          <ul className="space-y-1.5">
            {[...record.errors, ...record.warnings].map((event) => (
              <li
                key={event.id}
                className={cn(
                  'flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px]',
                  event.level === 'error'
                    ? 'border-red-500/30 bg-red-500/[0.05] text-red-700 dark:text-red-300'
                    : 'border-amber-500/30 bg-amber-500/[0.05] text-amber-800 dark:text-amber-300',
                )}
              >
                {event.level === 'error' ? (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="min-w-0">
                  {event.agentName ? <span className="font-medium">{event.agentName}: </span> : null}
                  {event.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/**
 * Executions: this workflow tab's runs, newest first. Pick one to see its
 * input, each agent's step and output, the final output, and any errors.
 */
export const ExecutionsView = memo(function ExecutionsView({ pageId }: { pageId: string }) {
  const executions = useExecutions()
  // Only this workflow tab's runs; open another tab to see its runs.
  const shown = useMemo(() => executions.filter((record) => record.pageId === pageId), [executions, pageId])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (!shown.some((record) => record.id === selectedId)) setSelectedId(shown[0]?.id ?? null)
  }, [shown, selectedId])
  const selected = shown.find((record) => record.id === selectedId)

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border/60">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h2 className="text-sm font-semibold text-foreground">Executions</h2>
          {shown.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear this workflow's execution history?")) clearExecutions(pageId)
              }}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {shown.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No runs yet. Run a workflow from its Start node.
            </p>
          ) : (
            shown.map((record) => {
              const active = record.id === selectedId
              return (
                <div
                  key={record.id}
                  className={cn(
                    'group flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors',
                    active ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.04]',
                  )}
                >
                  <button type="button" onClick={() => setSelectedId(record.id)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                    <StatusIcon status={record.status} className="mt-0.5 h-4 w-4" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-foreground">{record.workflowName}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {record.input.trim() || 'No input'}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] tabular-nums text-muted-foreground/80">
                        {timeAgo(record.startedAt)} · {formatDuration(runDuration(record))}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteExecution(record.id)}
                    aria-label="Delete run"
                    title="Delete run"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <ExecutionDetail record={selected} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <History className="h-8 w-8 opacity-50" />
            <p className="text-sm">Run a workflow to see its execution trace here.</p>
          </div>
        )}
      </main>
    </div>
  )
})
