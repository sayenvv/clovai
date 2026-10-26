import { parseWorkflowFile, type ImportedWorkflow } from '@/components/agent-workflow/workflow-import'
import { executeOrchestration, orchestrationIdentity, type ExecutionLogEvent } from '@/services/orchestration-api'
import { workflowAssistantId, type PlanReview } from '@/services/workflow-run-api'
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
  /** A saved model client (Models): the user's own or the admin's. */
  | { provider: 'client'; connectionId: string; label: string; providerType: string; model: string }

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
  /** A saved workflow the user picked as context: the assistant reads it, and updates it when asked. */
  workflowContextId?: string
  /** The chat session: agents with conversation history remember its earlier turns. */
  conversationId?: string
  /** Each agent row as it streams: plans, progress checks, thinking, and answers. */
  onAgentEvent?: (event: ExecutionLogEvent) => void
  /** The manager's plan needs approval; the run waits until `submitPlanReview` answers it. */
  onPlanReview?: (review: PlanReview) => void
  /** Called with the request's total tokens after each model call. */
  onUsage?: (runTotalTokens: number) => void
  signal?: AbortSignal
}

function modelLabel(model: GenerateWorkflowModel | undefined): string {
  if (model?.provider === 'catalog' || model?.provider === 'client') return model.label
  if (model?.provider === 'ollama') return model.model
  return 'the default model'
}

/** Earlier turns, newest last, so the run (which reads one message) knows the conversation. */
function historyText(history: GenerateWorkflowHistoryMessage[] | undefined): string {
  if (!history?.length) return ''
  const lines = history.map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
  return `Earlier in this conversation:\n${lines.join('\n\n')}`
}

/**
 * The message the run reads: the request, then the conversation so far and any attached files.
 * The open canvas is not sent: a workflow the request is about is picked as the context workflow
 * (`workflowContextId`), which the agents read in full with get_context_workflow.
 */
function runMessage(request: GenerateWorkflowRequest): string {
  const parts = [request.prompt]
  const history = historyText(request.history)
  if (history) parts.push(history)
  for (const attachment of request.attachments ?? []) {
    parts.push(`Attachment "${attachment.name}":\n${attachment.content}`)
  }
  return parts.join('\n\n').slice(0, MAX_MESSAGE_LENGTH)
}

const FENCED_JSON = /```(?:json)?\s*([\s\S]*?)```/g

/**
 * The assistant's final answer: a short description, then the workflow JSON in a fenced block
 * (see the Workflow Generator's final answer prompt). Without a workflow, the text is the reply.
 */
function readAssistantAnswer(text: string): { summary: string; imported?: ImportedWorkflow } {
  for (const match of text.matchAll(FENCED_JSON)) {
    let workflow: unknown
    try {
      workflow = JSON.parse(match[1])
    } catch {
      continue
    }
    if (!workflow || typeof workflow !== 'object' || !('meta' in workflow) || !('canvas' in workflow)) continue
    try {
      return { summary: text.replace(match[0], '').trim(), imported: parseWorkflowFile(match[1]) }
    } catch {
      continue
    }
  }
  return { summary: text.trim() }
}

/**
 * Ask the workflow assistant (the admin workflow with purpose `ai_assistant`) to draft a workflow,
 * change the picked context workflow, or answer a question about it.
 *
 * Runs on `POST /api/v1/execute`, streaming each agent's rows to `onAgentEvent`. A workflow in the
 * answer comes back as `imported`, ready to place on the canvas; otherwise the answer is the reply.
 */
export async function generateWorkflowFromPrompt(
  request: GenerateWorkflowRequest,
): Promise<GenerateWorkflowResponse> {
  const outcome = await executeOrchestration({
    identity: orchestrationIdentity('workflow-assistant', await workflowAssistantId()),
    inputs: { message: runMessage(request) },
    workflowContextId: request.workflowContextId,
    conversationId: request.conversationId,
    // Agent rows only; the run's own start/finish progress rows are not chat steps. The manager's
    // plan and hand-offs ("reasoning" rows) are left out too: the chat shows "Thinking" meanwhile.
    onEvent: (event) => {
      if (event.event === 'agent' && event.kind !== 'reasoning') request.onAgentEvent?.(event)
    },
    signal: request.signal,
  })
  if (outcome.error) throw new Error(outcome.error)
  const answer = readAssistantAnswer(outcome.output)
  // The workflow a run built comes as its own artifact (the agents no longer paste the JSON)
  const built = outcome.artifacts?.workflow
  if (built && typeof built === 'object' && !answer.imported) {
    try {
      answer.imported = parseWorkflowFile(JSON.stringify(built))
    } catch {
      // Not a canvas we can draw: the reply still says what was built
    }
  }
  const meta = { model: modelLabel(request.model), origin: 'workflow-assistant', summary: answer.summary }
  if (answer.imported) return { plan: null, imported: answer.imported, mode: request.workflowContextId ? 'update' : 'create', ...meta }
  if (!answer.summary) throw new Error('The workflow assistant finished without an answer.')
  return { plan: null, reply: answer.summary, mode: 'answer', ...meta }
}
