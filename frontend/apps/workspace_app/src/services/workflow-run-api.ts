/**
 * Run a stored workflow: `POST /api/v1/{workflowId}/execute` with live events.
 *
 * The stream sends `run` ({runId}), `progress` (each pipeline step), `agent` (each agent update
 * while the workflow runs), `plan_review` when the manager's plan needs approval (the run waits
 * for `submitPlanReview`), then one `result` ({text, outputs, template}) or one `error` ({status, detail}).
 */
import { authorizedFetch } from '@/services/api-auth'
import { fetchAssistant } from '@/services/assistant-api'
import { errorMessage, orchestrationHeaders, readEventStream, type ExecutionLogEvent } from '@/services/orchestration-api'

/**
 * The model picked for the run: a model from the application's catalog (`provider` + `modelId`),
 * or a saved model client (`connectionId`), the user's own or the admin's.
 */
export interface CatalogModel {
  provider?: string
  modelId?: string
  connectionId?: string
  temperature?: number
  maxTokens?: number
  /** Agent id or name -> the model that agent uses instead. */
  overrides?: Record<string, Omit<CatalogModel, 'overrides'>>
}

/** The manager's plan, waiting for a person to approve it or ask for changes. */
export interface PlanReview {
  runId: string
  requestId: string
  plan: string
  /** True when the manager re-planned because the run stopped making progress. */
  isStalled: boolean
}

export interface WorkflowRunRequest {
  workflowId: string
  inputs: Record<string, unknown>
  model?: CatalogModel
  onAgentEvent?: (event: ExecutionLogEvent) => void
  /** The run is paused until `submitPlanReview` answers this review. */
  onPlanReview?: (review: PlanReview) => void
  signal?: AbortSignal
}

/** Approve the plan a run is waiting on, or send feedback so the manager revises it. */
export async function submitPlanReview(
  review: Pick<PlanReview, 'runId' | 'requestId'>,
  decision: { approved: boolean; feedback?: string },
): Promise<void> {
  const response = await authorizedFetch(`/api/v1/runs/${encodeURIComponent(review.runId)}/plan-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await orchestrationHeaders()) },
    body: JSON.stringify({ requestId: review.requestId, approved: decision.approved, feedback: decision.feedback ?? '' }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
}

export interface WorkflowRunResult {
  text: string
  outputs: unknown[]
  template: Record<string, unknown>
}

/** Pipeline step -> the title its timeline row shows. Unknown steps show their own name. */
const STEP_TITLES: Record<string, string> = {
  get_template: 'Loading the template',
  resolve_variables: 'Preparing agents and models',
  execute_engine: 'Running the agents',
}

let assistantWorkflowId: Promise<string> | null = null

/**
 * The workflow the chat assistant runs: the one an admin published with purpose `ai_assistant`
 * (`VITE_WORKFLOW_ASSISTANT_ID` overrides it). Looked up once; `forgetAssistantWorkflow` re-reads it.
 */
export function workflowAssistantId(): Promise<string> {
  const configured = (import.meta.env.VITE_WORKFLOW_ASSISTANT_ID as string | undefined)?.trim()
  if (configured) return Promise.resolve(configured)
  assistantWorkflowId ??= fetchAssistant().then((assistant) => {
    if (!assistant) throw new Error('No workflow is published as the AI assistant yet. An admin can publish one from the canvas.')
    return assistant.workflowId
  })
  assistantWorkflowId.catch(() => {
    assistantWorkflowId = null
  })
  return assistantWorkflowId
}

/** Read the published assistant again on the next chat request (after an admin publishes another). */
export function forgetAssistantWorkflow(): void {
  assistantWorkflowId = null
}

export async function runWorkflow(request: WorkflowRunRequest): Promise<WorkflowRunResult> {
  const response = await authorizedFetch(`/api/v1/${encodeURIComponent(request.workflowId)}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(await orchestrationHeaders()),
    },
    body: JSON.stringify({ inputs: request.inputs, ...(request.model ? { model: request.model } : {}), events: true }),
    signal: request.signal,
  })
  if (!response.ok) throw new Error(await errorMessage(response))

  let result: WorkflowRunResult | null = null
  let failure = ''
  await readEventStream(response, (eventName, payload) => {
    if (eventName === 'agent') {
      request.onAgentEvent?.({ event: 'agent', ...(payload as Omit<ExecutionLogEvent, 'event'>) })
    } else if (eventName === 'progress') {
      // Pipeline steps (loading the template, preparing models) are internal; only failures are shown.
      if (payload.status === 'failed') request.onAgentEvent?.(progressRow(payload))
    } else if (eventName === 'plan_review') {
      request.onPlanReview?.(payload as unknown as PlanReview)
    } else if (eventName === 'result') {
      result = payload as unknown as WorkflowRunResult
    } else if (eventName === 'error') {
      failure = typeof payload.detail === 'string' ? payload.detail : 'The workflow run failed.'
    }
  })
  if (failure) throw new Error(failure)
  if (!result) throw new Error('The workflow run ended without a result.')
  return result
}

/** A pipeline step as a timeline row, so the chat shows it like an agent's step. */
function progressRow(payload: Record<string, unknown>): ExecutionLogEvent {
  const step = String(payload.step ?? 'step')
  const title = STEP_TITLES[step] ?? step
  const failed = payload.status === 'failed'
  return {
    event: 'agent',
    agentId: `step:${step}`,
    agent: title,
    kind: 'reasoning',
    title,
    status: payload.status === 'started' ? 'running' : 'completed',
    message: failed ? `⚠ ${String(payload.error ?? 'Failed')}` : '',
  }
}
