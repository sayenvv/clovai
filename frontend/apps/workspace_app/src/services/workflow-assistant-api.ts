import { authorizedFetch } from '@/services/api-auth'
import { orchestrationHeaders } from '@/services/orchestration-api'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import type { WorkflowV4Document } from '@/types/workflow-v4'

/**
 * The workflow assistant (backend `docs/ai-assistant.md`): a 4.0 workflow that edits a draft. A run either
 * finishes with a reply and a draft id, or waits for the user (a question, a plan to approve, a confirmation);
 * answering continues it. The draft is reviewed (diff) and accepted onto the canvas.
 */

export interface AssistantRunEvent {
  type: string
  nodeId: string | null
  name?: string
  nodeType?: string
  outcome?: string | null
  error?: string
  message?: string
  /** On `tool.started` / `tool.completed`: the tool an agent called, and that agent. */
  tool?: string
  agent?: string
  agentId?: string
  /** On an agent's `node.completed`: what it decided, in a sentence or two. */
  summary?: string
  /** On `tool.started`: the model's own one-line why for the call. */
  reason?: string
  /** On `usage`: the tokens one agent call used. */
  totalTokens?: number
  /** On `tool.completed`: what the call touched (short text arguments, list sizes) and what it reported. */
  detail?: {
    inputs?: Record<string, string>
    counts?: Record<string, number>
    result?: { applied?: number; valid?: boolean; issues?: number; items?: number; results?: number; matches?: number; error?: string }
  }
  time: string
}

export interface AssistantRequest {
  id: string
  kind: 'approval' | 'ask_user' | 'wait_event'
  nodeId: string
  nodeName: string
  payload: {
    message?: string
    question?: string
    responseSchema?: { properties?: Record<string, { type?: string }> } | null
  }
}

export interface AssistantRun {
  id: string
  status: 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled' | 'invalid' | 'unsupported'
  output: { reply?: string; draftId?: string; openIssues?: unknown[] } | null
  error: string | null
  issues?: Array<{ path: string; code: string; message: string }>
  requests: AssistantRequest[]
  events: AssistantRunEvent[]
}

export interface DraftDiffPart {
  added: string[]
  removed: string[]
  changed: Array<{ id: string; fields: string[] }>
}

export type DraftDiff = { nodes: DraftDiffPart; edges: DraftDiffPart; sections: string[] } & Record<string, unknown>

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
  if (typeof body?.detail === 'string') return body.detail
  return `The workflow assistant request failed (${response.status})`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await orchestrationHeaders()), ...init.headers },
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return (response.status === 204 ? undefined : await response.json()) as T
}

/** The picked model as the assistant API takes it; the default model sends nothing (the assistant's own presets). */
function assistantModel(model: GenerateWorkflowModel | undefined): Record<string, string> | undefined {
  switch (model?.provider) {
    case 'client':
      return { kind: 'client', provider: model.providerType, model: model.model, connectionId: model.connectionId }
    case 'catalog':
      return { kind: 'catalog', provider: model.providerId, model: model.modelId }
    case 'ollama':
      return { kind: 'ollama', provider: 'ollama', model: model.model, baseUrl: model.baseUrl }
    default:
      return undefined
  }
}

/** Send a message; `onEvent` gets each step as it happens. Resolves with the run once it finishes or waits. */
export async function streamAssistantMessage(options: {
  message: string
  draftId?: string
  workflowId?: string
  /** The model every assistant agent runs on for this message. */
  model?: GenerateWorkflowModel
  onEvent?: (event: AssistantRunEvent) => void
  signal?: AbortSignal
}): Promise<AssistantRun> {
  const response = await authorizedFetch('/api/v1/workflow-assistant/messages/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await orchestrationHeaders()) },
    body: JSON.stringify({
      message: options.message,
      ...(options.draftId ? { draftId: options.draftId } : {}),
      ...(options.workflowId ? { workflowId: options.workflowId } : {}),
      ...(assistantModel(options.model) ? { model: assistantModel(options.model) } : {}),
    }),
    signal: options.signal,
  })
  if (!response.ok || !response.body) throw new Error(await errorMessage(response))

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let run: AssistantRun | null = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
      const kind = /^event: (.*)$/m.exec(block)?.[1]
      const data = /^data: (.*)$/m.exec(block)?.[1]
      if (!kind || !data) continue
      const parsed = JSON.parse(data) as unknown
      if (kind === 'run') run = parsed as AssistantRun
      else if (kind === 'error') throw new Error((parsed as { error?: string }).error ?? 'The assistant run failed')
      else options.onEvent?.(parsed as AssistantRunEvent)
    }
  }
  if (!run) throw new Error('The assistant stopped without an answer')
  return run
}

/** Answer what a waiting run asked (a plan approval, a question, a confirmation) and continue it. */
export function answerAssistant(runId: string, requestId: string, response: Record<string, unknown>): Promise<AssistantRun> {
  return request(`/api/v1/workflows/v4/runs/${encodeURIComponent(runId)}/requests/${encodeURIComponent(requestId)}`, {
    method: 'POST',
    body: JSON.stringify({ response }),
  })
}

/** A draft of a 4.0 document, such as the open canvas tab, for the assistant to work on. */
export function createDraft(document: WorkflowV4Document): Promise<{ id: string }> {
  return request('/api/v1/workflow-assistant/drafts', { method: 'POST', body: JSON.stringify({ document }) })
}

export function fetchDraftDiff(draftId: string): Promise<DraftDiff> {
  return request(`/api/v1/workflow-assistant/drafts/${encodeURIComponent(draftId)}/diff`)
}

/** Close the draft; its document is what the canvas should show and save. */
export function acceptDraft(draftId: string): Promise<{ draftId: string; workflowId: string | null; document: WorkflowV4Document }> {
  return request(`/api/v1/workflow-assistant/drafts/${encodeURIComponent(draftId)}/accept`, { method: 'POST' })
}

export function discardDraft(draftId: string): Promise<void> {
  return request(`/api/v1/workflow-assistant/drafts/${encodeURIComponent(draftId)}/discard`, { method: 'POST' })
}
