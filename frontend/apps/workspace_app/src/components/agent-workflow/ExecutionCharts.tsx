import { useMemo, type ReactNode } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ExecutionRecord } from '@/services/execution-history-store'
import type { TraceSpan } from '@/services/traces-api'
import {
  ATTR,
  agentName,
  formatDuration,
  formatTokens,
  numberAttr,
  owningAgent,
  percent,
  stringAttr,
  useHoverTip,
  type RunTelemetry,
} from '@/components/agent-workflow/execution-telemetry'
import { Legend } from '@/components/agent-workflow/ExecutionUi'

/** Same hues as the waterfall and timeline. */
const MODEL = 'bg-[#0284c7]'
const TOOL = 'bg-[#db2777] dark:bg-[#ec4899]'
const OTHER = 'bg-foreground/25'
const TOKEN_IN = 'bg-sky-300 dark:bg-sky-700'
const TOKEN_OUT = 'bg-sky-600 dark:bg-sky-400'

function ChartCard({ title, subtitle, legend, children, className }: {
  title: string
  subtitle?: string
  legend?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-w-0 rounded-[3px] border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[12.5px] font-semibold text-foreground">{title}</h4>
          {subtitle ? <p className="text-[10.5px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {legend}
      </div>
      {children}
    </section>
  )
}

interface Column {
  key: string
  /** Stacked bottom to top. */
  segments: Array<{ value: number; className: string }>
  tip: string[]
  label?: string
  highlight?: boolean
  flag?: 'warning' | 'error'
}

/** Columns on one shared axis, with a max and a mid gridline; hover a column for its numbers. */
function ColumnChart({ columns, format, height = 128 }: { columns: Column[]; format: (value: number) => string; height?: number }) {
  const { bind, node } = useHoverTip()
  const max = Math.max(1, ...columns.map((column) => column.segments.reduce((sum, segment) => sum + segment.value, 0)))
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
      <div className="relative text-right text-[9.5px] tabular-nums text-muted-foreground" style={{ height }}>
        <span className="absolute right-0 top-0 -translate-y-1/2">{format(max)}</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2">{format(max / 2)}</span>
        <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
      </div>
      <div className="min-w-0">
        <div className="relative flex items-end gap-[2px] border-b border-border" style={{ height }}>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border/60" aria-hidden />
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border/60" aria-hidden />
          {columns.map((column) => {
            const total = column.segments.reduce((sum, segment) => sum + segment.value, 0)
            return (
              <div
                key={column.key}
                className="group/col relative flex h-full min-w-[3px] flex-1 flex-col justify-end"
                {...bind(column.tip)}
              >
                <div
                  className={cn(
                    'flex flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity group-hover/col:opacity-80',
                    column.highlight && 'ring-2 ring-foreground/60 ring-offset-1 ring-offset-card',
                  )}
                  style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? 2 : 0 }}
                >
                  {column.segments.map((segment, index) =>
                    segment.value > 0 ? (
                      <span key={index} className={cn('w-full', segment.className)} style={{ flexGrow: segment.value, flexBasis: 0 }} />
                    ) : null,
                  )}
                </div>
                {column.flag ? (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2">
                    {column.flag === 'error' ? (
                      <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    )}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
        {columns.some((column) => column.label) ? (
          <div className="mt-1 flex gap-[2px]">
            {columns.map((column) => (
              <span key={column.key} className="min-w-[3px] flex-1 truncate text-center text-[9.5px] text-muted-foreground">
                {column.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {node}
    </div>
  )
}

function modelCalls(telemetry: RunTelemetry) {
  const spans = telemetry.trace?.spans ?? []
  const byId = new Map(spans.map((span) => [span.span_id, span]))
  return spans
    .filter((span) => span.operation === 'chat')
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    .map((span) => {
      const owner = owningAgent(span, byId)
      return { span, agent: owner ? agentName(owner) : 'Agent' }
    })
}

/** Where each agent's time went: waiting on the model, running tools, or everything else. */
function TimeComposition({ telemetry }: { telemetry: RunTelemetry }) {
  const { bind, node } = useHoverTip()
  const rows = useMemo(() => {
    const spans = telemetry.trace?.spans ?? []
    const byId = new Map(spans.map((span) => [span.span_id, span]))
    const sum = (agent: string, operation: string) =>
      spans
        .filter((span: TraceSpan) => span.operation === operation)
        .filter((span) => {
          const owner = owningAgent(span, byId)
          return owner ? agentName(owner) === agent : false
        })
        .reduce((total, span) => total + span.duration_ms, 0)
    return telemetry.agents.map((agent) => {
      const model = Math.min(agent.durationMs, sum(agent.name, 'chat'))
      const tool = Math.min(Math.max(0, agent.durationMs - model), sum(agent.name, 'execute_tool'))
      return { name: agent.name, total: agent.durationMs, model, tool, other: Math.max(0, agent.durationMs - model - tool) }
    })
  }, [telemetry])
  const max = Math.max(1, ...rows.map((row) => row.total))
  return (
    <ChartCard
      title="Where agent time goes"
      subtitle="Waiting on the model, running tools, and everything else (framework, hand-offs)."
      legend={<Legend items={[{ label: 'Model', swatch: MODEL }, { label: 'Tools', swatch: TOOL }, { label: 'Other', swatch: OTHER }]} />}
    >
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.name} className="grid grid-cols-[minmax(6rem,28%)_minmax(0,1fr)_3.5rem] items-center gap-2">
            <span className="truncate text-[11.5px] font-medium text-foreground">{row.name}</span>
            <span
              className="flex h-3 gap-[2px]"
              {...bind([
                row.name,
                `Model ${formatDuration(row.model)} (${percent(row.model, row.total)}%)`,
                `Tools ${formatDuration(row.tool)} (${percent(row.tool, row.total)}%)`,
                `Other ${formatDuration(row.other)} (${percent(row.other, row.total)}%)`,
              ])}
            >
              <span className="flex h-full gap-[2px]" style={{ width: `${(row.total / max) * 100}%` }}>
                {row.model > 0 ? <span className={cn('h-full first:rounded-l-[3px] last:rounded-r-[3px]', MODEL)} style={{ flexGrow: row.model, flexBasis: 0 }} /> : null}
                {row.tool > 0 ? <span className={cn('h-full first:rounded-l-[3px] last:rounded-r-[3px]', TOOL)} style={{ flexGrow: row.tool, flexBasis: 0 }} /> : null}
                {row.other > 0 ? <span className={cn('h-full first:rounded-l-[3px] last:rounded-r-[3px]', OTHER)} style={{ flexGrow: row.other, flexBasis: 0 }} /> : null}
              </span>
            </span>
            <span className="text-right text-[11px] tabular-nums text-foreground">{formatDuration(row.total)}</span>
          </li>
        ))}
      </ul>
      {node}
    </ChartCard>
  )
}

/** Tokens per model call in run order: a rising input bar means the context keeps growing. */
function TokensPerCall({ telemetry }: { telemetry: RunTelemetry }) {
  const calls = useMemo(() => modelCalls(telemetry), [telemetry])
  const inputs = calls.map(({ span }) => numberAttr(span, ATTR.inputTokens))
  const growing = inputs.length >= 3 && inputs[inputs.length - 1] > inputs[0] * 2
  return (
    <ChartCard
      title="Tokens per model call"
      subtitle={growing ? 'Input grows call after call: the conversation history is being resent.' : 'Each call’s input and output, in run order.'}
      legend={<Legend items={[{ label: 'Input', swatch: TOKEN_IN }, { label: 'Output', swatch: TOKEN_OUT }]} />}
    >
      <ColumnChart
        format={formatTokens}
        columns={calls.map(({ span, agent }, index) => {
          const input = numberAttr(span, ATTR.inputTokens)
          const output = numberAttr(span, ATTR.outputTokens)
          return {
            key: span.span_id,
            label: calls.length <= 12 ? `#${index + 1}` : undefined,
            segments: [
              { value: input, className: TOKEN_IN },
              { value: output, className: TOKEN_OUT },
            ],
            tip: [`Call #${index + 1} · ${agent}`, `${input.toLocaleString()} input`, `${output.toLocaleString()} output`],
            flag: span.status === 'ERROR' ? 'error' : undefined,
          }
        })}
      />
    </ChartCard>
  )
}

/** How long each model call took; calls over twice the median are flagged. */
function LatencyPerCall({ telemetry }: { telemetry: RunTelemetry }) {
  const calls = useMemo(() => modelCalls(telemetry), [telemetry])
  const sorted = calls.map(({ span }) => span.duration_ms).sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
  const slow = calls.filter(({ span }) => calls.length > 2 && span.duration_ms > median * 2).length
  return (
    <ChartCard
      title="Model call latency"
      subtitle={slow ? `${slow} call${slow === 1 ? '' : 's'} over twice the median (${formatDuration(median)}).` : `Median ${formatDuration(median)} per call.`}
    >
      <ColumnChart
        format={formatDuration}
        columns={calls.map(({ span, agent }, index) => {
          const isSlow = calls.length > 2 && span.duration_ms > median * 2
          const output = numberAttr(span, ATTR.outputTokens)
          return {
            key: span.span_id,
            label: calls.length <= 12 ? `#${index + 1}` : undefined,
            segments: [{ value: span.duration_ms, className: isSlow ? 'bg-amber-500' : 'bg-foreground/45' }],
            tip: [
              `Call #${index + 1} · ${agent}`,
              stringAttr(span, ATTR.responseModel) || stringAttr(span, ATTR.model) || 'Model call',
              formatDuration(span.duration_ms),
              output > 0 ? `${Math.round((output / Math.max(1, span.duration_ms)) * 1000)} output tokens/s` : '',
            ].filter(Boolean),
            flag: span.status === 'ERROR' ? 'error' : isSlow ? 'warning' : undefined,
          }
        })}
      />
    </ChartCard>
  )
}

/** This workflow's recent runs: is this one slower than usual, and how often do runs fail? */
function RunHistory({ record, history }: { record: ExecutionRecord; history: ExecutionRecord[] }) {
  const runs = [...history].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)).slice(-20)
  const duration = (run: ExecutionRecord) => Date.parse(run.finishedAt) - Date.parse(run.startedAt)
  const others = runs.filter((run) => run.id !== record.id).map(duration).sort((a, b) => a - b)
  const typical = others.length ? others[Math.floor(others.length / 2)] : 0
  const failed = runs.filter((run) => run.status === 'failed').length
  const current = duration(record)
  const versus = typical ? Math.round(((current - typical) / typical) * 100) : 0
  return (
    <ChartCard
      title="Recent runs of this workflow"
      subtitle={
        others.length
          ? `This run took ${formatDuration(current)}, ${versus === 0 ? 'the same as' : `${Math.abs(versus)}% ${versus > 0 ? 'slower than' : 'faster than'}`} the typical ${formatDuration(typical)}. ${failed} of ${runs.length} failed.`
          : 'The first recorded run of this workflow.'
      }
      legend={<Legend items={[{ label: 'Completed', swatch: 'bg-foreground/40' }, { label: 'Failed', swatch: 'bg-red-500' }]} />}
    >
      <ColumnChart
        format={formatDuration}
        height={96}
        columns={runs.map((run) => ({
          key: run.id,
          segments: [{ value: duration(run), className: run.status === 'failed' ? 'bg-red-500' : run.id === record.id ? 'bg-foreground/70' : 'bg-foreground/40' }],
          tip: [
            new Date(run.startedAt).toLocaleString(),
            `${formatDuration(duration(run))} · ${run.status}`,
            run.id === record.id ? 'This run' : '',
          ].filter(Boolean),
          highlight: run.id === record.id,
          flag: run.status === 'failed' ? 'error' : undefined,
        }))}
      />
    </ChartCard>
  )
}

/** The Insights charts: time composition, tokens and latency per model call, and recent runs. */
export function ExecutionCharts({ record, telemetry, history }: { record: ExecutionRecord; telemetry: RunTelemetry; history: ExecutionRecord[] }) {
  const hasCalls = (telemetry.trace?.spans ?? []).some((span) => span.operation === 'chat')
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {telemetry.tracked && telemetry.agents.length > 0 ? <TimeComposition telemetry={telemetry} /> : null}
      <RunHistory record={record} history={history} />
      {hasCalls ? <TokensPerCall telemetry={telemetry} /> : null}
      {hasCalls ? <LatencyPerCall telemetry={telemetry} /> : null}
    </div>
  )
}
