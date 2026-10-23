import type { ExecutionLogEvent } from '@/services/orchestration-api'
import { filesToPlan, readRunAnswer } from '@/services/workflow-files'
import { runWorkflow, workflowAssistantId, type CatalogModel, type PlanReview } from '@/services/workflow-run-api'
import type { GenerateWorkflowResponse, WorkflowGenerationPlan } from '@/types/workflow-generation'

/** The run's `inputs.prompt` limit on the API (OrchestrationInputs.prompt max_length). */
const MAX_MESSAGE_LENGTH = 20000

export interface GenerateWorkflowAttachment {
  name: string
  content: string
}

/** Which model runs the assistant: the catalog default or a model picked from the catalog. */
export type GenerateWorkflowModel =
  /** The catalog's default model. */
  | { provider: 'server' }
  /** A model picked from the application's model catalog. */
  | { provider: 'catalog'; providerId: string; modelId: string; label: string }
  /** A local Ollama model (older saved choice; runs on the catalog's `ollama` provider). */
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
  /** The manager's plan needs approval; the run waits until `submitPlanReview` answers it. */
  onPlanReview?: (review: PlanReview) => void
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

/** The canvas as compact JSON, for the agents to read when they update it. */
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

/** The run's model: a local Ollama model from the catalog, or none to use the catalog's default. */
function catalogModel(model: GenerateWorkflowModel | undefined): CatalogModel | undefined {
  if (model?.provider === 'catalog') return { provider: model.providerId, modelId: model.modelId }
  if (model?.provider === 'ollama') return { provider: 'ollama', modelId: model.model }
  return undefined
}

function modelLabel(model: GenerateWorkflowModel | undefined): string {
  if (model?.provider === 'catalog') return model.label
  if (model?.provider === 'ollama') return model.model
  return 'the default model'
}

/**
 * The message the agents read. The run reads only `inputs.message`, so the canvas being
 * edited and any attached files travel inside it, after the request.
 */
function runMessage(request: GenerateWorkflowRequest): string {
  const parts = [request.prompt]
  if (request.workflow) {
    // Context only: the request above decides whether to change it, build something new, or just answer.
    parts.push(
      `For context, the workflow currently open on the canvas:\n\`\`\`json\n${JSON.stringify(planBody(request.workflow))}\n\`\`\``,
    )
  }
  for (const attachment of request.attachments ?? []) {
    parts.push(`Attachment "${attachment.name}":\n${attachment.content}`)
  }
  return parts.join('\n\n').slice(0, MAX_MESSAGE_LENGTH)
}

/**
 * Ask the workflow assistant (the admin workflow with purpose `ai_assistant`) to draft a
 * workflow from a prompt, or to update `workflow`.
 *
 * The run streams: `onAgentEvent` gets each pipeline step and each agent's rows as they
 * happen. When the final answer carries the workflow files they are drawn on the canvas;
 * otherwise the answer is the reply.
 */
export async function generateWorkflowFromPrompt(
  request: GenerateWorkflowRequest,
): Promise<GenerateWorkflowResponse> {
  const result = await runWorkflow({
    workflowId: await workflowAssistantId(),
    inputs: {
      prompt: runMessage(request),
      ...(request.workflowName?.trim() ? { workflowName: request.workflowName.trim() } : {}),
      ...(request.history?.length ? { history: request.history } : {}),
    },
    model: catalogModel(request.model),
    onAgentEvent: request.onAgentEvent,
    onPlanReview: request.onPlanReview,
    signal: request.signal,
  })
  const modelName = modelLabel(request.model)
  const answer = readRunAnswer(typeof result.text === 'string' ? result.text : '')
  const meta = { model: modelName, origin: 'workflow-assistant', mode: answer.mode, summary: answer.summary }
  if (!answer.files) {
    if (!answer.summary) throw new Error('The workflow assistant finished without an answer.')
    return { plan: null, reply: answer.summary, ...meta }
  }
  return { plan: filesToPlan(answer.files), ...meta }
}
