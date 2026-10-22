/**
 * Run a stored workflow: `POST /api/v1/{workflowId}/execute` with live events.
 *
 * The stream sends `run` ({runId}), `progress` (each pipeline step), `agent` (each agent update
 * while the workflow runs), `plan_review` when the manager's plan needs approval (the run waits
 * for `submitPlanReview`), then one `result` ({text, outputs, template}) or one `error` ({status, detail}).
 */
import { authorizedFetch } from '@/services/api-auth'
import { errorMessage, orchestrationHeaders, readEventStream, type ExecutionLogEvent } from '@/services/orchestration-api'

/** The model picked for the run, from the application's model catalog. */
export interface CatalogModel {
  provider: string
  modelId: string
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

/** The admin workflow with this purpose powers the workflow chat. */
const ASSISTANT_PURPOSE = 'ai_assistant'

let assistantWorkflowId: Promise<string> | null = null

/**
 * The stored workflow the chat runs: `VITE_WORKFLOW_ASSISTANT_ID` when set, otherwise the
 * admin-made workflow whose purpose is `ai_assistant`.
 */
export function workflowAssistantId(): Promise<string> {
  const configured = (import.meta.env.VITE_WORKFLOW_ASSISTANT_ID as string | undefined)?.trim()
  if (configured) return Promise.resolve(configured)
  assistantWorkflowId ??= findAssistantWorkflow().catch((error: unknown) => {
    assistantWorkflowId = null
    throw error
  })
  return assistantWorkflowId
}

async function findAssistantWorkflow(): Promise<string> {
  const response = await authorizedFetch('/api/v1/admin/definitions/workflows?workflowType=system_generated')
  if (!response.ok) throw new Error(await errorMessage(response))
  const workflows = (await response.json()) as Array<{ id: string; purpose?: string | null }>
  const found = workflows.find((item) => item.purpose === ASSISTANT_PURPOSE)
  if (!found) {
    throw new Error(`No admin workflow has purpose "${ASSISTANT_PURPOSE}". Create one in the Admin center.`)
  }
  return found.id
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
      request.onAgentEvent?.(progressRow(payload))
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
