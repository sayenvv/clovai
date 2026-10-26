/**
 * Run a workflow from the Admin Center playground: `POST /api/v1/execute` with live events, the
 * same endpoint the workspace chat uses. The stream's frames are Agent Framework workflow events.
 */

import { apiFetch } from '@/api/auth'

export interface PlaygroundRun {
  workflowId: string
  message: string
  aiIntegrationId: string
  /** The workflow the run works on (`workflow_context_id`), when one is picked. */
  workflowContextId?: string
  /** Keeps conversation history across messages of one playground conversation. */
  conversationId: string
  signal?: AbortSignal
}

/** One readable step of a run, built from the stream's events. */
export interface PlaygroundStep {
  id: string
  agentId: string
  kind: 'started' | 'reply' | 'plan' | 'error'
  text: string
}

export interface PlaygroundOutcome {
  output: string
  traceId: string
  error?: string
  /** The workflow JSON the run built, when it built one (sent as an `artifact` event). */
  workflow?: Record<string, unknown>
}

/** Run the workflow, calling `onStep` as steps arrive; resolves with the final answer. */
export async function runPlayground(run: PlaygroundRun, onStep: (step: PlaygroundStep) => void): Promise<PlaygroundOutcome> {
  const requestId = crypto.randomUUID()
  const response = await apiFetch('/api/v1/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Request-Id': requestId,
      'X-Correlation-Id': requestId,
      'X-AI-Integration-Id': run.aiIntegrationId,
    },
    body: JSON.stringify({
      workflow_id: run.workflowId,
      message: run.message,
      conversation_id: run.conversationId,
      ...(run.workflowContextId ? { workflow_context_id: run.workflowContextId } : {}),
      events: true,
    }),
    signal: run.signal,
  })
  if (!response.ok) throw new Error(await detail(response))

  let traceId = ''
  let output = ''
  let lastReply = ''
  let error = ''
  let workflow: Record<string, unknown> | undefined
  let count = 0
  const step = (agentId: string, kind: PlaygroundStep['kind'], text: string) => {
    count += 1
    onStep({ id: `${requestId}-${count}`, agentId, kind, text })
  }

  await readEvents(response, (name, payload) => {
    const agentId = String(payload.executor_id ?? '')
    const type = String(payload.type ?? name)
    if (name === 'artifact') {
      if (payload.kind === 'workflow' && payload.data && typeof payload.data === 'object') workflow = payload.data as Record<string, unknown>
    } else if (name === 'trace') {
      traceId = String(payload.trace_id ?? '')
    } else if (type === 'executor_invoked' && agentId) {
      step(agentId, 'started', '')
    } else if (type === 'magentic_orchestrator') {
      const data = (payload.data ?? {}) as { text?: string }
      if (data.text?.trim()) step(agentId, 'plan', data.text.trim())
    } else if (type === 'intermediate' || type === 'output' || type === 'data') {
      const data = payload.data as { type?: string } | undefined
      const text = textOf(data)
      // Streaming updates are partial; the whole response follows, so only that is shown
      if (!text || (typeof data?.type === 'string' && data.type.includes('update'))) return
      if (type === 'output') output = text
      else lastReply = text
      step(agentId, 'reply', text)
    } else if (type === 'executor_failed' || type === 'failed' || name === 'error') {
      const details = (payload.details ?? {}) as { message?: string }
      error = details.message || String(payload.message ?? 'The run failed.')
      step(agentId, 'error', error)
    }
  })
  return { output: output || lastReply, traceId, ...(error ? { error } : {}), ...(workflow ? { workflow } : {}) }
}

/** Text in an Agent Framework value: a string, AgentResponse, Message, or a list of them. */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n\n')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  if (typeof record.text === 'string') return record.text
  if (Array.isArray(record.contents)) {
    return record.contents.map((item) => (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string' ? (item as { text: string }).text : '')).join('')
  }
  if (Array.isArray(record.messages)) return textOf(record.messages)
  if ('agent_response' in record) return textOf(record.agent_response)
  return ''
}

/** Read a server-sent event stream: each frame is an `event:` line and a `data:` JSON line. */
async function readEvents(response: Response, onEvent: (name: string, payload: Record<string, unknown>) => void): Promise<void> {
  if (!response.body) throw new Error('The run returned no stream.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const name = frame.match(/^event: (.+)$/m)?.[1] ?? 'message'
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n')
      if (data) onEvent(name, JSON.parse(data) as Record<string, unknown>)
    }
  }
}

async function detail(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
  } catch {
    return `${response.status} ${response.statusText}`.trim()
  }
}
