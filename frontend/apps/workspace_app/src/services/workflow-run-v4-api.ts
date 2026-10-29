import { authorizedFetch } from '@/services/api-auth'
import { errorMessage, orchestrationHeaders, type ExecutionLogEvent } from '@/services/orchestration-api'

/**
 * Runs of saved workflows on the 4.0 engine (`/api/v1/workflows/v4/runs`). A run finishes, fails, or waits
 * for a person (an approval or a question); answering continues it. Node events are reported as the
 * run view's `agent` events, keyed by the node id (the canvas block id).
 */

export interface WorkflowRunRequest {
  id: string
  kind: 'approval' | 'ask_user' | 'wait_event'
  nodeId: string
  nodeName: string
  payload: { message?: string; question?: string; approvers?: { roles?: string[] } }
}

export interface WorkflowRunV4 {
  id: string
  status: 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled' | 'invalid' | 'unsupported'
  output: unknown
  error: string | null
  issues?: Array<{ path: string; code: string; message: string }>
  requests: WorkflowRunRequest[]
  events?: Array<Record<string, unknown>>
}

/** A 4.0 node event as the run view's agent event. */
function asLogEvent(event: Record<string, unknown>): ExecutionLogEvent | null {
  const nodeId = typeof event.nodeId === 'string' ? event.nodeId : undefined
  const name = typeof event.name === 'string' ? event.name : undefined
  switch (event.type) {
    case 'node.started':
      return { event: 'agent', agentId: nodeId, agent: name, status: 'running' }
    case 'node.completed':
      return { event: 'agent', agentId: nodeId, agent: name, status: 'completed' }
    case 'node.failed':
      return { event: 'agent', agentId: nodeId, agent: name, status: 'failed', message: String(event.error ?? '') }
    case 'usage':
      // One model call's tokens (the server records and charges them; the run view updates the allowance shown)
      return {
        event: 'usage',
        agentId: typeof event.agentId === 'string' ? event.agentId : undefined,
        agent: typeof event.agent === 'string' ? event.agent : undefined,
        inputTokens: Number(event.inputTokens ?? 0),
        outputTokens: Number(event.outputTokens ?? 0),
        totalTokens: Number(event.totalTokens ?? 0),
      }
    case 'progress':
      return { event: 'agent', agentId: nodeId, agent: name, status: 'running', message: String(event.message ?? '') }
    default:
      return null
  }
}

/** Start the saved workflow (or a `document` sent inline, such as an assistant draft); `onEvent` gets each node
 * as it runs. Resolves once it finishes or waits. */
export async function startWorkflowRun(options: {
  workflowId?: string
  document?: Record<string, unknown>
  inputs: Record<string, unknown>
  onEvent: (event: ExecutionLogEvent) => void
  signal?: AbortSignal
}): Promise<WorkflowRunV4> {
  const response = await authorizedFetch('/api/v1/workflows/v4/runs/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(await orchestrationHeaders()) },
    body: JSON.stringify(options.document ? { document: options.document, inputs: options.inputs } : { workflowId: options.workflowId, inputs: options.inputs }),
    signal: options.signal,
  })
  if (!response.ok || !response.body) throw new Error(await errorMessage(response))
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let run: WorkflowRunV4 | null = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const kind = /^event: (.*)$/m.exec(frame)?.[1]
      const data = /^data: (.*)$/m.exec(frame)?.[1]
      if (!kind || !data) continue
      const payload = JSON.parse(data) as Record<string, unknown>
      if (kind === 'run') run = payload as unknown as WorkflowRunV4
      else if (kind === 'error') throw new Error(String(payload.error ?? 'The run failed'))
      else {
        const event = asLogEvent(payload)
        if (event) options.onEvent(event)
      }
    }
  }
  if (!run) throw new Error('The run stopped without a result')
  return run
}

/** Answer what a waiting run asked; the run continues and its new node events go to `onEvent`. */
export async function answerWorkflowRun(
  run: WorkflowRunV4,
  request: WorkflowRunRequest,
  response: Record<string, unknown>,
  onEvent: (event: ExecutionLogEvent) => void,
): Promise<WorkflowRunV4> {
  const before = run.events?.length ?? 0
  const reply = await authorizedFetch(
    `/api/v1/workflows/v4/runs/${encodeURIComponent(run.id)}/requests/${encodeURIComponent(request.id)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await orchestrationHeaders()) },
      body: JSON.stringify({ response }),
    },
  )
  if (!reply.ok) throw new Error(await errorMessage(reply))
  const next = (await reply.json()) as WorkflowRunV4
  // The answer returns the whole run; replay only the events of the part that just ran
  for (const event of (next.events ?? []).slice(before)) {
    const logged = asLogEvent(event)
    if (logged) onEvent(logged)
  }
  return next
}

/** A finished run's answer as text: a string output, or the output as JSON. */
export function runOutputText(output: unknown): string {
  if (typeof output === 'string') return output
  if (output && typeof output === 'object' && typeof (output as { reply?: unknown }).reply === 'string') {
    return (output as { reply: string }).reply
  }
  return output == null ? '' : JSON.stringify(output, null, 2)
}
