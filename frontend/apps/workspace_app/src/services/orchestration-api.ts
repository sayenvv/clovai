import { authorizedFetch } from '@/services/api-auth'
import { getSession } from '@/services/project-auth-store'
import { addTokenUsage, writeTokenUsage, type TokenUsageSnapshot } from '@/services/token-usage-store'

export interface OrchestrationIdentity {
  /** The tab's own workflow id (a UUID): the saved row's key. */
  workflowId: string
  workspaceId: string
  tabId: string
  userId: string
}

export interface ExecutionStepDetail {
  id?: string
  message?: string
  status?: string
  complete?: boolean
  mark?: string
  detail?: string
}

export interface ExecutionLogEvent {
  event: string
  status?: string
  message?: string
  agentId?: string
  agent?: string
  /** True when `message` is a streamed piece of the agent's open turn. */
  delta?: boolean
  kind?: 'reasoning'
  title?: string
  /** What the stage is doing while it runs, such as "Designing". */
  activity?: string
  /** `usage` events: one model call's token counts. */
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  /** `usage` events from the workflow chat: the request's total so far. */
  runTotalTokens?: number
  steps?: ExecutionStepDetail[]
  result?: {
    execution?: {
      outputs?: unknown
    }
  }
}

let integrationIdPromise: Promise<string> | null = null

async function aiIntegrationId(): Promise<string> {
  const configured = (import.meta.env.VITE_AI_INTEGRATION_ID as string | undefined)?.trim()
  if (configured) return configured
  if (!integrationIdPromise) {
    integrationIdPromise = loadAiIntegrationId().catch((error: unknown) => {
      integrationIdPromise = null
      throw error
    })
  }
  return integrationIdPromise
}

async function loadAiIntegrationId(): Promise<string> {
  const response = await authorizedFetch('/api/v1/applications')
  if (!response.ok) throw new Error(await errorMessage(response))
  const rows = (await response.json()) as Array<{ ai_integration_id?: unknown }>
  const id = rows.find((row) => typeof row.ai_integration_id === 'string')?.ai_integration_id
  if (typeof id !== 'string' || !id) {
    throw new Error('No AI integration is configured for this workspace.')
  }
  return id
}

function tracingHeaders(aiIntegrationId: string): Record<string, string> {
  const requestId = crypto.randomUUID()
  return {
    'X-Request-Id': requestId,
    'X-Correlation-Id': requestId,
    'X-AI-Integration-Id': aiIntegrationId,
  }
}

/** Tracing and application headers for routes that run on the application's model. */
export async function orchestrationHeaders(): Promise<Record<string, string>> {
  return tracingHeaders(await aiIntegrationId())
}

export function orchestrationIdentity(tabId: string, workflowId: string): OrchestrationIdentity {
  const session = getSession()
  if (!session) {
    throw new Error('Sign in before using the workflow API.')
  }
  return {
    workflowId,
    workspaceId: session.workspaceId,
    tabId,
    userId: session.accountId,
  }
}

export async function errorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text) return `Request failed (${response.status})`
  try {
    const parsed = JSON.parse(text) as { detail?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((issue) => {
          if (!issue || typeof issue !== 'object') return ''
          const record = issue as { loc?: unknown; msg?: unknown; message?: unknown }
          const message = record.msg ?? record.message
          return typeof message === 'string' ? message : ''
        })
        .filter(Boolean)
        .join('; ')
    }
  } catch {
    // plain text
  }
  return text
}

export async function saveOrchestration(input: {
  identity: OrchestrationIdentity
  name?: string
  description?: string
  document: Record<string, unknown>
  /** The Code tab's workflow JSON, saved in the row's `definition` column. */
  definition?: Record<string, unknown>
}): Promise<{ id: string }> {
  const response = await authorizedFetch('/api/v1/workflows', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflowId: input.identity.workflowId,
      userId: input.identity.userId,
      name: input.name ?? '',
      document: input.document,
      ...(input.definition ? { definition: input.definition } : {}),
    }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  const body = (await response.json()) as { id: string }
  return body
}

/** How a streamed run ended: its last agent answer, and the failure message when it failed. */
export interface OrchestrationOutcome {
  output: string
  error?: string
  /** Results tools handed over directly, by kind (e.g. `workflow`: the workflow JSON a run built). */
  artifacts?: Record<string, unknown>
  /** The tokens this run used, summed from its `usage` events (the server charges them once, at the end). */
  usage?: RunTokenUsage
}

export interface RunTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export async function executeOrchestration(input: {
  identity: OrchestrationIdentity
  inputs?: Record<string, unknown>
  /** A saved workflow the user selected as the run's context (the backend's `workflow_context_id`). */
  workflowContextId?: string
  /** The chat conversation the run belongs to; context providers such as history keep state per conversation. */
  conversationId?: string
  onEvent: (event: ExecutionLogEvent) => void
  /** The run's OpenTelemetry trace id, sent first on the stream (open it with fetchTrace). */
  onTrace?: (traceId: string) => void
  signal?: AbortSignal
}): Promise<OrchestrationOutcome> {
  const inputs = input.inputs ?? {}
  const message = typeof inputs.message === 'string' ? inputs.message : JSON.stringify(inputs)
  const response = await authorizedFetch('/api/v1/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(await tracingHeaders(await aiIntegrationId())),
    },
    body: JSON.stringify({
      workflow_id: input.identity.workflowId,
      message,
      ...(input.workflowContextId ? { workflow_context_id: input.workflowContextId } : {}),
      ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
      // Stream the agent framework's workflow events as they happen.
      events: true,
    }),
    signal: input.signal,
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  let failed = false
  let failure = ''
  let finalOutput = ''
  // The workflow's own result (an "output" event, e.g. the Magentic final answer), when it sends one
  let workflowOutput = ''
  const artifacts: Record<string, unknown> = {}
  const usage: RunTokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  await readEventStream(response, (eventName, payload) => {
    // One model call's tokens: added to this answer and to the allowance shown, ahead of the total
    if (eventName === 'usage') {
      const call = payload as Partial<RunTokenUsage>
      usage.inputTokens += Number(call.inputTokens) || 0
      usage.outputTokens += Number(call.outputTokens) || 0
      usage.totalTokens += Number(call.totalTokens) || 0
      addTokenUsage(Number(call.totalTokens) || 0)
      return
    }
    // The run is over and charged: the server's allowance replaces the running estimate
    if (eventName === 'usage_total') {
      const subscription = payload.subscription as TokenUsageSnapshot | null | undefined
      if (subscription) writeTokenUsage(subscription)
      return
    }
    if (eventName === 'trace') {
      if (typeof payload.trace_id === 'string') input.onTrace?.(payload.trace_id)
      return
    }
    if (eventName === 'artifact') {
      if (typeof payload.kind === 'string') artifacts[payload.kind] = payload.data
      return
    }
    if (eventName === 'output') {
      const text = workflowText((payload as WorkflowStreamEvent).data)
      if (text) workflowOutput = text
    }
    const translated = fromWorkflowEvent(eventName, payload as WorkflowStreamEvent)
    if (!translated) return
    if (translated.status === 'failed') {
      failed = true
      failure ||= translated.message ?? ''
    }
    if (translated.event === 'agent' && translated.status === 'completed' && translated.message) {
      finalOutput = translated.message
    }
    input.onEvent(translated)
  })
  if (!failed) {
    input.onEvent({
      event: 'progress',
      status: 'completed',
      message: 'Workflow completed',
      result: { execution: { outputs: finalOutput } },
    })
  }
  const output = workflowOutput || finalOutput
  const extra = { ...(Object.keys(artifacts).length > 0 ? { artifacts } : {}), usage }
  return failed ? { output, error: failure || 'Workflow execution failed.', ...extra } : { output, ...extra }
}

/** One frame of the `/execute` stream: an agent framework `WorkflowEvent` (see services/executions.py). */
interface WorkflowStreamEvent {
  type?: string
  executor_id?: string
  data?: unknown
  details?: { message?: string; error_type?: string }
  message?: string
}

/** Text in an agent framework value: a string, AgentResponse(Update), Message, or a list of them. */
function workflowText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(workflowText).filter(Boolean).join('\n\n')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  if (typeof record.text === 'string') return record.text
  if (Array.isArray(record.contents)) {
    return record.contents
      .map((content) => (content && typeof content === 'object' && typeof (content as { text?: unknown }).text === 'string' ? (content as { text: string }).text : ''))
      .join('')
  }
  if (Array.isArray(record.messages)) return workflowText(record.messages)
  if ('agent_response' in record) return workflowText(record.agent_response)
  return ''
}

/** True when a streamed update's text replaces the reply so far rather than extending it. */
function hasReplacingText(value: unknown): boolean {
  const contents = (value as { contents?: unknown } | undefined)?.contents
  return (
    Array.isArray(contents) &&
    contents.some((content) => {
      const item = content as { type?: unknown; merge_mode?: unknown } | null
      return item?.type === 'text' && item.merge_mode === 'replace'
    })
  )
}

/** Map an agent framework workflow event onto the run log's `agent` / `progress` events. */
function fromWorkflowEvent(eventName: string, payload: WorkflowStreamEvent): ExecutionLogEvent | null {
  const agentId = payload.executor_id
  const type = payload.type ?? eventName
  switch (type) {
    case 'executor_invoked':
      return agentId ? { event: 'agent', agentId, agent: agentId, status: 'running' } : null
    case 'executor_completed':
      return agentId ? { event: 'agent', agentId, agent: agentId, status: 'completed' } : null
    case 'executor_failed':
      return agentId
        ? { event: 'agent', agentId, agent: agentId, status: 'failed', message: payload.details?.message }
        : null
    case 'magentic_orchestrator': {
      // The Magentic manager's plan, or its hand-off to the next agent (services/executions.py)
      const data = payload.data as { event_type?: string; text?: string } | undefined
      const text = data?.text?.trim()
      if (!agentId || !text) return null
      const title = data?.event_type === 'plan_created' ? 'Plan' : data?.event_type === 'replanned' ? 'Revised plan' : 'Next step'
      return { event: 'agent', agentId, agent: agentId, kind: 'reasoning', title, status: 'completed', message: text }
    }
    // "intermediate": a participant's reply streamed while the run goes on (e.g. each Magentic agent)
    case 'intermediate':
    case 'output':
    case 'data': {
      if (!agentId) return null
      const data = payload.data as { type?: string } | undefined
      const text = workflowText(data)
      if (!text) return null
      // Streaming updates extend the agent's open turn; a whole response completes it.
      const isUpdate = typeof data?.type === 'string' && data.type.includes('update')
      // OpenAI ends a streamed reply with one update holding the whole text, marked "replace":
      // it stands in for the pieces already shown, so it completes the turn instead of adding to it.
      const replaces = isUpdate && hasReplacingText(data)
      return isUpdate && !replaces
        ? { event: 'agent', agentId, agent: agentId, status: 'running', delta: true, message: text }
        : { event: 'agent', agentId, agent: agentId, status: 'completed', message: text }
    }
    case 'failed':
      return { event: 'progress', status: 'failed', message: payload.details?.message || 'Workflow execution failed.' }
    case 'error':
      return { event: 'progress', status: 'failed', message: payload.message || 'Workflow execution failed.' }
    default:
      return null
  }
}

/** Read a server-sent event stream, calling `onEvent` with each event name and JSON payload. */
export async function readEventStream(
  response: Response,
  onEvent: (eventName: string, payload: Record<string, unknown>) => void,
): Promise<void> {
  if (!response.body) throw new Error('Execution stream is empty.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const eventName = chunk.match(/^event: (.+)$/m)?.[1] ?? 'log'
      const dataLine = chunk
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n')
      if (!dataLine) continue
      onEvent(eventName, JSON.parse(dataLine) as Record<string, unknown>)
    }
  }
}

