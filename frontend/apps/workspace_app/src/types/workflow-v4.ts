/**
 * Workflow format 4.0: one JSON document per workflow, every id a UUID, orchestration set on nodes
 * and edges instead of a workflow-level pattern. Reference: backend `docs/workflow-format.md`.
 */

export const WORKFLOW_V4_VERSION = '4.0' as const

/** A `{{ CEL }}` expression or a plain value. */
export type Expr = string

export type JsonSchema = Record<string, unknown>

export interface LibraryRef {
  library: 'agent' | 'tool' | 'middleware' | 'workflow'
  id: string
  /** A pinned version, or `latest` in drafts. */
  version: number | 'latest'
}

export interface WorkflowV4Meta {
  id: string
  name: string
  description: string
  version: number
  status: 'draft' | 'published'
  tags: string[]
  migratedFrom: string | null
  createdAt: string
  updatedAt: string
}

export type TriggerV4 =
  | { id: string; name: string; type: 'chat' | 'manual' }
  | { id: string; name: string; type: 'schedule'; cron: string; timezone?: string }
  | { id: string; name: string; type: 'webhook'; auth: 'api_key' | 'bearer' | 'none' }
  | { id: string; name: string; type: 'app_event'; connectionId?: string; event: string; filter?: Expr }

export interface StateKeyV4 {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object'
  items?: JsonSchema
  default: unknown
  reducer: 'replace' | 'append' | 'union' | 'merge' | 'sum'
  scope: 'run' | 'conversation' | 'user'
}

export interface ConnectionV4 {
  id: string
  name: string
  provider: string
  credentialId: string
  scopes?: string[]
}

export interface ModelV4 {
  id: string
  name: string
  connectionId: string
  model: string
  params: Record<string, unknown>
}

export interface MiddlewareV4 {
  id: string
  name: string
  kind: 'agent' | 'chat' | 'tool'
  ref: string
  config: Record<string, unknown>
}

export type ToolRisk = 'read' | 'write' | 'execute'
export type ToolApproval = 'never' | 'always' | 'on_write'

interface ToolBase {
  id: string
  name: string
  description?: string
  risk: ToolRisk
  approval: ToolApproval
  middlewareIds?: string[]
}

export type ToolV4 =
  | (ToolBase & { kind: 'builtin'; builtin: string; config?: Record<string, unknown> })
  | (ToolBase & { kind: 'function'; handlerId: string; handler: string; inputSchema?: JsonSchema })
  | (ToolBase & { kind: 'mcp'; server: { transport: 'http'; url: string }; connectionId?: string; allow?: string[] })
  | (ToolBase & { kind: 'connector'; connectionId?: string; action: string })
  | (ToolBase & { kind: 'http'; request: Record<string, unknown>; inputSchema?: JsonSchema })

export interface KnowledgeV4 {
  id: string
  name: string
  collectionId: string
  topK: number
}

export interface AgentHarnessV4 {
  enabled: boolean
  [option: string]: unknown
}

export type AgentV4 =
  | {
      id: string
      name: string
      kind: 'native'
      description?: string
      instructions: string
      modelId?: string
      toolIds: string[]
      knowledgeIds?: string[]
      /** Context providers from the Admin Center catalog, by id. */
      contextProviderIds?: string[]
      memory?: { conversation: boolean; longTerm: boolean }
      responseSchema?: JsonSchema
      middlewareIds?: string[]
      harness?: AgentHarnessV4
    }
  | {
      id: string
      name: string
      kind: 'external'
      description?: string
      provider: string
      connectionId?: string
      config: Record<string, unknown>
      middlewareIds?: string[]
    }

export interface SubworkflowV4 {
  id: string
  name: string
  workflowRef: LibraryRef
  inputs: Record<string, string>
  outputs: Record<string, string>
}

export interface StateWrite {
  key: string
  value: Expr
  when?: Expr
}

interface NodeBase {
  id: string
  name: string
  writes?: StateWrite[]
  retry?: { maxAttempts: number; delaySeconds: number }
  limits?: Record<string, number>
  join?: 'all' | 'any'
  next?: 'all' | 'choose'
}

export interface MagenticTeam {
  strategy: 'magentic'
  maxRounds?: number
  maxStalls?: number
  maxResets?: number
  planReview?: boolean
  prompts: Record<
    | 'taskLedgerFacts'
    | 'taskLedgerPlan'
    | 'taskLedgerFull'
    | 'taskLedgerFactsUpdate'
    | 'taskLedgerPlanUpdate'
    | 'progressLedger'
    | 'finalAnswer',
    string | null
  >
}

export interface GroupChatTeam {
  strategy: 'group_chat'
  selection: 'llm' | 'round_robin'
  maxRounds?: number
  termination?: Expr
}

export type NodeV4 =
  | (NodeBase & { type: 'start' })
  | (NodeBase & { type: 'end'; output?: Expr | Record<string, Expr> })
  | (NodeBase & {
      type: 'agent'
      agentId: string
      input?: Expr
      context: 'input' | 'conversation'
      team?: MagenticTeam | GroupChatTeam
      handoff?: { maxHandoffs: number }
    })
  | (NodeBase & { type: 'tool'; toolId: string; input?: Record<string, Expr> })
  | (NodeBase & {
      type: 'code'
      language: 'python'
      source: string
      entrypoint: string
      outputSchema?: JsonSchema
      sandbox: { timeoutSeconds: number; memoryMb: number; network: 'off' | 'on' }
    })
  | (NodeBase & { type: 'condition'; if: Expr })
  | (NodeBase & {
      type: 'approval'
      approvers: { roles: string[] }
      message: Expr
      timeoutSeconds: number
      onTimeout: 'reject' | 'route'
    })
  | (NodeBase & { type: 'subworkflow'; subworkflowId: string; input?: Record<string, Expr> })
  | (NodeBase & { type: 'transform'; output: Record<string, Expr> })

export interface EdgeV4 {
  id: string
  from: string
  to: string
  type?: 'next' | 'delegate' | 'handoff' | 'error'
  when?: Expr
  on?: string
  description?: string
  maxTraversals?: number
}

export interface WorkflowV4Document {
  $comment?: string
  schemaVersion: typeof WORKFLOW_V4_VERSION
  meta: WorkflowV4Meta
  expressions: { language: 'cel'; roots: string[] }
  triggers: TriggerV4[]
  inputs: JsonSchema
  outputs: JsonSchema
  variables: Array<{ name: string; type: string; value: unknown }>
  state: Record<string, StateKeyV4>
  connections: ConnectionV4[]
  models: ModelV4[]
  middlewares: MiddlewareV4[]
  tools: ToolV4[]
  knowledge: KnowledgeV4[]
  workspace: Record<string, unknown> | null
  agents: AgentV4[]
  subworkflows: SubworkflowV4[]
  graph: { startNodeId: string; nodes: NodeV4[]; edges: EdgeV4[] }
  limits: Record<string, number>
  settings: {
    middlewareIds: string[]
    checkpointing: { enabled: boolean; storage: 'postgres' | 'memory' }
    streaming: boolean
    observability: Record<string, unknown>
  }
  tests: unknown[]
  canvas: {
    pages: Array<{
      id: string
      name: string
      layout: Record<string, { x: number; y: number }>
      groups: Array<{ id: string; label: string; nodeIds: string[] }>
      notes: Array<{ id: string; text: string; x: number; y: number }>
      /** The canvas tab as drawn (blocks, connectors, settings), so reopening it is exact; the engine ignores it. */
      diagram?: unknown
      workflowId?: string
    }>
  }
}
