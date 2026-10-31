import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

export type AgentStatus = 'active' | 'inactive' | 'draft'
export type AgentType =
  /** Every AI agent block (Agent, LLM agent, Specialist, Tool agent, external agents). */
  | 'agent'
  /** Legacy: saved before all agents became 'agent'; read as 'agent'. */
  | 'llm'
  | 'specialist'
  | 'tool'
  | 'planner'
  | 'human'
  | 'router'
  | 'trigger'
  | 'memory'
  | 'output'
  | 'control'
  | 'executor'

export type ExecutorHandlerKind = 'class' | 'function'

export type WorkflowExecutionType =
  | 'sequential'
  | 'parallel'
  | 'conditional'
  | 'group-chat'
  | 'dependency'
  | 'human-in-the-loop'

export type DeploymentStatus = 'draft' | 'validated' | 'deployed' | 'failed'

/** Agent Framework's function-tool approval mode. Older saves used `never_required` / `always_required`. */
export type ToolApprovalMode = 'never_require' | 'always_require'

/** The approval mode, reading older saved values. */
export function normalizeApprovalMode(value: string | undefined): ToolApprovalMode {
  return value === 'always_require' || value === 'always_required' ? 'always_require' : 'never_require'
}

export interface AgentNodeConfig {
  agentType: AgentType
  description: string
  instructions: string
  /** Transform blocks: the output, usually an expression such as `{{ nodes.intake.output.email }}`. */
  transformOutput?: string
  /** Loop blocks: the list to go through, the name each item has inside the loop, and how items run. */
  loopOver?: string
  loopItem?: string
  loopMode?: 'sequential' | 'parallel'
  model: string
  /** The model client the agent runs on (see model-providers); guessed from `model` when unset. */
  modelProvider?: string
  /** A saved model connection of the user's (their own endpoint, key and model); see model-connections-api. */
  modelConnectionId?: string
  temperature: number
  /** Custom agents: an image URL shown as the agent's logo on its node. */
  logo?: string
  tools: string[]
  inputSchema: string
  outputSchema: string
  /** Tool nodes: whether invoking this tool requires human approval. */
  approvalMode?: ToolApprovalMode
  /** MCP tool nodes: server endpoint URL. */
  mcpUrl?: string
  /** Function tool nodes: the backend function that runs it, as `package.module:function`. */
  handler?: string
  /** HTTP tool nodes ("HTTP / API"): the request it sends, and how a long-running job is waited for. */
  http?: HttpToolConfig
  /** Tool nodes written as custom code: the switch in the tool's settings. */
  customCode?: boolean
  /** The saved code tool (`/code-tools`) such a tool runs; the 4.0 tool names it as `codeToolId`. */
  codeToolId?: string
  /** The admin-listed context providers (memory, knowledge) this agent uses. */
  contextProviderIds?: string[]
  /** Eleven Nodes executor: stable id used in workflow build exports (defaults from node id). */
  executorId?: string
  /** Class-based executor subclass or @executor function. */
  executorHandlerKind?: ExecutorHandlerKind
  /** Handler input type annotation, e.g. str, int, dict. */
  executorInputType?: string
  /** Message type sent to downstream executors via ctx.send_message. */
  executorOutputType?: string
  /** Type for ctx.yield_output — leave empty if this handler does not yield workflow output. */
  executorWorkflowOutputType?: string
  /** Python handler source (@handler class or @executor function). */
  executorSource?: string
  /** Maps to workflow terminal output — yield_output emits final workflow results. */
  contributesToWorkflowOutput?: boolean
  /** Maps to intermediate output stream — yield_output emits progress events. */
  contributesToIntermediateOutput?: boolean
  /** Clear mutable executor state between workflow runs. */
  executorResettable?: boolean
  /** Pause after this agent until a human approves the handoff. */
  humanInTheLoop?: boolean
  approvalMessage?: string
  approvalRole?: string
  approvalTimeoutMinutes?: number
  /** Reviewer can send feedback and this agent re-runs until they approve. */
  feedbackRevisionsEnabled?: boolean
  maxFeedbackRevisions?: number
  /** Workflow nodes: the Agent Framework builder settings (see workflow-builder-config.ts). */
  workflowConfig?: Record<string, unknown>
  memoryEnabled: boolean
  memoryScope: 'session' | 'workflow' | 'global'
  retryCount: number
  timeoutSeconds: number
  status: AgentStatus
}

export interface ConnectorConfig {
  condition: string
  executionOrder: number
  inputMapping: string
  outputMapping: string
  humanApproval: boolean
  approvalMessage: string
  approvalRole: string
  approvalTimeoutMinutes: number
  feedbackRevisionsEnabled?: boolean
  maxFeedbackRevisions?: number
  fallbackPath: string
  errorPath: string
}

export interface WorkflowDeployment {
  workflowId: string
  endpointUrl: string
  triggerMethod: 'POST' | 'GET'
  authType: 'api-key' | 'bearer' | 'none'
  requestSchema: string
  responseSchema: string
  status: DeploymentStatus
  version: number
  deployedAt?: string
}

export interface AgentWorkflowMeta {
  workflowId: string
  version: number
  status: DeploymentStatus
  executionType: WorkflowExecutionType
  /** Workflow-level default model used in build JSON `modelConfig`. */
  modelConfig?: WorkflowModelConfig
  deployment?: WorkflowDeployment
}

export interface AgentLibraryItem {
  id: string
  paletteId: string
  name: string
  description: string
  agentType: AgentType
  category: 'agents' | 'triggers' | 'control' | 'memory' | 'human' | 'tools' | 'templates'
  defaultConfig: Partial<AgentNodeConfig>
  toolCount?: number
}

export interface WorkflowValidationIssue {
  id: string
  severity: 'error' | 'warning'
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ExecutionTraceStep {
  id: string
  agentName: string
  status: 'pending' | 'running' | 'completed' | 'waiting-approval' | 'error' | 'skipped'
  message: string
  timestamp: string
  nodeId?: string
  durationMs?: number
  output?: string
}

export type ExecutionEventLevel = 'info' | 'warning' | 'error' | 'success'

export type ExecutionEventKind =
  | 'workflow-start'
  | 'workflow-complete'
  | 'agent-start'
  | 'agent-complete'
  | 'tool-invoke'
  | 'approval-wait'
  | 'approval-received'
  | 'edge-traverse'
  | 'warning'
  | 'error'

export interface WorkflowExecutionEvent {
  id: string
  kind: ExecutionEventKind
  level: ExecutionEventLevel
  message: string
  timestamp: string
  nodeId?: string
  agentName?: string
  edgeId?: string
  detail?: string
}

export interface ExecutionPlanStep {
  nodeId: string
  agentName: string
  agentType: AgentType
  tools: string[]
  /** Edge leaving this agent toward the next step (may require human approval). */
  outgoingEdgeId?: string
  humanApproval?: boolean
  approvalMessage?: string
  approvalRole?: string
  nextAgentName?: string
  feedbackRevisionsEnabled?: boolean
  maxFeedbackRevisions?: number
}

export type WorkflowRunStatus =
  | 'idle'
  | 'running'
  | 'waiting-approval'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** One turn in the run's conversation, in the order the agents spoke. */
export interface WorkflowChatMessage {
  id: string
  nodeId: string
  agentName: string
  content: string
  /** `reasoning` turns are plans, progress checks, and model thinking shown apart from answers. */
  kind: 'response' | 'reasoning'
  title?: string
  /** `streaming` while tokens are still arriving for this turn. */
  status: 'streaming' | 'done' | 'failed'
  /** Its title once done, from the workflow's `ui` for the agent or tool. */
  doneTitle?: string
  /** A step shown only beside others (the workflow marks its agent `ui.quiet`, such as the one that routes). */
  quiet?: boolean
}

export interface WorkflowRunState {
  runId: string | null
  status: WorkflowRunStatus
  currentStepIndex: number
  activeEdgeId: string | null
  activeNodeId: string | null
  completedNodeIds: string[]
  events: WorkflowExecutionEvent[]
  trace: ExecutionTraceStep[]
  errors: WorkflowExecutionEvent[]
  warnings: WorkflowExecutionEvent[]
  finalResponse: string | null
  /** Per-agent JSON output shown on the graph when a step completes. */
  stepOutputs: Record<string, string>
  messages: WorkflowChatMessage[]
  approvalPrompt: {
    edgeId: string
    message: string
    role: string
    nextAgentName: string
    agentName?: string
    feedbackRevisionsEnabled?: boolean
    maxFeedbackRevisions?: number
    revisionCount?: number
  } | null
}

/**
 * An HTTP tool's settings, built into a 4.0 `kind: "http"` tool. Text values may hold `{{ args.<name> }}` for the
 * arguments the model passes (see the input schema). Headers, query and body are JSON text. The key is never
 * stored here: `authVariable` names a secret variable, read when the call is made.
 */
export interface HttpToolConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  headers?: string
  query?: string
  body?: string
  timeoutSeconds?: number
  authType?: 'bearer' | 'header' | 'basic'
  authVariable?: string
  authHeader?: string
  /** Start a job, then poll until it finishes. */
  longRunning?: boolean
  /** Where to check the job; empty: the `Location` of a 202 response. `{{ start.body.<field> }}` reads the first reply. */
  statusUrl?: string
  intervalSeconds?: number
  jobTimeoutSeconds?: number
  /** Expressions over the latest status reply, `response.status` and `response.body`. */
  doneWhen?: string
  failedWhen?: string
  /** What to return once done; empty: the status reply's body. */
  result?: string
}

export const DEFAULT_HTTP_TOOL: HttpToolConfig = { method: 'GET', url: '' }
