import { useMemo, useState } from 'react'
import { Bot, CheckCircle2, Coins, Cpu, Timer, Wrench, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  ATTR,
  formatDuration,
  formatTokens,
  modelCallState,
  modelCallsOf,
  messagesText,
  numberAttr,
  percent,
  stringAttr,
  useHoverTip,
  type AgentInsight,
  type RunTelemetry,
} from '@/components/agent-workflow/execution-telemetry'
import { IoBlock, Legend, ModelCalledBadge, SectionTitle } from '@/components/agent-workflow/ExecutionUi'

const TOKEN_IN = 'bg-sky-300 dark:bg-sky-700'
const TOKEN_OUT = 'bg-sky-600 dark:bg-sky-400'

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Timer; label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </div>
      <div className={cn('truncate text-[15px] font-semibold tabular-nums text-foreground', tone)}>{value}</div>
    </div>
  )
}

function AgentCard({
  agent,
  telemetry,
  selected,
  onSelect,
}: {
  agent: AgentInsight
  telemetry: RunTelemetry
  selected: boolean
  onSelect: () => void
}) {
  const { tracked, agents } = telemetry
  const { bind, node } = useHoverTip()
  const totalTime = agents.reduce((sum, item) => sum + item.durationMs, 0)
  const tokens = agent.inputTokens + agent.outputTokens
  const failed = agent.errors.length > 0
  const failedTools = agent.toolCalls.filter((call) => call.failed).length
  const timeShare = percent(agent.durationMs, totalTime)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-[3px] border bg-card p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow]',
        selected ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]' : 'border-border hover:border-foreground/25',
        failed && !selected && 'border-red-500/40',
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px]',
            failed ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-foreground/[0.06] text-foreground/70',
          )}
        >
          {failed ? <XCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-foreground">{agent.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {agent.model || (agent.kind === 'executor' ? 'Executor · no model' : 'Model not recorded')}
            {agent.invocations > 1 ? ` · ran ${agent.invocations}×` : ''}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            failed
              ? 'bg-red-500/10 text-red-700 dark:text-red-300'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          )}
        >
          {failed ? 'Failed' : 'Completed'}
        </span>
      </div>

      <ModelCalledBadge state={modelCallState(agent, tracked)} calls={agent.modelCalls} className="self-start" />

      <div className="grid grid-cols-3 gap-2">
        <Metric icon={Timer} label="Time" value={formatDuration(agent.durationMs)} />
        <Metric icon={Cpu} label="Model calls" value={tracked ? String(agent.modelCalls) : '—'} />
        <Metric
          icon={Wrench}
          label="Tool calls"
          value={tracked ? String(agent.toolCalls.length) : '—'}
          tone={failedTools ? 'text-red-600 dark:text-red-400' : undefined}
        />
      </div>

      <div className="space-y-2">
        <div {...bind([agent.name, `${formatDuration(agent.durationMs)}`, `${timeShare}% of agent time`])}>
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Share of time</span>
            <span className="tabular-nums">{timeShare}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/[0.06]">
            <div className="h-full rounded-full bg-foreground/45" style={{ width: `${Math.max(2, timeShare)}%` }} />
          </div>
        </div>
        <div
          {...(tracked
            ? bind([agent.name, `${agent.inputTokens.toLocaleString()} input tokens`, `${agent.outputTokens.toLocaleString()} output tokens`])
            : {})}
        >
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Coins className="h-3 w-3" />
              Tokens
            </span>
            <span className="tabular-nums">
              {tracked ? `${formatTokens(agent.inputTokens)} in · ${formatTokens(agent.outputTokens)} out` : 'Not recorded'}
            </span>
          </div>
          <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-foreground/[0.06]">
            {tracked && tokens > 0 ? (
              <>
                <span className={TOKEN_IN} style={{ width: `${(agent.inputTokens / tokens) * 100}%` }} />
                <span className={TOKEN_OUT} style={{ width: `${(agent.outputTokens / tokens) * 100}%` }} />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <p className={cn('line-clamp-2 min-h-[2.5em] text-[11.5px] leading-snug', failed ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')}>
        {failed ? agent.errors[0] : agent.output.replace(/\s+/g, ' ').trim() || 'No output recorded.'}
      </p>
      {node}
    </button>
  )
}

function AgentPanel({ agent, telemetry }: { agent: AgentInsight; telemetry: RunTelemetry }) {
  const calls = useMemo(() => modelCallsOf(telemetry, agent), [telemetry, agent])
  const start = telemetry.trace?.spans.length ? Math.min(...telemetry.trace.spans.map((span) => Date.parse(span.start_time))) : 0
  const inputHint = telemetry.tracked
    ? 'Not recorded. Set TELEMETRY_SENSITIVE_DATA=true on the server to keep each agent’s prompt.'
    : 'Not recorded for this run.'

  return (
    <div className="space-y-4 rounded-[3px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <h3 className="truncate text-[14px] font-semibold text-foreground">{agent.name}</h3>
        {agent.model ? <span className="truncate text-[11px] text-muted-foreground">{agent.model}</span> : null}
        <ModelCalledBadge state={modelCallState(agent, telemetry.tracked)} calls={agent.modelCalls} className="ml-auto" />
      </div>

      {agent.errors.length > 0 ? (
        <div className="rounded-[3px] border border-red-500/25 bg-red-500/[0.05] px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          {agent.errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <IoBlock label="Input received" text={agent.input} empty={inputHint} />
        <IoBlock label="Output" text={agent.output} empty="No output recorded." />
      </div>

      {calls.length > 0 ? (
        <div className="space-y-1.5">
          <SectionTitle aside={<Legend items={[{ label: 'Input tokens', swatch: TOKEN_IN }, { label: 'Output tokens', swatch: TOKEN_OUT }]} />}>
            Model calls
          </SectionTitle>
          <ul className="divide-y divide-border/60 rounded-[3px] border border-border/70">
            {calls.map((span, index) => {
              const input = numberAttr(span, ATTR.inputTokens)
              const output = numberAttr(span, ATTR.outputTokens)
              const maxTokens = Math.max(1, ...calls.map((call) => numberAttr(call, ATTR.inputTokens) + numberAttr(call, ATTR.outputTokens)))
              const failed = span.status === 'ERROR'
              const reply = messagesText(stringAttr(span, ATTR.outputMessages))
              return (
                <li key={span.span_id} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-3 px-3 py-2 text-[11.5px]">
                  <span className="tabular-nums text-muted-foreground">#{index + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {failed ? <XCircle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" /> : <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                      <span className="truncate font-medium text-foreground">
                        {stringAttr(span, ATTR.responseModel) || stringAttr(span, ATTR.model) || 'Model call'}
                      </span>
                    </div>
                    <div className="truncate text-[10.5px] text-muted-foreground">
                      {failed ? span.status_message || 'Failed' : reply ? reply.replace(/\*\*\w+\*\*\s*/g, '').replace(/\s+/g, ' ') : `at +${formatDuration(Date.parse(span.start_time) - start)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-1.5 flex-1 gap-[2px] overflow-hidden rounded-full bg-foreground/[0.06]">
                      <span className={TOKEN_IN} style={{ width: `${(input / maxTokens) * 100}%` }} />
                      <span className={TOKEN_OUT} style={{ width: `${(output / maxTokens) * 100}%` }} />
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatTokens(input)} / {formatTokens(output)}
                    </span>
                  </div>
                  <span className="text-right tabular-nums text-foreground">{formatDuration(span.duration_ms)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {agent.toolCalls.length > 0 ? (
        <div className="space-y-1.5">
          <SectionTitle>Tool calls</SectionTitle>
          <ul className="space-y-1">
            {agent.toolCalls.map((call) => (
              <li key={call.id} className="rounded-[3px] border border-border/70 px-3 py-1.5 text-[11.5px]">
                <div className="flex items-center gap-2">
                  {call.failed ? (
                    <XCircle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
                  ) : (
                    <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium text-foreground">{call.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatDuration(call.durationMs)}</span>
                  {call.failed && call.error ? <span className="truncate text-red-600 dark:text-red-400">{call.error}</span> : null}
                </div>
                {call.arguments || call.result ? (
                  <div className="mt-1 grid gap-0.5 font-mono text-[10.5px] text-muted-foreground">
                    {call.arguments ? <div className="truncate">args: {call.arguments}</div> : null}
                    {call.result ? <div className="truncate">result: {call.result}</div> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** Every agent in the run as a card of its numbers; pick one to see what it received, returned and called. */
export function ExecutionAgents({ telemetry }: { telemetry: RunTelemetry }) {
  const { agents } = telemetry
  const [selectedName, setSelectedName] = useState<string | null>(
    agents.find((agent) => agent.errors.length > 0)?.name ?? agents[0]?.name ?? null,
  )
  const selected = agents.find((agent) => agent.name === selectedName)

  if (agents.length === 0) {
    return <p className="text-[12px] text-muted-foreground">No agents ran in this execution.</p>
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.name}
            agent={agent}
            telemetry={telemetry}
            selected={agent.name === selectedName}
            onSelect={() => setSelectedName(agent.name === selectedName ? null : agent.name)}
          />
        ))}
      </div>
      {selected ? <AgentPanel agent={selected} telemetry={telemetry} /> : null}
    </div>
  )
}
