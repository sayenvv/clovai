export const WORKFLOW_BUILD_SPEC_VERSION = '3.0' as const

export type WorkflowSchemaType =
  | 'sequential'
  | 'groupchat'
  | 'magnetic'
  | 'handoff'
  | 'parallel'

export type WorkflowExecutionMode = 'standard' | 'human-in-the-loop'

export type WorkflowSchemaStatus = 'draft' | 'validated' | 'deployed' | 'archived'

export type WorkflowToolType = 'api' | 'function' | 'database' | 'webhook' | 'custom' | 'mcp'

export type WorkflowLogLevel = 'debug' | 'info' | 'warning' | 'error'

export interface SchemaBlock {
  raw: string
  parsed: Record<string, unknown>
}

export interface WorkflowBuildMeta {
  schemaVersion: typeof WORKFLOW_BUILD_SPEC_VERSION
  workspaceId: string
  pageId: string
  pageName: string
  workflowId: string
  workflowName: string
  workflowVersion: number
  workflowType: WorkflowSchemaType
  executionMode: WorkflowExecutionMode
  status: WorkflowSchemaStatus
  description: string
  createdAt: string
  updatedAt: string
}

export interface WorkflowModelConfig {
  provider: string
  model: string
  temperature: number
  topP: number
  maxTokens: number
  presencePenalty: number
  frequencyPenalty: number
  seed: number | null
  stream: boolean
}

export interface WorkflowBuildAgent {
  id: string
  name: string
  displayName: string
  description: string
  instructions: string
  systemPrompt: string
  userPrompt: string
  isManager: boolean | null
  isOrchestrator: boolean | null
  toolIds: string[]
  responseSchema: SchemaBlock
  metadata: Record<string, unknown>
}

export interface WorkflowBuildTool {
  id: string
  agentId: string
  name: string
  displayName: string
  description: string
  toolType: WorkflowToolType
  configuration: Record<string, unknown>
  inputSchema: SchemaBlock
  metadata: Record<string, unknown>
}

export interface WorkflowBuildEdge {
  id: string
  fromAgentId: string
  toAgentId: string
  label: string
  humanApproval: boolean
  approvalRole: string
  approvalMessage: string
}

export interface WorkflowRetryPolicy {
  maxRetries: number
  retryDelaySeconds: number
}

export interface WorkflowLoggingSettings {
  enabled: boolean
  level: WorkflowLogLevel
}

export interface WorkflowSubWorkflowExport {
  mountAgentId: string
  pageId: string
  pageName: string
  workflowType: WorkflowSchemaType
  agents: WorkflowBuildAgent[]
  tools: WorkflowBuildTool[]
  edges: WorkflowBuildEdge[]
  subWorkflows: WorkflowSubWorkflowExport[]
}

export interface WorkflowSettings {
  timeoutSeconds: number
  streamResponse: boolean
  retryPolicy: WorkflowRetryPolicy
  logging: WorkflowLoggingSettings
  metadata: Record<string, unknown>
}

export interface WorkflowBuildSpec {
  meta: WorkflowBuildMeta
  modelConfig: WorkflowModelConfig
  agents: WorkflowBuildAgent[]
  tools: WorkflowBuildTool[]
  edges: WorkflowBuildEdge[]
  settings: WorkflowSettings
}

export interface WorkflowBuildSaveResult {
  workspaceId: string
  pageId: string
  workflowId: string
  localStorageKey: string
  databaseRecordId?: string
  savedAt: string
}
