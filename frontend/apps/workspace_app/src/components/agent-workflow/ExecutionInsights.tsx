import { Bot, CheckCircle2, Clock, Coins, Cpu, Flame, Timer, Wrench, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { ExecutionRecord } from '@/services/execution-history-store'
import type { TraceDetail } from '@/services/traces-api'
import {
  ATTR,
  OPERATIONS,
  SEVERITY,
  agentName,
  formatDuration,
  formatTokens,
  modelCallState,
  isOperation,
  numberAttr,
  owningAgent,
  percent,
  stringAttr,
  useHoverTip,
  type AgentInsight,
  type Operation,
  type RunTelemetry,
} from '@/components/agent-workflow/execution-telemetry'
import { Legend, ModelCalledBadge, SectionTitle, Stat } from '@/components/agent-workflow/ExecutionUi'
import { ExecutionCharts } from '@/components/agent-workflow/ExecutionCharts'

/* ---------------------------------------------------------------- breakdown */

const TOKEN_IN = 'bg-sky-300 dark:bg-sky-700'
const TOKEN_OUT = 'bg-sky-600 dark:bg-sky-400'

function AgentBreakdown({ agents, tracked }: { agents: AgentInsight[]; tracked: boolean }) {
  const { bind, node } = useHoverTip()
  const maxTime = Math.max(1, ...agents.map((agent) => agent.durationMs))
  const maxTokens = Math.max(1, ...agents.map((agent) => agent.inputTokens + agent.outputTokens))
  const totalTime = agents.reduce((sum, agent) => sum + agent.durationMs, 0)
  const totalTokens = agents.reduce((sum, agent) => sum + agent.inputTokens + agent.outputTokens, 0)

  return (
    <section className="space-y-2">
      <SectionTitle
        aside={
          tracked ? (
            <Legend
              items={[
                { label: 'Time', swatch: 'bg-foreground/45' },
                { label: 'Input tokens', swatch: TOKEN_IN },
                { label: 'Output tokens', swatch: TOKEN_OUT },
              ]}
            />
          ) : null
        }
      >
        Where time and tokens go
      </SectionTitle>
      <div className="overflow-x-auto rounded-[3px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead className="text-[10.5px] text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="px-3 py-2 font-medium">Agent</th>
              <th className="w-[26%] px-3 py-2 font-medium">Time</th>
              <th className="w-[26%] px-3 py-2 font-medium">Tokens</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 text-right font-medium">Model calls</th>
              <th className="px-3 py-2 text-right font-medium">Tools</th>
              <th className="px-3 py-2 text-right font-medium">Errors</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {agents.map((agent) => {
              const tokens = agent.inputTokens + agent.outputTokens
              return (
                <tr key={agent.name} className="border-t border-border/50 first:border-t-0">
                  <td className="px-3 py-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {agent.errors.length > 0 ? (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-medium text-foreground">{agent.name}</span>
                    </div>
                    {agent.model ? <div className="ml-5 truncate text-[10.5px] text-muted-foreground">{agent.model}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <div
                      className="flex items-center gap-2"
                      {...bind([agent.name, `${formatDuration(agent.durationMs)} · ${percent(agent.durationMs, totalTime)}% of agent time`])}
                    >
                      <span className="relative h-2 flex-1 rounded-full bg-foreground/[0.06]">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-foreground/45"
                          style={{ width: `${Math.max(2, (agent.durationMs / maxTime) * 100)}%` }}
                        />
                      </span>
                      <span className="w-14 shrink-0 text-right text-[11px] text-foreground">{formatDuration(agent.durationMs)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {tracked ? (
                      <div
                        className="flex items-center gap-2"
                        {...bind([
                          agent.name,
                          `${agent.inputTokens.toLocaleString()} input`,
                          `${agent.outputTokens.toLocaleString()} output`,
                          `${percent(tokens, totalTokens)}% of the run`,
                        ])}
                      >
                        <span className="flex h-2 flex-1 gap-[2px] overflow-hidden rounded-full bg-foreground/[0.06]">
                          {agent.inputTokens > 0 ? (
                            <span className={cn('h-full', TOKEN_IN)} style={{ width: `${(agent.inputTokens / maxTokens) * 100}%` }} />
                          ) : null}
                          {agent.outputTokens > 0 ? (
                            <span className={cn('h-full rounded-r-full', TOKEN_OUT)} style={{ width: `${(agent.outputTokens / maxTokens) * 100}%` }} />
                          ) : null}
                        </span>
                        <span className="w-12 shrink-0 text-right text-[11px] text-foreground">{formatTokens(tokens)}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Not recorded</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ModelCalledBadge state={modelCallState(agent, tracked)} calls={agent.modelCalls} />
                  </td>
                  <td className="px-3 py-2 text-right">{tracked ? agent.modelCalls : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {tracked ? (
                      <span className={cn(agent.toolCalls.some((call) => call.failed) && 'font-semibold text-red-600 dark:text-red-400')}>
                        {agent.toolCalls.length}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={cn('px-3 py-2 text-right', agent.errors.length > 0 && 'font-semibold text-red-600 dark:text-red-400')}>
                    {agent.errors.length}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {node}
    </section>
  )
}

/* ---------------------------------------------------------------- timeline */

function Timeline({ trace }: { trace: TraceDetail }) {
  const { bind, node } = useHoverTip()
  const byId = new Map(trace.spans.map((span) => [span.span_id, span]))
  const calls = trace.spans
    .filter((span) => isOperation(span.operation))
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
  if (calls.length === 0) return null
  const start = Math.min(...calls.map((span) => Date.parse(span.start_time)))
  const end = Math.max(...calls.map((span) => Date.parse(span.end_time)))
  const total = Math.max(1, end - start)
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <section className="space-y-2">
      <SectionTitle
        aside={<Legend items={(Object.keys(OPERATIONS) as Operation[]).map((key) => ({ label: OPERATIONS[key].label, swatch: OPERATIONS[key].swatch }))} />}
      >
        Waterfall
      </SectionTitle>
      <div className="rounded-[3px] border border-border bg-card p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[minmax(9rem,32%)_1fr] gap-2 px-1 pb-1">
          <span />
          <div className="relative h-4 text-[9.5px] tabular-nums text-muted-foreground">
            {ticks.map((tick) => (
              <span
                key={tick}
                className={cn('absolute top-0', tick === 0 ? '' : tick === 1 ? '-translate-x-full' : '-translate-x-1/2')}
                style={{ left: `${tick * 100}%` }}
              >
                {formatDuration(total * tick)}
              </span>
            ))}
          </div>
        </div>
        <ol className="space-y-px">
          {calls.map((span) => {
            const operation = span.operation as Operation
            const meta = OPERATIONS[operation]
            const owner = owningAgent(span, byId)
            const nested = operation !== 'invoke_agent'
            const label =
              operation === 'invoke_agent'
                ? agentName(span)
                : operation === 'chat'
                  ? stringAttr(span, ATTR.responseModel) || stringAttr(span, ATTR.model) || 'Model call'
                  : stringAttr(span, ATTR.tool) || span.name
            const offset = ((Date.parse(span.start_time) - start) / total) * 100
            const width = Math.max(0.6, (span.duration_ms / total) * 100)
            const failed = span.status === 'ERROR'
            const tokens = numberAttr(span, ATTR.inputTokens) + numberAttr(span, ATTR.outputTokens)
            const lines = [
              `${meta.label}: ${label}`,
              owner && nested ? `in ${agentName(owner)}` : '',
              `${formatDuration(span.duration_ms)} · starts at ${formatDuration(Date.parse(span.start_time) - start)}`,
              tokens > 0 ? `${numberAttr(span, ATTR.inputTokens).toLocaleString()} in · ${numberAttr(span, ATTR.outputTokens).toLocaleString()} out` : '',
              failed ? `Error: ${span.status_message || 'failed'}` : '',
            ].filter(Boolean)
            return (
              <li key={span.span_id} className="grid grid-cols-[minmax(9rem,32%)_1fr] items-center gap-2 rounded-[2px] px-1 py-[3px] hover:bg-foreground/[0.03]" {...bind(lines)}>
                <span className={cn('flex min-w-0 items-center gap-1.5 text-[11.5px]', nested ? 'pl-4 text-muted-foreground' : 'font-medium text-foreground')}>
                  {failed ? <XCircle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" /> : <meta.icon className="h-3 w-3 shrink-0 opacity-70" />}
                  <span className="truncate">{label}</span>
                </span>
                <span className="relative h-3.5">
                  {ticks.slice(1, -1).map((tick) => (
                    <span key={tick} className="absolute inset-y-0 w-px bg-border/60" style={{ left: `${tick * 100}%` }} aria-hidden />
                  ))}
                  <span
                    className={cn(
                      'absolute top-[1px] h-3 rounded-[3px]',
                      meta.swatch,
                      failed && 'ring-2 ring-red-500 ring-offset-1 ring-offset-card',
                      nested ? 'opacity-90' : '',
                    )}
                    style={{ left: `${offset}%`, width: `${width}%` }}
                  />
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      {node}
    </section>
  )
}

export function ExecutionInsights({ record, telemetry, history }: { record: ExecutionRecord; telemetry: RunTelemetry; history: ExecutionRecord[] }) {
  const { trace, traceState, tracked, agents, findings, totalMs } = telemetry
  const inputTokens = tracked ? trace!.input_tokens : 0
  const outputTokens = tracked ? trace!.output_tokens : 0
  const modelCalls = agents.reduce((sum, agent) => sum + agent.modelCalls, 0)
  const toolCalls = agents.reduce((sum, agent) => sum + agent.toolCalls.length, 0)
  const failedTools = agents.reduce((sum, agent) => sum + agent.toolCalls.filter((call) => call.failed).length, 0)
  const errors = agents.reduce((sum, agent) => sum + agent.errors.length, 0) + runLevelErrors(record, agents)
  const agentTime = agents.reduce((sum, agent) => sum + agent.durationMs, 0)

  return (
    <div className="space-y-5">
      {traceState === 'loading' ? (
        <p className="text-[11px] text-muted-foreground">Loading the server trace…</p>
      ) : traceState === 'error' ? (
        <p className="text-[11px] text-muted-foreground">The server trace could not be loaded; showing what this browser recorded.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Clock} label="Total time" value={formatDuration(totalMs)} detail={agentTime ? `${formatDuration(agentTime)} in agents` : undefined} />
        <Stat icon={Bot} label="Agents" value={String(agents.length)} detail={`${agents.reduce((sum, agent) => sum + agent.invocations, 0)} runs`} />
        <Stat
          icon={Coins}
          label="Total tokens"
          value={tracked ? formatTokens(inputTokens + outputTokens) : '—'}
          detail={tracked ? `${formatTokens(inputTokens)} in · ${formatTokens(outputTokens)} out` : 'Not recorded'}
        />
        <Stat icon={Cpu} label="Model calls" value={tracked ? String(modelCalls) : '—'} detail={tracked ? slowestCallLabel(agents, modelCalls) : 'Not recorded'} />
        <Stat
          icon={Wrench}
          label="Tool calls"
          value={tracked ? String(toolCalls) : '—'}
          detail={tracked ? (failedTools ? `${failedTools} failed` : 'none failed') : 'Not recorded'}
          tone={failedTools ? 'text-red-600 dark:text-red-400' : undefined}
        />
        <Stat
          icon={errors > 0 ? Flame : CheckCircle2}
          label="Errors"
          value={String(errors)}
          detail={record.warnings.length ? `${record.warnings.length} warning${record.warnings.length === 1 ? '' : 's'}` : 'no warnings'}
          tone={errors > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}
        />
      </div>

      {findings.length > 0 ? (
        <section className="space-y-2">
          <SectionTitle>What to look at</SectionTitle>
          <ul className="grid gap-2 md:grid-cols-2">
            {findings.map((finding, index) => {
              const meta = SEVERITY[finding.severity]
              return (
                <li key={index} className={cn('flex items-start gap-2 rounded-[3px] border px-3 py-2', meta.box)}>
                  <meta.icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', meta.tone)} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-foreground">{finding.title}</div>
                    <div className="text-[11.5px] leading-snug text-muted-foreground">{finding.detail}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <ExecutionCharts record={record} telemetry={telemetry} history={history} />
      {agents.length > 0 ? <AgentBreakdown agents={agents} tracked={tracked} /> : null}
      {tracked ? <Timeline trace={trace!} /> : null}

      {!tracked && traceState !== 'loading' ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Timer className="h-3 w-3" />
          Tokens, model and tool calls appear for runs that go through the execute API.
        </p>
      ) : null}
    </div>
  )
}

/** Run-level errors not already tied to an agent. */
function runLevelErrors(record: ExecutionRecord, agents: AgentInsight[]): number {
  return agents.some((agent) => agent.errors.length > 0) ? 0 : record.errors.length
}

function slowestCallLabel(agents: AgentInsight[], calls: number): string {
  const slowest = Math.max(0, ...agents.map((agent) => agent.slowestCallMs))
  return calls > 0 ? `slowest ${formatDuration(slowest)}` : 'none'
}
