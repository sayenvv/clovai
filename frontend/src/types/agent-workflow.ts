import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

export type AgentStatus = 'active' | 'inactive' | 'draft'
export type AgentType =
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

export type WorkflowExecutionType =
  | 'sequential'
  | 'parallel'
  | 'conditional'
  | 'group-chat'
  | 'dependency'
  | 'human-in-the-loop'

export type DeploymentStatus = 'draft' | 'validated' | 'deployed' | 'failed'

export interface AgentNodeConfig {
  agentType: AgentType
  description: string
  instructions: string
  model: string
  temperature: number
  tools: string[]
  inputSchema: string
  outputSchema: string
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
}

export type WorkflowRunStatus =
  | 'idle'
  | 'running'
  | 'waiting-approval'
  | 'completed'
  | 'failed'
  | 'cancelled'

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
  approvalPrompt: {
    edgeId: string
    message: string
    role: string
    nextAgentName: string
  } | null
}
