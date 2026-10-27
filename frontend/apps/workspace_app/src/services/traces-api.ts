/**
 * OpenTelemetry traces of workflow runs: `GET /api/v1/traces` and `GET /api/v1/traces/{traceId}`.
 *
 * A run is one trace under an `execution` root span. Agent Framework's spans nest under it:
 * `workflow.run`, `executor.process`, `invoke_agent`, `chat` (model calls) and `execute_tool`.
 */
import { authorizedFetch } from '@/services/api-auth'
import { errorMessage } from '@/services/orchestration-api'

/** OTel status: UNSET means the span did not report one (treated as succeeded). */
export type SpanStatus = 'UNSET' | 'OK' | 'ERROR'

export interface TraceRun {
  trace_id: string
  workflow_id: string
  user_id: string
  request_id: string
  status: SpanStatus
  error: string
  input: string
  /** The run's final output; empty unless the server records payloads (TELEMETRY_SENSITIVE_DATA). */
  output?: string
  payloads_recorded?: boolean
  start_time: string
  end_time: string
  duration_ms: number
}

/** One agent step recorded on the run's span: what the agent received, returned, or why it failed. */
export interface TraceStep {
  kind: 'input' | 'output' | 'failed'
  /** The canvas node id of the agent. */
  agent_id: string
  time: string
  /** Absent when the server does not record payloads. */
  payload?: string
  truncated: boolean
}

export interface TraceRunSummary extends TraceRun {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  span_count: number
  error_count: number
  agent_count: number
}

export interface TraceAgent {
  name: string
  model: string | null
  invocations: number
  duration_ms: number
  errors: number
  model_calls: number
  tool_calls: number
  input_tokens: number
  output_tokens: number
}

export interface TraceSpan {
  span_id: string
  parent_span_id: string | null
  name: string
  kind: string
  /** `gen_ai.operation.name`: invoke_agent, chat, execute_tool ... */
  operation: string | null
  status: SpanStatus
  status_message: string
  start_time: string
  end_time: string
  duration_ms: number
  attributes: Record<string, unknown>
  events: Array<{ name: string; time: string; attributes: Record<string, unknown> }>
}

export interface TraceDetail {
  trace_id: string
  /** Null while the run is still going: spans are stored as they end. */
  run: TraceRun | null
  status: SpanStatus | 'RUNNING'
  input_tokens: number
  output_tokens: number
  total_tokens: number
  agents: TraceAgent[]
  /** Each agent's input and output, in order (servers before this field send none). */
  steps?: TraceStep[]
  spans: TraceSpan[]
}

async function getJson<T>(path: string): Promise<T> {
  const response = await authorizedFetch(path)
  if (!response.ok) throw new Error(await errorMessage(response))
  return (await response.json()) as T
}

/** The signed-in user's runs, newest first; only one workflow's when `workflowId` is set. */
export function fetchTraces(options: { workflowId?: string; limit?: number } = {}): Promise<TraceRunSummary[]> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 50) })
  if (options.workflowId) params.set('workflow_id', options.workflowId)
  return getJson(`/api/v1/traces?${params}`)
}

export function fetchTrace(traceId: string): Promise<TraceDetail> {
  return getJson(`/api/v1/traces/${encodeURIComponent(traceId)}`)
}
