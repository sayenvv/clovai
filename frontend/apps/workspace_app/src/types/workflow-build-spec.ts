import type { DiagramPage } from '@/components/designer/diagram-types'
import type { AgentWorkflowMeta } from '@/types/agent-workflow'

export const WORKFLOW_BUILD_SPEC_VERSION = '3.0' as const

export type WorkflowSchemaType =
  | 'sequential'
  | 'workflow'
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
  /** Server URL for local providers such as Ollama. */
  baseUrl?: string
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
  /** Admin-listed context providers (memory, knowledge) the agent uses. */
  contextProviderIds?: string[]
  responseSchema: SchemaBlock
  metadata: Record<string, unknown>
}

/**
 * A context provider the workflow's agents use (agents name it in `contextProviderIds`). The admin
 * catalog keeps its handler and settings; the server runs the catalog's, never a copy from here.
 */
export interface WorkflowBuildContextProvider {
  id: string
  name: string
  description: string
  slot: 'memory' | 'knowledge'
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
  feedbackRevisionsEnabled?: boolean
  maxFeedbackRevisions?: number
}

export interface WorkflowRetryPolicy {
  maxRetries: number
  retryDelaySeconds: number
}

export interface WorkflowLoggingSettings {
  enabled: boolean
  level: WorkflowLogLevel
}

export interface WorkflowOrchestrationSettings {
  startAgentId?: string | null
  managerAgentId?: string | null
  maxRounds?: number
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

/** From the Configuration tab: tracing and OpenTelemetry export for this workflow. */
export interface WorkflowObservabilitySettings {
  tracing: {
    enabled: boolean
    captureSensitiveData: boolean
    persistExecutionHistory: boolean
  }
  openTelemetry: {
    enabled: boolean
    exporter: 'otlp-http' | 'otlp-grpc' | 'console'
    endpoint: string
    serviceName: string
    headers: Record<string, string>
    sampleRate: number
    metricsEnabled: boolean
  }
}

/** From the Configuration tab: run-wide guard rails. */
export interface WorkflowRuntimeSettings {
  maxIterations: number
  timeoutSeconds: number
  retryAttempts: number
  checkpointingEnabled: boolean
}

export interface WorkflowSettings {
  timeoutSeconds: number
  streamResponse: boolean
  retryPolicy: WorkflowRetryPolicy
  logging: WorkflowLoggingSettings
  metadata: Record<string, unknown>
  orchestration?: WorkflowOrchestrationSettings
  observability?: WorkflowObservabilitySettings
  runtime?: WorkflowRuntimeSettings
}

export interface WorkflowBuildSpec {
  meta: WorkflowBuildMeta
  modelConfig: WorkflowModelConfig
  agents: WorkflowBuildAgent[]
  tools: WorkflowBuildTool[]
  /** Every context provider the agents use, once each. */
  contextProviders?: WorkflowBuildContextProvider[]
  edges: WorkflowBuildEdge[]
  settings: WorkflowSettings
  /** Graph workflows (`meta.workflowType: "workflow"`): the Agent Framework WorkflowBuilder graph. */
  workflowBuilder?: WorkflowBuilderGraph
  /** The editor canvas (pages, node positions, connectors) so this file can be imported again. */
  canvas?: WorkflowCanvasExport
}

/** The editor's canvas document, carried in the build spec for import. */
export interface WorkflowCanvasExport {
  activePageId: string
  activeMainPageId?: string
  pages: DiagramPage[]
  workflow?: AgentWorkflowMeta
}

export interface WorkflowBuildSaveResult {
  workspaceId: string
  pageId: string
  workflowId: string
  localStorageKey: string
  databaseRecordId?: string
  /** Why the database save failed, when it did (the spec is still cached locally). */
  databaseError?: string
  savedAt: string
}

/** A connector condition, checked against the source agent's output. */
export interface EdgeCondition {
  /** The condition as written on the connector. */
  expression: string
  /** Parsed form when the expression reads `field op value`; `field: "text"` means the reply text. */
  field?: string
  op?: 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'exists'
  value?: string | number | boolean | Array<string | number>
}

interface EdgeGroupBase {
  id: string
  /** Canvas connector ids this group came from. */
  connectorIds: string[]
}

/** Each group is one Agent Framework WorkflowBuilder call, named in `method`. */
export type WorkflowEdgeGroup =
  | (EdgeGroupBase & {
      type: 'edge'
      method: 'add_edge'
      source: string
      target: string
      condition?: EdgeCondition
    })
  | (EdgeGroupBase & { type: 'fan_out'; method: 'add_fan_out_edges'; source: string; targets: string[] })
  | (EdgeGroupBase & { type: 'fan_in'; method: 'add_fan_in_edges'; sources: string[]; target: string })
  | (EdgeGroupBase & {
      type: 'switch_case'
      method: 'add_switch_case_edge_group'
      source: string
      /** The Switch node on the canvas this group comes from. */
      switchNodeId: string
      cases: Array<{ target: string; condition: EdgeCondition }>
      default?: string
    })

export interface WorkflowBuilderGraph {
  builder: 'WorkflowBuilder'
  /** Agents the run starts at (what Start connects to). */
  startExecutorIds: string[]
  /** Agents whose output is the workflow's output (wired to End, or with nothing after them). */
  outputExecutorIds: string[]
  edgeGroups: WorkflowEdgeGroup[]
}
