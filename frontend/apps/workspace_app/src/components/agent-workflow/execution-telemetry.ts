/**
 * What a workflow run's telemetry says: its server trace (OpenTelemetry spans), each agent's
 * time, tokens, model and tool calls, and the findings worth a look. Shared by the run tabs.
 */
import { createElement, useEffect, useMemo, useState, type PointerEvent } from 'react'
import { AlertTriangle, Bot, CheckCircle2, Cpu, Info, Wrench, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { fenceJson } from '@/components/agent-workflow/ChatMarkdown'
import type { ExecutionRecord } from '@/services/execution-history-store'
import { fetchTrace, type TraceDetail, type TraceSpan } from '@/services/traces-api'

/** Runs started on the /execute API carry their OpenTelemetry trace id as the run id. */
const TRACE_ID = /^[0-9a-f]{32}$/

export function hasServerTrace(record: ExecutionRecord): boolean {
  return Boolean(record.runId && TRACE_ID.test(record.runId))
}

/* ---------------------------------------------------------------- formatting */

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${Math.round(value / 1000)}k`
  if (value >= 1_000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

export function asMarkdown(text: string): string {
  const trimmed = text.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[') ? fenceJson(trimmed) : trimmed
}

/* ---------------------------------------------------------------- span data */

export const ATTR = {
  agent: 'gen_ai.agent.name',
  model: 'gen_ai.request.model',
  responseModel: 'gen_ai.response.model',
  tool: 'gen_ai.tool.name',
  inputTokens: 'gen_ai.usage.input_tokens',
  outputTokens: 'gen_ai.usage.output_tokens',
  inputMessages: 'gen_ai.input.messages',
  outputMessages: 'gen_ai.output.messages',
  toolArguments: 'gen_ai.tool.call.arguments',
  toolResult: 'gen_ai.tool.call.result',
} as const

function attr(span: TraceSpan, key: string): unknown {
  return span.attributes?.[key]
}

export function numberAttr(span: TraceSpan, key: string): number {
  const value = Number(attr(span, key))
  return Number.isFinite(value) ? value : 0
}

export function stringAttr(span: TraceSpan, key: string): string {
  const value = attr(span, key)
  return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value)
}

/** The text of OTel gen_ai messages (`[{role, parts: [{type: 'text', content}]}]`), or the raw value. */
export function messagesText(raw: string): string {
  if (!raw.trim()) return ''
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return raw
    return parsed
      .map((message) => {
        const item = message as { role?: string; parts?: Array<{ type?: string; content?: unknown }>; content?: unknown }
        const parts = Array.isArray(item.parts)
          ? item.parts
              .map((part) =>
                part.type === 'text' && typeof part.content === 'string'
                  ? part.content
                  : part.type === 'tool_call'
                    ? `→ ${JSON.stringify(part)}`
                    : '',
              )
              .filter(Boolean)
              .join('\n')
          : typeof item.content === 'string'
            ? item.content
            : ''
        return parts ? `**${item.role ?? 'message'}**\n\n${parts}` : ''
      })
      .filter(Boolean)
      .join('\n\n---\n\n')
  } catch {
    return raw
  }
}

export type Operation = 'invoke_agent' | 'chat' | 'execute_tool'

export const OPERATIONS: Record<Operation, { label: string; swatch: string; icon: typeof Bot }> = {
  invoke_agent: { label: 'Agent', swatch: 'bg-[#7c3aed] dark:bg-[#8b5cf6]', icon: Bot },
  chat: { label: 'Model call', swatch: 'bg-[#0284c7]', icon: Cpu },
  execute_tool: { label: 'Tool call', swatch: 'bg-[#db2777] dark:bg-[#ec4899]', icon: Wrench },
}

export function isOperation(value: string | null): value is Operation {
  return value === 'invoke_agent' || value === 'chat' || value === 'execute_tool'
}

export interface ToolCall {
  id: string
  name: string
  durationMs: number
  failed: boolean
  error: string
  arguments: string
  result: string
}

/** One agent's share of the run, from its spans and the run's own record. */
export interface AgentInsight {
  name: string
  /** The canvas node this agent is, when the run's record names it. */
  nodeId?: string
  model: string
  durationMs: number
  invocations: number
  modelCalls: number
  toolCalls: ToolCall[]
  inputTokens: number
  outputTokens: number
  errors: string[]
  input: string
  output: string
  /** Slowest single model call, for spotting a stalled request. */
  slowestCallMs: number
  /** `executor`: a step with no model behind it (custom code, a validator, a router, an aggregator). */
  kind: 'agent' | 'executor'
  /** When it first started (ms), for run order; 0 when unknown. */
  startedAt: number
}

/** A step the run actually started; plan steps that never ran stay `pending` (or `skipped`). */
export function stepRan(step: ExecutionRecord['trace'][number]): boolean {
  return step.status !== 'pending' && step.status !== 'skipped'
}

export type ModelCallState = 'called' | 'not-called' | 'unknown'

/** Whether a step called a model: known only when the run has a server trace. */
export function modelCallState(agent: AgentInsight, tracked: boolean): ModelCallState {
  if (!tracked) return 'unknown'
  return agent.modelCalls > 0 ? 'called' : 'not-called'
}

/** The framework's span around each workflow step, agent or not; carries the step's node id. */
const EXECUTOR_SPAN = 'executor.process'
const EXECUTOR_ID = 'executor.id'

/** The nearest `invoke_agent` span above `span` (itself included). */
export function owningAgent(span: TraceSpan, byId: Map<string, TraceSpan>): TraceSpan | null {
  let current: TraceSpan | undefined = span
  while (current) {
    if (current.operation === 'invoke_agent') return current
    current = current.parent_span_id ? byId.get(current.parent_span_id) : undefined
  }
  return null
}

export function agentName(span: TraceSpan): string {
  return stringAttr(span, ATTR.agent) || span.name.replace(/^invoke_agent\s*/, '') || 'Agent'
}

/** Each agent's work in the run: server spans when the run has them, else the browser's record. */
function buildAgents(record: ExecutionRecord, trace: TraceDetail | null): AgentInsight[] {
  const outputs = (name: string, nodeId?: string) => {
    const stored = nodeId ? record.stepOutputs[nodeId] : ''
    if (stored?.trim()) return stored
    return record.messages
      .filter((message) => message.kind === 'response' && (message.agentName === name || message.nodeId === nodeId))
      .map((message) => message.content)
      .join('\n\n')
  }

  const spans = trace?.spans ?? []
  if (spans.length > 0) {
    const byId = new Map(spans.map((span) => [span.span_id, span]))
    const agents = new Map<string, AgentInsight>()
    const get = (name: string) => {
      let agent = agents.get(name)
      if (!agent) {
        agent = {
          name,
          model: '',
          durationMs: 0,
          invocations: 0,
          modelCalls: 0,
          toolCalls: [],
          inputTokens: 0,
          outputTokens: 0,
          errors: [],
          input: '',
          output: '',
          slowestCallMs: 0,
          kind: 'agent',
          startedAt: 0,
        }
        agents.set(name, agent)
      }
      return agent
    }
    for (const span of spans) {
      if (!isOperation(span.operation)) continue
      const owner = owningAgent(span, byId)
      if (!owner) continue
      const agent = get(agentName(owner))
      if (span.status === 'ERROR' && span.status_message) agent.errors.push(span.status_message)
      if (span.operation === 'invoke_agent') {
        agent.invocations += 1
        agent.durationMs += span.duration_ms
        const start = Date.parse(span.start_time)
        agent.startedAt = agent.startedAt ? Math.min(agent.startedAt, start) : start
        agent.input ||= messagesText(stringAttr(span, ATTR.inputMessages))
        agent.output ||= messagesText(stringAttr(span, ATTR.outputMessages))
      } else if (span.operation === 'chat') {
        agent.modelCalls += 1
        agent.inputTokens += numberAttr(span, ATTR.inputTokens)
        agent.outputTokens += numberAttr(span, ATTR.outputTokens)
        agent.model ||= stringAttr(span, ATTR.responseModel) || stringAttr(span, ATTR.model)
        agent.slowestCallMs = Math.max(agent.slowestCallMs, span.duration_ms)
      } else {
        agent.toolCalls.push({
          id: span.span_id,
          name: stringAttr(span, ATTR.tool) || span.name.replace(/^execute_tool\s*/, ''),
          durationMs: span.duration_ms,
          failed: span.status === 'ERROR',
          error: span.status_message,
          arguments: stringAttr(span, ATTR.toolArguments),
          result: stringAttr(span, ATTR.toolResult),
        })
      }
    }
    // The server knows names only; the browser's record has the node ids and, when spans lack
    // them, the replies.
    for (const agent of agents.values()) {
      agent.nodeId = record.trace.find((item) => item.agentName === agent.name)?.nodeId
      // The server's own record of each step (by node id), when it keeps payloads
      const steps = (trace?.steps ?? []).filter((step) => step.payload && (step.agent_id === agent.nodeId || step.agent_id === agent.name))
      agent.input ||= steps.filter((step) => step.kind === 'input').map((step) => step.payload!).join('\n\n---\n\n')
      agent.output ||= steps.filter((step) => step.kind === 'output').map((step) => step.payload!).join('\n\n---\n\n')
      if (!agent.output.trim()) {
        const step = record.trace.find((item) => item.agentName === agent.name)
        agent.output = outputs(agent.name, step?.nodeId)
      }
    }

    // Steps with no model behind them (custom code, validators, routers) have no agent span,
    // only the framework's executor span: count those that are steps of the workflow.
    const agentSpans = spans.filter((span) => span.operation === 'invoke_agent')
    const runsAnAgent = (executor: TraceSpan) =>
      agentSpans.some((agentSpan) => {
        for (let parent = byId.get(agentSpan.parent_span_id ?? ''); parent; parent = byId.get(parent.parent_span_id ?? '')) {
          if (parent.span_id === executor.span_id) return true
        }
        return false
      })
    const known = (nodeId: string, name: string) =>
      [...agents.values()].some((agent) => agent.nodeId === nodeId || agent.name === name)
    for (const span of spans) {
      if (!span.name.startsWith(EXECUTOR_SPAN)) continue
      const nodeId = stringAttr(span, EXECUTOR_ID)
      const step = record.trace.find((item) => item.nodeId === nodeId)
      // Framework-internal executors (the input adapter, fan-in plumbing) are not workflow steps,
      // and an executor that runs an agent is already counted through the agent's span.
      if (!step || runsAnAgent(span)) continue
      const counted = [...agents.values()].find((agent) => agent.nodeId === nodeId || agent.name === step.agentName)
      if (counted?.kind === 'agent') continue
      const agent = get(step.agentName)
      agent.kind = 'executor'
      agent.nodeId = nodeId
      agent.invocations += 1
      agent.durationMs += span.duration_ms
      const start = Date.parse(span.start_time)
      agent.startedAt = agent.startedAt ? Math.min(agent.startedAt, start) : start
      if (span.status === 'ERROR' && span.status_message) agent.errors.push(span.status_message)
      const recorded = (kind: 'input' | 'output') =>
        (trace?.steps ?? []).filter((item) => item.kind === kind && item.payload && item.agent_id === nodeId).map((item) => item.payload!).join('\n\n---\n\n')
      agent.input ||= recorded('input')
      agent.output ||= recorded('output') || step.output?.trim() || outputs(step.agentName, nodeId)
    }

    // Anything the run recorded that the trace still lacks (spans not stored yet, or not emitted)
    for (const step of record.trace) {
      if (!stepRan(step) || known(step.nodeId ?? '', step.agentName)) continue
      agents.set(step.agentName, fromStep(step))
    }

    if (agents.size > 0) {
      return [...agents.values()].sort((a, b) => (a.startedAt || Infinity) - (b.startedAt || Infinity))
    }
  }

  return record.trace.filter(stepRan).map(fromStep)

  function fromStep(step: ExecutionRecord['trace'][number]): AgentInsight {
    const stamp = Date.parse(step.timestamp)
    return {
      name: step.agentName,
      nodeId: step.nodeId,
      model: '',
      durationMs: step.durationMs ?? 0,
      invocations: 1,
      modelCalls: 0,
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
      errors: step.status === 'error' && step.message ? [step.message] : [],
      input: '',
      output: step.output?.trim() || outputs(step.agentName, step.nodeId),
      slowestCallMs: 0,
      kind: 'agent',
      startedAt: Number.isFinite(stamp) ? stamp : 0,
    }
  }
}

/* ---------------------------------------------------------------- findings */

export type Severity = 'critical' | 'warning' | 'info' | 'good'

export interface Finding {
  severity: Severity
  title: string
  detail: string
}

export const SEVERITY: Record<Severity, { icon: typeof Info; tone: string; box: string }> = {
  critical: {
    icon: XCircle,
    tone: 'text-red-600 dark:text-red-400',
    box: 'border-red-500/25 bg-red-500/[0.04]',
  },
  warning: {
    icon: AlertTriangle,
    tone: 'text-amber-600 dark:text-amber-400',
    box: 'border-amber-500/25 bg-amber-500/[0.04]',
  },
  info: { icon: Info, tone: 'text-sky-600 dark:text-sky-400', box: 'border-border bg-card' },
  good: {
    icon: CheckCircle2,
    tone: 'text-emerald-600 dark:text-emerald-400',
    box: 'border-emerald-500/25 bg-emerald-500/[0.04]',
  },
}

/** What a reader should look at first: failures, the bottleneck, the token hog. */
function buildFindings(record: ExecutionRecord, agents: AgentInsight[], totalMs: number, tracked: boolean): Finding[] {
  const findings: Finding[] = []
  const failing = agents.filter((agent) => agent.errors.length > 0)
  for (const agent of failing) {
    findings.push({
      severity: 'critical',
      title: `${agent.name} failed`,
      detail: agent.errors[0] ?? 'The agent reported an error.',
    })
  }
  const failedTools = agents.flatMap((agent) => agent.toolCalls.filter((call) => call.failed).map((call) => ({ agent, call })))
  for (const { agent, call } of failedTools.slice(0, 3)) {
    findings.push({
      severity: 'critical',
      title: `Tool ${call.name} failed in ${agent.name}`,
      detail: call.error || 'The tool call returned an error.',
    })
  }
  if (record.errors.length > 0 && failing.length === 0) {
    findings.push({ severity: 'critical', title: 'The run reported an error', detail: record.errors[0].message })
  }
  for (const warning of record.warnings.slice(0, 2)) {
    findings.push({ severity: 'warning', title: warning.agentName ? `${warning.agentName}` : 'Warning', detail: warning.message })
  }

  const agentTime = agents.reduce((sum, agent) => sum + agent.durationMs, 0)
  const slowest = [...agents].sort((a, b) => b.durationMs - a.durationMs)[0]
  if (slowest && agents.length > 1 && agentTime > 0) {
    const share = percent(slowest.durationMs, agentTime)
    if (share >= 40) {
      findings.push({
        severity: share >= 70 ? 'warning' : 'info',
        title: `${slowest.name} is the bottleneck`,
        detail: `${share}% of agent time (${formatDuration(slowest.durationMs)}).${
          slowest.slowestCallMs > 0 ? ` Its slowest model call took ${formatDuration(slowest.slowestCallMs)}.` : ''
        }`,
      })
    }
  }

  const tokens = agents.reduce((sum, agent) => sum + agent.inputTokens + agent.outputTokens, 0)
  const heaviest = [...agents].sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens))[0]
  if (heaviest && tokens > 0 && agents.length > 1) {
    const share = percent(heaviest.inputTokens + heaviest.outputTokens, tokens)
    if (share >= 50) {
      findings.push({
        severity: 'info',
        title: `${heaviest.name} uses the most tokens`,
        detail: `${share}% of the run (${formatTokens(heaviest.inputTokens + heaviest.outputTokens)}), ${
          heaviest.inputTokens >= heaviest.outputTokens * 4
            ? 'mostly input: a long prompt or conversation history is passed in.'
            : 'mostly its own output.'
        }`,
      })
    }
  }

  const repeated = agents.filter((agent) => agent.invocations > 2)
  for (const agent of repeated) {
    findings.push({
      severity: 'warning',
      title: `${agent.name} ran ${agent.invocations} times`,
      detail: 'Repeated runs can mean the orchestration is looping or retrying.',
    })
  }

  const silent = agents.filter((agent) => agent.errors.length === 0 && !agent.output.trim())
  if (silent.length > 0 && record.status === 'completed') {
    findings.push({
      severity: 'warning',
      title: `No output recorded for ${silent.map((agent) => agent.name).join(', ')}`,
      detail: 'The agent finished without a reply the run could keep.',
    })
  }

  if (!tracked) {
    findings.push({
      severity: 'info',
      title: 'Token and model-call data not available',
      detail: 'This run has no server trace. Runs started through the execute API record tokens, model and tool calls.',
    })
  }

  if (findings.every((finding) => finding.severity === 'info') && record.status === 'completed') {
    findings.unshift({
      severity: 'good',
      title: 'Run completed cleanly',
      detail: `${agents.length} agent${agents.length === 1 ? '' : 's'} finished in ${formatDuration(totalMs)} with no errors.`,
    })
  }
  return findings
}

/* ---------------------------------------------------------------- run */

export type TraceState = 'none' | 'loading' | 'ready' | 'error'

export interface RunTelemetry {
  trace: TraceDetail | null
  traceState: TraceState
  /** The run has server spans: tokens, model and tool calls are known. */
  tracked: boolean
  agents: AgentInsight[]
  findings: Finding[]
  totalMs: number
}

/** A run's server trace (fetched once, retried while its spans land) and what it says about each agent. */
export function useRunTelemetry(record: ExecutionRecord): RunTelemetry {
  const traceId = hasServerTrace(record) ? record.runId! : null
  const [trace, setTrace] = useState<TraceDetail | null>(null)
  const [traceState, setTraceState] = useState<TraceState>(traceId ? 'loading' : 'none')

  useEffect(() => {
    if (!traceId) {
      setTrace(null)
      setTraceState('none')
      return
    }
    let cancelled = false
    setTrace(null)
    setTraceState('loading')
    // Spans are stored as they end, so a run that just finished may need a moment
    const load = (attempt: number) =>
      fetchTrace(traceId)
        .then((detail) => {
          if (cancelled) return
          setTrace(detail)
          setTraceState('ready')
        })
        .catch(() => {
          if (cancelled) return
          if (attempt < 3) window.setTimeout(() => load(attempt + 1), 1500)
          else setTraceState('error')
        })
    load(0)
    return () => {
      cancelled = true
    }
  }, [traceId])

  const tracked = traceState === 'ready' && (trace?.spans.length ?? 0) > 0
  const agents = useMemo(() => buildAgents(record, tracked ? trace : null), [record, trace, tracked])
  const totalMs = trace?.run?.duration_ms ?? new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime()
  const findings = useMemo(() => buildFindings(record, agents, totalMs, tracked), [record, agents, totalMs, tracked])
  return { trace: tracked ? trace : null, traceState, tracked, agents, findings, totalMs }
}

/**
 * One run at a glance: headline numbers, what to look at (failures, the bottleneck, the token
 * hog), each agent's share of time and tokens, and the waterfall of agent, model and tool calls.
 */

/** The model-call spans an agent made, in order. */
export function modelCallsOf(telemetry: RunTelemetry, agent: AgentInsight): TraceSpan[] {
  const spans = telemetry.trace?.spans ?? []
  const byId = new Map(spans.map((span) => [span.span_id, span]))
  return spans
    .filter((span) => span.operation === 'chat')
    .filter((span) => {
      const owner = owningAgent(span, byId)
      return owner ? agentName(owner) === agent.name : false
    })
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
}

/** A shared hover card for every chart mark, following the pointer. */
export function useHoverTip() {
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null)
  const bind = (lines: string[]) => ({
    onPointerEnter: (event: PointerEvent) => setTip({ x: event.clientX, y: event.clientY, lines }),
    onPointerMove: (event: PointerEvent) => setTip({ x: event.clientX, y: event.clientY, lines }),
    onPointerLeave: () => setTip(null),
  })
  const node = tip
    ? createElement(
        'div',
        {
          className:
            'pointer-events-none fixed z-50 max-w-xs rounded-[3px] border border-border bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-md',
          style: { left: tip.x + 12, top: tip.y + 12 },
        },
        tip.lines.map((line, index) =>
          createElement('div', { key: index, className: cn('tabular-nums', index === 0 ? 'font-medium' : 'text-muted-foreground') }, line),
        ),
      )
    : null
  return { bind, node }
}
