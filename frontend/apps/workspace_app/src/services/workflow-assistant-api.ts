import type { FormSchema } from '@/components/agent-workflow/SchemaForm'
import { authorizedFetch } from '@/services/api-auth'
import { orchestrationHeaders } from '@/services/orchestration-api'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import type { ToolCard, ToolFileChange } from '@/types/agent-workflow'
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
  /** How the workflow says to show this agent's step or tool call (its `ui`): titles, hidden, quiet. */
  ui?: { running?: string; done?: string; hidden?: boolean; quiet?: boolean }
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
    result?: {
      applied?: number
      valid?: boolean
      issues?: number
      items?: number
      results?: number
      matches?: number
      error?: string
      /** A run the tool started: the assistant's test run, shown for the user to verify. */
      runId?: string
      status?: string
      /** A test handed to the canvas (`status` "started_on_canvas"): the draft and its test inputs. */
      draftId?: string
      inputs?: Record<string, unknown>
      /** What the builder assistant's chat draws as cards. */
      file?: ToolFileChange
      checks?: ToolCard['checks']
      command?: Omit<NonNullable<ToolCard['command']>, 'text'>
    }
  }
  time: string
}

export interface AssistantRequest {
  id: string
  kind: 'approval' | 'ask_user' | 'wait_event' | 'credits'
  nodeId: string
  nodeName: string
  payload: {
    message?: string
    question?: string
    responseSchema?: FormSchema | null
  }
}

export interface AssistantRun {
  id: string
  status: 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled' | 'invalid' | 'unsupported'
  /** `testPassed`: false when the assistant's last test of the built or changed workflow still failed. */
  /** `newPage`: the assistant built a separate workflow (accepting it opens a new canvas page). */
  output: { reply?: string; draftId?: string; openIssues?: unknown[]; testPassed?: boolean; newPage?: boolean } | null
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

/** The picked model as the assistant API takes it; "Default" sends nothing, so the Admin Center's default model runs. */
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
  /** The chat: the assistant remembers its earlier turns in the same conversation. */
  conversationId?: string
  /** A saved workflow the user is asking about, read only. */
  referenceWorkflowId?: string
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
      ...(options.conversationId ? { conversationId: options.conversationId } : {}),
      ...(options.referenceWorkflowId ? { referenceWorkflowId: options.referenceWorkflowId } : {}),
    }),
    signal: options.signal,
  })
  return readAssistantStream(response, options.onEvent)
}

/** What the builder assistant's run ends with: the workflow assistant's output plus the app project and deployment. */
export type BuilderRun = Omit<AssistantRun, 'output'> & {
  output: (NonNullable<AssistantRun['output']> & { projectId?: string; deploymentId?: string }) | null
}

/**
 * Send a message to the builder assistant (backend `docs/unified-builder-assistant.md`), which builds workflows,
 * builds apps and connects an app to a deployed workflow. Runs and answers work as for the workflow assistant.
 */
export async function streamBuilderMessage(options: {
  message: string
  draftId?: string
  workflowId?: string
  /** The app project this chat is building; left out, the builder opens a new one. */
  projectId?: string
  /** The deployed workflow an app should call; left out, the builder asks when there are several. */
  deploymentId?: string
  model?: GenerateWorkflowModel
  conversationId?: string
  referenceWorkflowId?: string
  onEvent?: (event: AssistantRunEvent) => void
  signal?: AbortSignal
}): Promise<BuilderRun> {
  const response = await authorizedFetch('/api/v1/builder-assistant/messages/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await orchestrationHeaders()) },
    body: JSON.stringify({
      message: options.message,
      ...(options.draftId ? { draftId: options.draftId } : {}),
      ...(options.workflowId ? { workflowId: options.workflowId } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(options.deploymentId ? { deploymentId: options.deploymentId } : {}),
      ...(assistantModel(options.model) ? { model: assistantModel(options.model) } : {}),
      ...(options.conversationId ? { conversationId: options.conversationId } : {}),
      ...(options.referenceWorkflowId ? { referenceWorkflowId: options.referenceWorkflowId } : {}),
    }),
    signal: options.signal,
  })
  return (await readAssistantStream(response, options.onEvent)) as BuilderRun
}

/** An app project the builder works on, as the chat shows it. */
export interface BuilderProject {
  projectId?: string
  files: string[]
  scripts?: string[]
  dependencies?: string[]
  changed?: string[]
  screenshots: string[]
}

export async function fetchBuilderProject(projectId: string): Promise<BuilderProject> {
  const response = await authorizedFetch(`/api/v1/builder-assistant/projects/${encodeURIComponent(projectId)}`)
  if (!response.ok) throw new Error(await errorMessage(response))
  return (await response.json()) as BuilderProject
}

/** The app's dev server preview: whether it runs, its address (this machine only) and the end of its log. */
export interface BuilderPreview {
  running: boolean
  available?: boolean
  url: string | null
  log?: string
}

async function previewCall(projectId: string, method: 'GET' | 'POST' | 'DELETE'): Promise<BuilderPreview> {
  const response = await authorizedFetch(`/api/v1/builder-assistant/projects/${encodeURIComponent(projectId)}/preview`, { method })
  if (!response.ok) throw new Error(await errorMessage(response))
  return (await response.json()) as BuilderPreview
}

export const fetchBuilderPreview = (projectId: string) => previewCall(projectId, 'GET')
export const startBuilderPreview = (projectId: string) => previewCall(projectId, 'POST')
export const stopBuilderPreview = (projectId: string) => previewCall(projectId, 'DELETE')

export async function fetchLatestBuilderProject(): Promise<string | null> {
  const response = await authorizedFetch('/api/v1/builder-assistant/projects/latest')
  if (!response.ok) throw new Error(await errorMessage(response))
  return ((await response.json()) as { projectId: string | null }).projectId
}

export async function fetchBuilderFile(projectId: string, path: string): Promise<string> {
  const response = await authorizedFetch(
    `/api/v1/builder-assistant/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`,
  )
  if (!response.ok) throw new Error(await errorMessage(response))
  return ((await response.json()) as { content: string }).content
}

/** One screenshot the builder took, as an object URL (the caller revokes it). */
export async function fetchBuilderScreenshot(projectId: string, name: string): Promise<string> {
  const response = await authorizedFetch(
    `/api/v1/builder-assistant/projects/${encodeURIComponent(projectId)}/screenshots/${encodeURIComponent(name)}`,
  )
  if (!response.ok) throw new Error(await errorMessage(response))
  return URL.createObjectURL(await response.blob())
}

/** Answer what a waiting run asked (a plan approval, a question, a form) and continue it; `onEvent` gets each
 * step of the continued run as it happens, as for a message. */
export async function answerAssistant(
  runId: string,
  requestId: string,
  response: Record<string, unknown>,
  options: { onEvent?: (event: AssistantRunEvent) => void; signal?: AbortSignal } = {},
): Promise<AssistantRun> {
  const reply = await authorizedFetch(
    `/api/v1/workflows/v4/runs/${encodeURIComponent(runId)}/requests/${encodeURIComponent(requestId)}/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await orchestrationHeaders()) },
      body: JSON.stringify({ response }),
      signal: options.signal,
    },
  )
  return readAssistantStream(reply, options.onEvent)
}

/** A run's server-sent events: each step to `onEvent`, then the run itself (`event: run`). */
async function readAssistantStream(response: Response, onEvent?: (event: AssistantRunEvent) => void): Promise<AssistantRun> {
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
      else onEvent?.(parsed as AssistantRunEvent)
    }
  }
  if (!run) throw new Error('The assistant stopped without an answer')
  return run
}

/** A finished (or waiting) run, such as the assistant's test run of a draft. */
export interface TestRun extends AssistantRun {
  inputs: Record<string, unknown>
}

export function fetchTestRun(runId: string): Promise<TestRun> {
  return request(`/api/v1/workflows/v4/runs/${encodeURIComponent(runId)}`)
}

/** The test run an assistant turn started, if any: the last `test_run` call that reported a run. */
export function testRunIdOf(events: AssistantRunEvent[]): string | undefined {
  // The assistant's own test (self_test, after it builds or edits) or an older test_run: the last one is the result
  return [...events]
    .reverse()
    .find((event) => event.type === 'tool.completed' && (event.tool === 'self_test' || event.tool === 'test_run') && event.detail?.result?.runId)
    ?.detail?.result?.runId
}

/** A test the assistant handed to the canvas (`test_run`): the draft and the inputs to run it with. */
export interface CanvasTestRequest {
  draftId: string
  inputs: Record<string, unknown>
}

export function canvasTestOf(events: AssistantRunEvent[]): CanvasTestRequest | undefined {
  const result = [...events]
    .reverse()
    .find((event) => event.type === 'tool.completed' && event.tool === 'test_run' && event.detail?.result?.status === 'started_on_canvas')
    ?.detail?.result
  return result?.draftId ? { draftId: result.draftId, inputs: result.inputs ?? {} } : undefined
}

/** A draft of a 4.0 document, such as the open canvas tab, for the assistant to work on. */
export function createDraft(document: WorkflowV4Document): Promise<{ id: string }> {
  return request('/api/v1/workflow-assistant/drafts', { method: 'POST', body: JSON.stringify({ document }) })
}

export function fetchDraftDiff(draftId: string): Promise<DraftDiff> {
  return request(`/api/v1/workflow-assistant/drafts/${encodeURIComponent(draftId)}/diff`)
}

/** The draft, the document it started from and their diff, to show the changes on the canvas. */
export function fetchDraftPreview(draftId: string): Promise<{ document: WorkflowV4Document; base: WorkflowV4Document; diff: DraftDiff }> {
  return request(`/api/v1/workflow-assistant/drafts/${encodeURIComponent(draftId)}/preview`)
}

/** Close the draft; its document is what the canvas should show and save. */
export function acceptDraft(draftId: string): Promise<{ draftId: string; workflowId: string | null; document: WorkflowV4Document }> {
  return request(`/api/v1/workflow-assistant/drafts/${encodeURIComponent(draftId)}/accept`, { method: 'POST' })
}

export function discardDraft(draftId: string): Promise<void> {
  return request(`/api/v1/workflow-assistant/drafts/${encodeURIComponent(draftId)}/discard`, { method: 'POST' })
}
