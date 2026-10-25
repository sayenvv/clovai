import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Bot, Coins, ListTree, Timer, Wrench } from 'lucide-react'
import { ReportState, Section } from '@/components/agent-workflow/dashboard/activity-ui'
import {
  formatCompact,
  formatLatency,
  formatNumber,
  formatWhen,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import { PageIntro, StatCard } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { useActivityReport } from '@/components/agent-workflow/dashboard/use-activity-report'
import { SPAN_LEGEND, spanTone, TraceStatusBadge } from '@/components/agent-workflow/dashboard/trace-ui'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'
import { fetchTrace, type TraceSpan } from '@/services/traces-api'
import { cn } from '@/utils/cn'

interface Row {
  span: TraceSpan
  depth: number
}

/** Spans depth-first from the roots, children in start order, for the waterfall. */
function flatten(spans: TraceSpan[]): Row[] {
  const ids = new Set(spans.map((span) => span.span_id))
  const children = new Map<string | null, TraceSpan[]>()
  for (const span of spans) {
    // A span whose parent is missing (not exported yet) is shown as a root
    const parent = span.parent_span_id && ids.has(span.parent_span_id) ? span.parent_span_id : null
    children.set(parent, [...(children.get(parent) ?? []), span])
  }
  const rows: Row[] = []
  const visit = (parent: string | null, depth: number) => {
    for (const span of children.get(parent) ?? []) {
      rows.push({ span, depth })
      visit(span.span_id, depth + 1)
    }
  }
  visit(null, 0)
  return rows
}

export default function TraceDetailPage() {
  const { traceId = '' } = useParams()
  const load = useCallback(() => fetchTrace(traceId), [traceId])
  const { data, error, isLoading } = useActivityReport(load, 0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = useMemo(() => flatten(data?.spans ?? []), [data])
  const start = Math.min(...rows.map((row) => Date.parse(row.span.start_time)))
  const end = Math.max(...rows.map((row) => Date.parse(row.span.end_time)))
  const total = Math.max(1, end - start)
  const selected = rows.find((row) => row.span.span_id === selectedId)?.span ?? null
  const modelCalls = data?.agents.reduce((sum, agent) => sum + agent.model_calls, 0) ?? 0
  const toolCalls = data?.agents.reduce((sum, agent) => sum + agent.tool_calls, 0) ?? 0

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 h-8 text-muted-foreground">
        <Link to={ROUTES.agentWorkflowDashboardTraces}>
          <ArrowLeft className="h-3.5 w-3.5" />
          All traces
        </Link>
      </Button>
      <PageIntro
        eyebrow="Trace"
        title={data?.run?.input || 'Workflow run'}
        description={
          data?.run
            ? `${data.run.workflow_id || 'No workflow id'} · started ${formatWhen(data.run.start_time)} · trace ${traceId}`
            : `Trace ${traceId}`
        }
        actions={data ? <TraceStatusBadge status={data.status} /> : null}
      />

      <ReportState
        isLoading={isLoading && !data}
        error={error}
        empty={Boolean(data) && rows.length === 0}
        icon={ListTree}
        emptyTitle="No spans in this trace"
        emptyHint="Spans are stored as they finish; reload in a moment if the run is still going."
      />

      {data && rows.length > 0 ? (
        <>
          {data.run?.error ? (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12px] text-red-700 dark:text-red-300">
              {data.run.error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Duration" value={formatLatency(total)} hint={`${formatNumber(rows.length)} spans`} icon={Timer} />
            <StatCard label="Agents" value={formatNumber(data.agents.length)} hint={`${formatNumber(modelCalls)} model calls`} icon={Bot} />
            <StatCard label="Tool calls" value={formatNumber(toolCalls)} hint="Across all agents" icon={Wrench} />
            <StatCard
              label="Tokens"
              value={formatCompact(data.total_tokens)}
              hint={`${formatCompact(data.input_tokens)} in · ${formatCompact(data.output_tokens)} out`}
              icon={Coins}
            />
          </div>

          {data.agents.length > 0 ? (
            <Section title="Agents" className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[11px] text-muted-foreground">
                    <tr>
                      {['Agent', 'Model', 'Runs', 'Time', 'Model calls', 'Tool calls', 'Tokens in', 'Tokens out', 'Errors'].map((label) => (
                        <th key={label} className="whitespace-nowrap px-2 pb-2 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.agents.map((agent) => (
                      <tr key={agent.name} className="border-t border-border/60">
                        <td className="px-2 py-2 font-semibold text-foreground">{agent.name}</td>
                        <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">{agent.model ?? '—'}</td>
                        <td className="px-2 py-2">{formatNumber(agent.invocations)}</td>
                        <td className="px-2 py-2">{formatLatency(agent.duration_ms)}</td>
                        <td className="px-2 py-2">{formatNumber(agent.model_calls)}</td>
                        <td className="px-2 py-2">{formatNumber(agent.tool_calls)}</td>
                        <td className="px-2 py-2">{formatNumber(agent.input_tokens)}</td>
                        <td className="px-2 py-2">{formatNumber(agent.output_tokens)}</td>
                        <td className={cn('px-2 py-2', agent.errors > 0 && 'font-semibold text-red-600 dark:text-red-400')}>
                          {formatNumber(agent.errors)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Section
              title="Timeline"
              action={
                <div className="hidden flex-wrap gap-3 text-[10.5px] text-muted-foreground sm:flex">
                  {SPAN_LEGEND.map((item) => (
                    <span key={item.label} className="inline-flex items-center gap-1">
                      <span className={cn('h-2 w-2 rounded-sm', item.tone)} />
                      {item.label}
                    </span>
                  ))}
                </div>
              }
            >
              <div className="space-y-0.5">
                {rows.map(({ span, depth }) => {
                  const offset = ((Date.parse(span.start_time) - start) / total) * 100
                  const width = Math.max(0.5, (span.duration_ms / total) * 100)
                  return (
                    <button
                      key={span.span_id}
                      type="button"
                      onClick={() => setSelectedId(span.span_id)}
                      aria-pressed={span.span_id === selectedId}
                      className={cn(
                        'grid w-full grid-cols-[minmax(8rem,38%)_1fr] items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/60',
                        span.span_id === selectedId && 'bg-muted',
                      )}
                    >
                      <span className="truncate text-[11.5px] text-foreground" style={{ paddingLeft: depth * 12 }} title={span.name}>
                        {span.name}
                      </span>
                      <span className="relative h-4">
                        <span
                          className={cn('absolute top-0.5 h-3 rounded-sm', spanTone(span.operation, span.name, span.status === 'ERROR'))}
                          style={{ left: `${offset}%`, width: `${width}%` }}
                        />
                        <span
                          className="absolute top-0 text-[10px] tabular-nums text-muted-foreground"
                          style={offset + width > 80 ? { right: `${100 - offset}%`, paddingRight: 4 } : { left: `${offset + width}%`, paddingLeft: 4 }}
                        >
                          {formatLatency(span.duration_ms)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section title={selected ? selected.name : 'Span details'} className="lg:sticky lg:top-0 lg:self-start">
              {selected ? <SpanDetails span={selected} /> : (
                <p className="text-[12px] text-muted-foreground">Pick a span in the timeline to see its attributes, messages and errors.</p>
              )}
            </Section>
          </div>
        </>
      ) : null}
    </div>
  )
}

function SpanDetails({ span }: { span: TraceSpan }) {
  const attributes = Object.entries(span.attributes).sort(([a], [b]) => a.localeCompare(b))
  return (
    <div className="space-y-4 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <TraceStatusBadge status={span.status} />
        <span className="tabular-nums text-muted-foreground">{formatLatency(span.duration_ms)}</span>
        <span className="text-muted-foreground">· {span.kind.toLowerCase()}</span>
      </div>
      {span.status_message ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">{span.status_message}</p>
      ) : null}
      <dl className="space-y-2">
        {attributes.map(([key, value]) => (
          <div key={key}>
            <dt className="font-mono text-[10.5px] text-muted-foreground">{key}</dt>
            <dd className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground">
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
      {span.events.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-foreground">Events</p>
          <ul className="space-y-2">
            {span.events.map((event, index) => (
              <li key={index} className="rounded-md border border-border/70 px-2.5 py-2">
                <p className="font-mono text-[11px] text-foreground">{event.name}</p>
                {Object.entries(event.attributes).map(([key, value]) => (
                  <p key={key} className="mt-1 whitespace-pre-wrap break-words font-mono text-[10.5px] text-muted-foreground">
                    {key}: {formatValue(value)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** Message attributes arrive as JSON strings; pretty-print them when they parse. */
function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object') return JSON.stringify(parsed, null, 2)
    } catch {
      // plain text
    }
    return value
  }
  return JSON.stringify(value, null, 2)
}
