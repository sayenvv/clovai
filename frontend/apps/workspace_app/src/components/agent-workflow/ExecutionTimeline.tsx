import { useMemo, useState } from 'react'
import { Bot, ChevronRight, Coins, Cpu, Flag, Play, Wrench, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { ChatMarkdown } from '@/components/agent-workflow/ChatMarkdown'
import type { ExecutionRecord } from '@/services/execution-history-store'
import type { TraceSpan } from '@/services/traces-api'
import {
  ATTR,
  agentName,
  asMarkdown,
  formatDuration,
  formatTokens,
  messagesText,
  numberAttr,
  owningAgent,
  stepRan,
  stringAttr,
  type RunTelemetry,
} from '@/components/agent-workflow/execution-telemetry'

type ActionKind = 'model' | 'tool'
type Filter = 'all' | 'errors'

/** Same hues as the waterfall: agent, model call, tool call. */
const DOT: Record<'agent' | ActionKind | 'run', string> = {
  run: 'bg-foreground/75 text-background',
  agent: 'bg-[#7c3aed] text-white dark:bg-[#8b5cf6]',
  model: 'bg-[#0284c7] text-white',
  tool: 'bg-[#db2777] text-white dark:bg-[#ec4899]',
}

interface Payload {
  label: string
  text: string
  /** Not recorded by the server; worked out from the run (the run's input, the previous output). */
  derived?: boolean
}

/** One model or tool call inside an agent's step. */
interface Action {
  id: string
  kind: ActionKind
  title: string
  start: number
  end: number
  inputTokens: number
  outputTokens: number
  failed: boolean
  error: string
  payloads: Payload[]
}

/** One agent's run: when it started and ended, its tokens, what it got and gave, and its calls. */
interface Step {
  id: string
  agent: string
  model: string
  start: number
  end: number
  inputTokens: number
  outputTokens: number
  failed: boolean
  error: string
  input: Payload
  output: Payload
  actions: Action[]
  /** False when only the start is known (no span, no recorded duration): end and duration show "—". */
  timed: boolean
  /** What happened to the step, as recorded. */
  status: 'completed' | 'failed' | 'running' | 'waiting'
}

function stepStatus(status: ExecutionRecord['trace'][number]['status']): Step['status'] {
  return status === 'error' ? 'failed' : status === 'running' ? 'running' : status === 'waiting-approval' ? 'waiting' : 'completed'
}

const STATUS_BADGE: Record<Step['status'], { label: string; tone: string }> = {
  completed: { label: 'Completed', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  failed: { label: 'Failed', tone: 'bg-red-500/10 text-red-700 dark:text-red-300' },
  running: { label: 'Did not finish', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  waiting: { label: 'Waited for review', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
}

function time(ms: number): string {
  const date = new Date(ms)
  return `${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

function actionOf(span: TraceSpan): Action {
  const start = Date.parse(span.start_time)
  const failed = span.status === 'ERROR'
  if (span.operation === 'chat') {
    return {
      id: span.span_id,
      kind: 'model',
      title: `Called ${stringAttr(span, ATTR.responseModel) || stringAttr(span, ATTR.model) || 'the model'}`,
      start,
      end: start + span.duration_ms,
      inputTokens: numberAttr(span, ATTR.inputTokens),
      outputTokens: numberAttr(span, ATTR.outputTokens),
      failed,
      error: span.status_message,
      payloads: [
        { label: 'Prompt sent', text: messagesText(stringAttr(span, ATTR.inputMessages)) },
        { label: 'Response received', text: messagesText(stringAttr(span, ATTR.outputMessages)) },
      ],
    }
  }
  return {
    id: span.span_id,
    kind: 'tool',
    title: `Called tool ${stringAttr(span, ATTR.tool) || span.name.replace(/^execute_tool\s*/, '')}`,
    start,
    end: start + span.duration_ms,
    inputTokens: 0,
    outputTokens: 0,
    failed,
    error: span.status_message,
    payloads: [
      { label: 'Arguments', text: stringAttr(span, ATTR.toolArguments) },
      { label: 'Result', text: stringAttr(span, ATTR.toolResult) },
    ],
  }
}

/** The run's steps in order: server spans when the run has them, else the steps the browser saw. */
function buildSteps(record: ExecutionRecord, telemetry: RunTelemetry): Step[] {
  const spans = telemetry.trace?.spans ?? []
  const outputFor = (name: string) => {
    const nodeId = record.trace.find((step) => step.agentName === name)?.nodeId
    return (nodeId && record.stepOutputs[nodeId]) || record.messages.filter((message) => message.kind === 'response' && message.agentName === name).map((message) => message.content).join('\n\n')
  }

  let steps: Step[]
  if (spans.length > 0) {
    const byId = new Map(spans.map((span) => [span.span_id, span]))
    const runs = spans
      .filter((span) => span.operation === 'invoke_agent')
      .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
    steps = runs.map((run) => {
      const actions = spans
        .filter((span) => (span.operation === 'chat' || span.operation === 'execute_tool') && owningAgent(span, byId)?.span_id === run.span_id)
        .map(actionOf)
        .sort((a, b) => a.start - b.start)
      const start = Date.parse(run.start_time)
      const name = agentName(run)
      // The server's per-step record (by node id) when the agent span itself has no payload
      const nodeId = telemetry.agents.find((agent) => agent.name === name)?.nodeId
      const recorded = (kind: 'input' | 'output') =>
        (telemetry.trace?.steps ?? [])
          .filter((step) => step.kind === kind && step.payload && (step.agent_id === nodeId || step.agent_id === name))
          .map((step) => step.payload!)
          .join('\n\n---\n\n')
      return {
        id: run.span_id,
        agent: name,
        model: actions.find((action) => action.kind === 'model')?.title.replace(/^Called /, '') ?? '',
        start,
        end: start + run.duration_ms,
        inputTokens: actions.reduce((sum, action) => sum + action.inputTokens, 0),
        outputTokens: actions.reduce((sum, action) => sum + action.outputTokens, 0),
        failed: run.status === 'ERROR' || actions.some((action) => action.failed && action.kind === 'model'),
        error: run.status_message || actions.find((action) => action.failed)?.error || '',
        input: { label: 'Input', text: messagesText(stringAttr(run, ATTR.inputMessages)) || recorded('input') },
        output: { label: 'Output', text: messagesText(stringAttr(run, ATTR.outputMessages)) || recorded('output') || outputFor(name) },
        actions,
        timed: true,
        status: run.status === 'ERROR' ? 'failed' : 'completed',
      }
    })

    // Steps with no model behind them (custom code, validators, routers): their executor spans
    for (const agent of telemetry.agents.filter((item) => item.kind === 'executor')) {
      for (const span of spans.filter((item) => item.name.startsWith('executor.process') && stringAttr(item, 'executor.id') === agent.nodeId)) {
        const start = Date.parse(span.start_time)
        steps.push({
          id: span.span_id,
          agent: agent.name,
          model: 'No model (executor)',
          start,
          end: start + span.duration_ms,
          inputTokens: 0,
          outputTokens: 0,
          failed: span.status === 'ERROR',
          error: span.status_message,
          input: { label: 'Input', text: agent.input },
          output: { label: 'Output', text: agent.output },
          actions: [],
          timed: true,
          status: span.status === 'ERROR' ? 'failed' : 'completed',
        })
      }
    }
    // Steps the run recorded that the trace lacks
    for (const item of record.trace) {
      if (!stepRan(item) || steps.some((step) => step.agent === item.agentName)) continue
      const stamp = new Date(item.timestamp).getTime()
      const start = Number.isFinite(stamp) ? stamp : new Date(record.startedAt).getTime()
      steps.push({
        id: item.id,
        agent: item.agentName,
        model: '',
        start,
        end: start + (item.durationMs ?? 0),
        inputTokens: 0,
        outputTokens: 0,
        failed: item.status === 'error',
        error: item.status === 'error' ? item.message : '',
        input: { label: 'Input', text: '' },
        output: { label: 'Output', text: item.output || (item.nodeId ? record.stepOutputs[item.nodeId] ?? '' : '') || outputFor(item.agentName) },
        actions: [],
        timed: item.durationMs !== undefined,
        status: stepStatus(item.status),
      })
    }
    steps.sort((a, b) => a.start - b.start)
  } else {
    const runStart = new Date(record.startedAt).getTime()
    steps = record.trace.filter(stepRan).map((item) => {
      const stamp = new Date(item.timestamp).getTime()
      const start = Number.isFinite(stamp) ? stamp : runStart
      return {
        id: item.id,
        agent: item.agentName,
        model: '',
        start,
        end: start + (item.durationMs ?? 0),
        inputTokens: 0,
        outputTokens: 0,
        failed: item.status === 'error',
        error: item.status === 'error' ? item.message : '',
        input: { label: 'Input', text: '' },
        output: { label: 'Output', text: item.output || (item.nodeId ? record.stepOutputs[item.nodeId] ?? '' : '') || outputFor(item.agentName) },
        actions: [],
        timed: item.durationMs !== undefined,
        status: stepStatus(item.status),
      }
    })
  }

  // Inputs the server did not keep: the run's input for the first step, else the step before's output.
  steps.forEach((step, index) => {
    if (step.input.text.trim()) return
    const previous = steps[index - 1]
    step.input = previous
      ? { label: `Input (from ${previous.agent})`, text: previous.output.text, derived: true }
      : { label: 'Input (the run’s input)', text: record.input, derived: true }
  })
  return steps
}

function TokenChips({ input, output }: { input: number; output: number }) {
  if (input + output === 0) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] tabular-nums text-muted-foreground">
      <Coins className="h-3 w-3" />
      <span className="font-medium text-foreground">{formatTokens(input + output)}</span>
      <span>({formatTokens(input)} in · {formatTokens(output)} out)</span>
    </span>
  )
}

function PayloadBox({ payload, empty }: { payload: Payload; empty: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {payload.label}
        {payload.derived ? (
          <span className="rounded-full bg-foreground/[0.06] px-1.5 py-px text-[9px] font-medium normal-case tracking-normal">derived</span>
        ) : null}
      </div>
      <div className="max-h-80 overflow-y-auto rounded-[3px] border border-border/70 bg-background px-3 py-2">
        {payload.text.trim() ? (
          <ChatMarkdown content={asMarkdown(payload.text)} className="text-[12px]" />
        ) : (
          <p className="text-[11.5px] text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  )
}

/** Start → end on the run's clock, with the duration between. */
function Span({ start, end, origin }: { start: number; end: number; origin: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] tabular-nums text-muted-foreground">
      <span title={time(start)}>+{formatDuration(start - origin)}</span>
      <span aria-hidden>→</span>
      <span title={time(end)}>+{formatDuration(end - origin)}</span>
      <span className="rounded-full border border-border px-1.5 py-px font-medium text-foreground">{formatDuration(end - start)}</span>
    </span>
  )
}

function ActionRow({ action, origin, sensitiveHint }: { action: Action; origin: number; sensitiveHint: string }) {
  const [open, setOpen] = useState(action.failed)
  const Icon = action.kind === 'model' ? Cpu : Wrench
  return (
    <li className="relative pl-6">
      <span
        className={cn(
          'absolute left-0 top-2 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-card',
          action.failed ? 'bg-red-600 text-white' : DOT[action.kind],
        )}
      >
        {action.failed ? <XCircle className="h-2.5 w-2.5" /> : <Icon className="h-2.5 w-2.5" />}
      </span>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn(
          'flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-[3px] px-2 py-1.5 text-left hover:bg-foreground/[0.03]',
          action.failed && 'bg-red-500/[0.04]',
        )}
      >
        <span className="min-w-0 truncate text-[12px] font-medium text-foreground">{action.title}</span>
        <Span start={action.start} end={action.end} origin={origin} />
        <TokenChips input={action.inputTokens} output={action.outputTokens} />
        <span className="flex-1" />
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      {open ? (
        <div className="space-y-2 px-2 pb-2 pt-1">
          {action.error ? (
            <p className="rounded-[3px] border border-red-500/25 bg-red-500/[0.05] px-2.5 py-1.5 text-[11.5px] text-red-700 dark:text-red-300">{action.error}</p>
          ) : null}
          <div className="grid gap-2 lg:grid-cols-2">
            {action.payloads.map((payload) => (
              <PayloadBox key={payload.label} payload={payload} empty={sensitiveHint} />
            ))}
          </div>
        </div>
      ) : null}
    </li>
  )
}

function StepCard({ step, index, origin, last, sensitiveHint, tracked }: { step: Step; index: number; origin: number; last: boolean; sensitiveHint: string; tracked: boolean }) {
  const [open, setOpen] = useState(step.failed)
  const models = step.actions.filter((action) => action.kind === 'model').length
  const tools = step.actions.filter((action) => action.kind === 'tool').length
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3">
      <div className="relative flex justify-center">
        <span className={cn('relative z-10 mt-3 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background', step.failed ? 'bg-red-600 text-white' : DOT.agent)}>
          {step.failed ? <XCircle className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </span>
        {!last ? <span className="absolute bottom-0 left-1/2 top-3 w-px -translate-x-1/2 bg-border" aria-hidden /> : null}
      </div>

      <div className="min-w-0 pb-4">
        <div className={cn('overflow-hidden rounded-[3px] border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]', step.failed ? 'border-red-500/40' : 'border-border')}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex w-full min-w-0 items-start gap-3 px-3 py-2.5 text-left hover:bg-foreground/[0.02]"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-[10.5px] font-semibold tabular-nums text-muted-foreground">Step {index + 1}</span>
                <span className="truncate text-[13px] font-semibold text-foreground">{step.agent}</span>
                {step.model ? <span className="truncate text-[11px] text-muted-foreground">{step.model}</span> : null}
                <span className={cn('ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', STATUS_BADGE[step.failed ? 'failed' : step.status].tone)}>
                  {STATUS_BADGE[step.failed ? 'failed' : step.status].label}
                </span>
              </div>
              {/* The step at a glance: start, end, duration, tokens, calls */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4 lg:grid-cols-8">
                {[
                  ['Started', time(step.start)],
                  ['Ended', step.timed ? time(step.end) : '—'],
                  ['Duration', step.timed ? formatDuration(step.end - step.start) : '—'],
                  ['Input tokens', step.inputTokens ? step.inputTokens.toLocaleString() : '—'],
                  ['Output tokens', step.outputTokens ? step.outputTokens.toLocaleString() : '—'],
                  ['Total tokens', step.inputTokens + step.outputTokens ? (step.inputTokens + step.outputTokens).toLocaleString() : '—'],
                  ['Model called', !tracked ? '—' : models > 0 ? `Yes (${models}×)` : 'No'],
                  ['Tool calls', tracked ? String(tools) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <div className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
                    <div className="truncate font-medium tabular-nums text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              {!open ? (
                <p className={cn('truncate text-[11.5px]', step.failed ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')}>
                  {step.failed ? step.error : step.output.text.replace(/\*\*\w+\*\*\s*/g, '').replace(/\s+/g, ' ') || 'No output recorded.'}
                </p>
              ) : null}
            </div>
            <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
          </button>

          {open ? (
            <div className="space-y-3 border-t border-border/60 bg-foreground/[0.015] px-3 py-3">
              {step.error ? (
                <p className="rounded-[3px] border border-red-500/25 bg-red-500/[0.05] px-3 py-2 text-[12px] text-red-700 dark:text-red-300">{step.error}</p>
              ) : null}
              <div className="grid gap-3 lg:grid-cols-2">
                <PayloadBox payload={step.input} empty="No input recorded." />
                <PayloadBox payload={step.output} empty="No output recorded." />
              </div>
              {step.actions.length > 0 ? (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Actions ({step.actions.length})
                  </div>
                  <ol className="relative space-y-0.5 before:absolute before:bottom-2 before:left-[7.5px] before:top-2 before:w-px before:bg-border">
                    {step.actions.map((action) => (
                      <ActionRow key={action.id} action={action} origin={origin} sensitiveHint={sensitiveHint} />
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function Marker({ icon: Icon, title, detail, failed, last }: { icon: typeof Play; title: string; detail: string; failed?: boolean; last?: boolean }) {
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3">
      <div className="relative flex justify-center">
        <span className={cn('relative z-10 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background', failed ? 'bg-red-600 text-white' : DOT.run)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {!last ? <span className="absolute bottom-0 left-1/2 top-3 w-px -translate-x-1/2 bg-border" aria-hidden /> : null}
      </div>
      <div className={cn('flex min-w-0 items-baseline gap-2 pt-1', !last && 'pb-4')}>
        <span className="text-[12.5px] font-semibold text-foreground">{title}</span>
        <span className="truncate text-[11px] tabular-nums text-muted-foreground">{detail}</span>
      </div>
    </li>
  )
}

/** Every step of the run in order: each agent's start, end, tokens, input and output, and its calls. */
export function ExecutionTimeline({ record, telemetry }: { record: ExecutionRecord; telemetry: RunTelemetry }) {
  const [filter, setFilter] = useState<Filter>('all')
  const steps = useMemo(() => buildSteps(record, telemetry), [record, telemetry])
  const origin = Math.min(new Date(record.startedAt).getTime(), ...steps.map((step) => step.start))
  const end = Math.max(new Date(record.finishedAt).getTime(), ...steps.map((step) => step.end))
  const shown = filter === 'errors' ? steps.filter((step) => step.failed || step.actions.some((action) => action.failed)) : steps
  const failedCount = steps.filter((step) => step.failed || step.actions.some((action) => action.failed)).length
  const sensitiveHint = telemetry.tracked
    ? 'Not recorded. Set TELEMETRY_SENSITIVE_DATA=true on the server to keep prompts, responses and tool data.'
    : 'Not recorded for this run.'
  const tokens = steps.reduce((sum, step) => sum + step.inputTokens + step.outputTokens, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Show steps" className="inline-flex rounded-[3px] border border-border bg-card p-0.5">
          {(
            [
              ['all', `All steps`, steps.length],
              ['errors', 'With errors', failedCount],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={filter === id}
              disabled={id === 'errors' && count === 0}
              onClick={() => setFilter(id)}
              className={cn(
                'rounded-[2px] px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-40',
                filter === id ? 'bg-foreground/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              <span className="ml-1 tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
        <span className="text-[10.5px] text-muted-foreground">
          {telemetry.tracked ? 'Times are from the server trace; open a step for its input, output and calls.' : 'No server trace: agent steps only.'}
        </span>
      </div>

      <ol className="max-w-5xl">
        <Marker icon={Play} title="Run started" detail={time(origin)} />
        {shown.map((step) => (
          <StepCard key={step.id} step={step} index={steps.indexOf(step)} origin={origin} last={false} sensitiveHint={sensitiveHint} tracked={telemetry.tracked} />
        ))}
        {shown.length === 0 ? (
          <li className="pb-4 pl-10 text-[12px] text-muted-foreground">No steps were recorded.</li>
        ) : null}
        <Marker
          icon={Flag}
          title={record.status === 'completed' ? 'Run completed' : record.status === 'failed' ? 'Run failed' : 'Run cancelled'}
          detail={`${time(end)} · ${formatDuration(end - origin)} total${tokens ? ` · ${formatTokens(tokens)} tokens` : ''}`}
          failed={record.status === 'failed'}
          last
        />
      </ol>
    </div>
  )
}
