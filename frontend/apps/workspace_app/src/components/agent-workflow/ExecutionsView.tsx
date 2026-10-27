import { memo, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Clock,
  GitBranch,
  GripVertical,
  History,
  ListOrdered,
  ScrollText,
  Trash2,
  Workflow,
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
import { Link } from 'react-router-dom'
import { ROUTES } from '@/constants'
import type { DiagramPage } from '@/components/designer/diagram-types'
import { ExecutionInsights } from '@/components/agent-workflow/ExecutionInsights'
import { formatDuration, hasServerTrace, useRunTelemetry } from '@/components/agent-workflow/execution-telemetry'
import { ExecutionAgents } from '@/components/agent-workflow/ExecutionAgents'
import { ExecutionGraph } from '@/components/agent-workflow/ExecutionGraph'
import { ExecutionTimeline } from '@/components/agent-workflow/ExecutionTimeline'

const STATUS_META: Record<ExecutionRecord['status'], { label: string; icon: typeof CheckCircle2; tone: string }> = {
  completed: { label: 'Completed', icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
  failed: { label: 'Failed', icon: XCircle, tone: 'text-red-600 dark:text-red-400' },
  cancelled: { label: 'Cancelled', icon: CircleSlash, tone: 'text-muted-foreground' },
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
          <div className="mt-1.5 rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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

type DetailTab = 'insights' | 'agents' | 'graph' | 'timeline' | 'steps'

const DETAIL_TABS: Array<{ id: DetailTab; label: string; icon: typeof Activity }> = [
  { id: 'insights', label: 'Insights', icon: Activity },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'graph', label: 'Graph', icon: GitBranch },
  { id: 'timeline', label: 'Timeline', icon: ListOrdered },
  { id: 'steps', label: 'Steps & output', icon: ScrollText },
]

function ExecutionDetail({ record, page, history }: { record: ExecutionRecord; page?: DiagramPage; history: ExecutionRecord[] }) {
  const meta = STATUS_META[record.status]
  const [tab, setTab] = useState<DetailTab>('insights')
  // Fetched once for every tab
  const telemetry = useRunTelemetry(record)
  return (
    <div className="w-full max-w-6xl space-y-4 px-6 py-4">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <StatusIcon status={record.status} className="h-5 w-5" />
          <h2 className="truncate text-[22px] font-semibold leading-8 tracking-[-0.01em] text-foreground">{record.workflowName}</h2>
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
          {record.runId && hasServerTrace(record) ? (
            <Link
              to={`${ROUTES.agentWorkflowDashboardTraces}/${record.runId}`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Open full trace
            </Link>
          ) : null}
        </p>
      </header>

      <div role="tablist" aria-label="Run views" className="flex gap-4 border-b border-border">
        {DETAIL_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 pb-2 text-[12.5px] font-medium transition-colors',
              tab === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
            {item.id === 'agents' && telemetry.agents.length ? (
              <span className="rounded-full bg-foreground/[0.07] px-1.5 text-[10px] tabular-nums">{telemetry.agents.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'insights' ? (
        <ExecutionInsights record={record} telemetry={telemetry} history={history} />
      ) : tab === 'agents' ? (
        <ExecutionAgents telemetry={telemetry} />
      ) : tab === 'graph' ? (
        <ExecutionGraph telemetry={telemetry} diagram={page?.diagram} />
      ) : tab === 'timeline' ? (
        <ExecutionTimeline record={record} telemetry={telemetry} />
      ) : (
        <ExecutionSteps record={record} />
      )}
    </div>
  )
}

/** The run as it happened: input, each agent's step, the final output and any issues. */
function ExecutionSteps({ record }: { record: ExecutionRecord }) {
  return (
    <div className="max-w-3xl space-y-4">
      <section className="space-y-2">
        <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Input</h3>
        <div className="rounded-[3px] border border-border bg-card px-3 py-2.5 text-[13px] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {record.input.trim() || <span className="text-muted-foreground">No input</span>}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Agent trace</h3>
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
          <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Final output</h3>
          <div className="rounded-[3px] border border-emerald-500/30 bg-emerald-500/[0.04] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ChatMarkdown content={asMarkdown(record.finalResponse)} />
          </div>
        </section>
      ) : null}

      {record.errors.length > 0 || record.warnings.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Issues</h3>
          <ul className="space-y-1.5">
            {[...record.errors, ...record.warnings].map((event) => (
              <li
                key={event.id}
                className={cn(
                  'flex items-start gap-2 rounded-[3px] border px-3 py-2 text-[12.5px]',
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

interface WorkflowRuns {
  pageId: string
  name: string
  runs: ExecutionRecord[]
  failed: number
}

/**
 * Executions: every workflow that has runs, in a sidebar; open one to list its runs and pick a
 * run to see it as insights, agents, a graph, a timeline, or its steps and output.
 */
export const ExecutionsView = memo(function ExecutionsView({
  pageId,
  pages = [],
  focusRequest,
}: {
  pageId: string
  pages?: DiagramPage[]
  /** Select this run when it changes (from the test chat); a null id picks this tab's latest run. */
  focusRequest?: { runId: string | null; at: number } | null
}) {
  const executions = useExecutions()
  const groups = useMemo<WorkflowRuns[]>(() => {
    const byPage = new Map<string, WorkflowRuns>()
    for (const record of executions) {
      let group = byPage.get(record.pageId)
      if (!group) {
        group = {
          pageId: record.pageId,
          name: pages.find((page) => page.id === record.pageId)?.name || record.workflowName,
          runs: [],
          failed: 0,
        }
        byPage.set(record.pageId, group)
      }
      group.runs.push(record)
      if (record.status === 'failed') group.failed += 1
    }
    // The open workflow tab first, then the most recently run
    return [...byPage.values()].sort((a, b) =>
      a.pageId === pageId ? -1 : b.pageId === pageId ? 1 : Date.parse(b.runs[0].startedAt) - Date.parse(a.runs[0].startedAt),
    )
  }, [executions, pages, pageId])

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ [pageId]: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (!executions.some((record) => record.id === selectedId)) {
      const first = groups[0]?.runs[0]
      setSelectedId(first?.id ?? null)
      if (first) setOpenGroups((value) => ({ ...value, [first.pageId]: true }))
    }
  }, [executions, groups, selectedId])
  // A run opened from the test chat: select it and open its workflow in the sidebar
  useEffect(() => {
    if (!focusRequest) return
    const target =
      executions.find((record) => record.id === focusRequest.runId || (focusRequest.runId && record.runId === focusRequest.runId)) ??
      executions.find((record) => record.pageId === pageId)
    if (!target) return
    setSelectedId(target.id)
    setOpenGroups((value) => ({ ...value, [target.pageId]: true }))
    // Only a new request moves the selection, not later history changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.at])
  const selected = executions.find((record) => record.id === selectedId)

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      {/* Workflows and their runs, in the same style as Settings and the outline panel */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-[hsl(var(--chrome))]">
        <div className="border-b border-border/80 px-3.5 pb-3 pt-3">
          <h2 className="text-[13px] font-semibold text-foreground">Executions</h2>
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            Runs of each workflow. Pick one to see its insights, agents, graph and timeline.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {groups.length === 0 ? (
            <p className="px-1.5 py-2 text-[10.5px] text-muted-foreground">No runs yet. Run a workflow from its Start node.</p>
          ) : (
            groups.map((group) => {
              const open = openGroups[group.pageId] ?? false
              return (
                <section key={group.pageId} className="mb-1">
                  <div className="group/wf flex items-center gap-1 rounded-[2px] px-1 hover:bg-foreground/[0.04]">
                    <button
                      type="button"
                      onClick={() => setOpenGroups((value) => ({ ...value, [group.pageId]: !open }))}
                      aria-expanded={open}
                      className="flex h-8 min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      {open ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      <Workflow className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate text-[12px] font-medium text-foreground">{group.name}</span>
                      {group.pageId === pageId ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[9px] font-medium text-primary">Open</span>
                      ) : null}
                    </button>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {group.runs.length}
                      {group.failed ? <span className="ml-1 text-red-600 dark:text-red-400">· {group.failed} failed</span> : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Clear the execution history of ${group.name}?`)) clearExecutions(group.pageId)
                      }}
                      aria-label={`Clear ${group.name} history`}
                      title="Clear history"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/wf:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {open ? (
                    <ul className="ml-3 space-y-0.5 border-l border-border/70 py-0.5 pl-2">
                      {group.runs.map((record) => {
                        const active = record.id === selectedId
                        return (
                          <li
                            key={record.id}
                            className={cn(
                              'group flex items-start gap-2 rounded-[2px] px-1.5 py-1.5 transition-colors',
                              active ? 'bg-accent text-accent-foreground' : 'hover:bg-foreground/[0.05]',
                            )}
                          >
                            <button type="button" onClick={() => setSelectedId(record.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                              <StatusIcon status={record.status} className="mt-0.5 h-3.5 w-3.5" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[11.5px] text-foreground">{record.input.trim() || 'No input'}</span>
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
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </section>
              )
            })
          )}
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <ExecutionDetail
            key={selected.id}
            record={selected}
            page={pages.find((page) => page.id === selected.pageId)}
            history={executions.filter((record) => record.pageId === selected.pageId)}
          />
        ) : (
          <div className="px-6 pt-4">
            <h1 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-foreground">Executions</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Each run's time, tokens, agents, input and output.</p>
            <section className="mt-4 max-w-3xl rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
                <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
                <History className="h-3.5 w-3.5 text-primary" />
                No runs yet
              </h3>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Run the workflow from the workspace (Run workflow, or the Start node) and its trace appears here.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  )
})
