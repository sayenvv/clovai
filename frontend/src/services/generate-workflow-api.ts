import { authorizedFetch } from '@/services/api-auth'
import {
  errorMessage,
  orchestrationHeaders,
  readEventStream,
  type ExecutionLogEvent,
} from '@/services/orchestration-api'
import { addTokenUsage, writeTokenUsage, type TokenUsageSnapshot } from '@/services/token-usage-store'
import type { GenerateWorkflowResponse, WorkflowGenerationPlan } from '@/types/workflow-generation'

/** Catalog entry on the API that drafts and updates workflow plans. */
const WORKFLOW_BUILDER_ID =
  (import.meta.env.VITE_WORKFLOW_BUILDER_ORCHESTRATION as string | undefined)?.trim() || 'workflow-builder'

export interface GenerateWorkflowAttachment {
  name: string
  content: string
}

/** Which model drafts the plan: the application's configured model or a local Ollama model. */
export type GenerateWorkflowModel =
  | { provider: 'server' }
  | { provider: 'ollama'; model: string; baseUrl: string }

export interface GenerateWorkflowHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateWorkflowRequest {
  prompt: string
  workflowName?: string
  /** The current canvas. When set, the API updates it instead of drafting a new workflow. */
  workflow?: WorkflowGenerationPlan
  /** Earlier chat turns, oldest first. */
  history?: GenerateWorkflowHistoryMessage[]
  model?: GenerateWorkflowModel
  attachments?: GenerateWorkflowAttachment[]
  /** Each agent row as it streams: plans, progress checks, thinking, and answers. */
  onAgentEvent?: (event: ExecutionLogEvent) => void
  /** Called with the request's total tokens after each model call. */
  onUsage?: (runTotalTokens: number) => void
  signal?: AbortSignal
}

interface PlanBody {
  workflow_name: string
  description: string
  execution_type: string
  agents: Array<{
    key: string
    name: string
    description: string
    palette_id: string
    instructions: string
    tools: string[]
    x?: number
    y?: number
  }>
  edges: Array<{
    from_key: string
    to_key: string
    label: string
    human_approval: boolean
  }>
}

function mapPlan(body: PlanBody): WorkflowGenerationPlan {
  return {
    workflowName: body.workflow_name,
    description: body.description,
    executionType: body.execution_type as WorkflowGenerationPlan['executionType'],
    agents: body.agents.map((agent) => ({
      key: agent.key,
      name: agent.name,
      description: agent.description,
      paletteId: agent.palette_id,
      instructions: agent.instructions,
      tools: agent.tools ?? [],
      ...(typeof agent.x === 'number' && typeof agent.y === 'number'
        ? { x: agent.x, y: agent.y }
        : {}),
    })),
    edges: body.edges.map((edge) => ({
      fromKey: edge.from_key,
      toKey: edge.to_key,
      label: edge.label ?? '',
      humanApproval: edge.human_approval ?? false,
    })),
  }
}

/** The inverse of `mapPlan`: the JSON shape the workflow builder reads and writes. */
function planBody(plan: WorkflowGenerationPlan): PlanBody {
  return {
    workflow_name: plan.workflowName,
    description: plan.description,
    execution_type: plan.executionType,
    agents: plan.agents.map((agent) => ({
      key: agent.key,
      name: agent.name,
      description: agent.description,
      palette_id: agent.paletteId,
      instructions: agent.instructions,
      tools: agent.tools,
      ...(typeof agent.x === 'number' && typeof agent.y === 'number' ? { x: agent.x, y: agent.y } : {}),
    })),
    edges: plan.edges.map((edge) => ({
      from_key: edge.fromKey,
      to_key: edge.toKey,
      label: edge.label,
      human_approval: edge.humanApproval,
    })),
  }
}

/** The canvas `model` block for a local model. The server option leaves the application's model in place. */
function modelBlock(model: GenerateWorkflowModel | undefined): Record<string, string> | undefined {
  if (model?.provider !== 'ollama') return undefined
  return { provider: 'ollama', name: model.model, deployment: model.model, endpoint: model.baseUrl }
}

function isSnapshot(value: unknown): value is TokenUsageSnapshot {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return ['tokenLimit', 'tokensUsed', 'tokensRemaining'].every((key) => typeof record[key] === 'number')
}

function failureMessage(payload: Record<string, unknown>): string {
  const detail = typeof payload.detail === 'string' ? payload.detail : 'The workflow builder failed.'
  const errors = Array.isArray(payload.errors)
    ? payload.errors.filter((item): item is string => typeof item === 'string').slice(0, 3)
    : []
  return errors.length > 0 ? `${detail} ${errors.join('; ')}` : detail
}

/**
 * Ask the workflow builder to draft a workflow plan from a prompt, or to update `workflow`.
 *
 * The run streams while the planner, designer, editor, and reviewer work, and
 * `onAgentEvent` receives each of their rows as it arrives. The model comes from the application
 * configuration unless a local model is chosen.
 */
export async function generateWorkflowFromPrompt(
  request: GenerateWorkflowRequest,
): Promise<GenerateWorkflowResponse> {
  const model = modelBlock(request.model)
  const response = await authorizedFetch(
    `/api/v1/orchestrations/${encodeURIComponent(WORKFLOW_BUILDER_ID)}/run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(await orchestrationHeaders()),
      },
      body: JSON.stringify({
        inputs: {
          prompt: request.prompt,
          ...(request.workflowName?.trim() ? { workflowName: request.workflowName.trim() } : {}),
          ...(request.workflow ? { workflow: planBody(request.workflow) } : {}),
          ...(request.history?.length ? { history: request.history } : {}),
          ...(request.attachments?.length ? { attachments: request.attachments } : {}),
        },
        ...(model ? { model } : {}),
        events: true,
      }),
      signal: request.signal,
    },
  )
  if (!response.ok) throw new Error(await errorMessage(response))

  const outcome = { output: null as PlanBody | null, reply: '', summary: '', tokens: 0, failure: '' }
  await readEventStream(response, (eventName, payload) => {
    if (eventName === 'agent') {
      request.onAgentEvent?.({ event: eventName, ...(payload as Omit<ExecutionLogEvent, 'event'>) })
    } else if (eventName === 'usage') {
      // Count each model call now; the result below carries the server's recorded totals.
      addTokenUsage(typeof payload.totalTokens === 'number' ? payload.totalTokens : 0)
      if (typeof payload.runTotalTokens === 'number') request.onUsage?.(payload.runTotalTokens)
    } else if (eventName === 'result') {
      const usage = payload.usage as { totalTokens?: unknown } | undefined
      outcome.tokens = typeof usage?.totalTokens === 'number' ? usage.totalTokens : 0
      if (isSnapshot(payload.subscription)) writeTokenUsage(payload.subscription)
      outcome.output = (payload.output as PlanBody | undefined) ?? null
      outcome.reply = typeof payload.reply === 'string' ? payload.reply : ''
      outcome.summary = typeof payload.text === 'string' ? payload.text.trim() : ''
    } else if (eventName === 'error') {
      outcome.failure = failureMessage(payload)
    }
  })
  if (outcome.failure) throw new Error(outcome.failure)
  const modelName = request.model?.provider === 'ollama' ? request.model.model : 'the application model'
  // A question such as "how many agents are there?" is answered without the multi-agent run.
  if (!outcome.output && outcome.reply) {
    return { plan: null, reply: outcome.reply, tokens: outcome.tokens, model: modelName, origin: 'orchestration' }
  }
  if (!outcome.output) throw new Error('The workflow builder finished without a workflow.')

  return {
    plan: mapPlan(outcome.output),
    // The planner's closing reply. A reply that is itself JSON is not a summary.
    ...(outcome.summary && !/^[{[`]/.test(outcome.summary) ? { summary: outcome.summary } : {}),
    tokens: outcome.tokens,
    model: modelName,
    origin: 'orchestration',
  }
}
