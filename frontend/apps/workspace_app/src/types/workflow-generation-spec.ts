/**
 * The workflow generation spec: rules, edited and published in the Admin Center, that say how canvas
 * blocks and connectors become workflow format 4.0. Served by `GET /api/v1/workflow-generation-spec`;
 * the backend's `app/workflow_generation/default_spec.json` is the built-in version.
 *
 * Values in `set` are literals, nested objects of values, or:
 * - `{ "from": "agent.x" | "config.x" | "node.label" | "node.paletteId" | "node.slug" | "approval.x",
 *      "default"?, "map"?, "type"?: "number" | "boolean" | "string", "multiply"?, "prefix"?, "parse"?: "json" }`
 * - `{ "when": <value>, "then": <value> }`: `then` only when `when` is truthy
 * - `{ "literal": <anything> }`: taken as is
 */

export type SpecRole =
  | 'start'
  | 'end'
  | 'trigger'
  | 'note'
  | 'attached'
  /** A flow step whose rule sets the 4.0 node `type` and its fields directly (ask user, delay, wait for event). */
  | 'step'
  | 'switch'
  | 'chain'
  | 'parallel'
  | 'subworkflow'
  | 'code'
  | 'approval'
  | 'agent'
  | 'skip'

export interface SpecMatch {
  paletteId?: string | string[]
  /** The orchestration pattern of an orchestrator block: sequential, concurrent, magentic, group-chat, handoff. */
  pattern?: string | string[]
  /** A block attached under an agent (tool, MCP, skill, integration, memory). */
  attached?: boolean
  agentType?: string | string[]
  executor?: boolean
  subworkflow?: boolean
  external?: boolean
  agent?: boolean
  /** A source path that must have a value, such as `agent.handler`. */
  has?: string
}

export interface SpecBlockRule {
  id: string
  description?: string
  match: SpecMatch
  role: SpecRole
  /** For agents: `delegate` makes the agents it connects to its team, `handoff` makes them handoff peers. */
  team?: 'delegate' | 'handoff' | null
  set?: Record<string, unknown>
  /** Extra fields for the agent entry in `agents[]`. */
  agentSet?: Record<string, unknown>
}

export interface SpecToolRule {
  id: string
  description?: string
  match: SpecMatch
  /** `memory` turns on the agent's long-term memory instead of adding a tool. */
  kind?: 'memory' | null
  set?: Record<string, unknown>
}

export interface WorkflowGenerationSpec {
  specVersion: 1
  description?: string
  blocks: SpecBlockRule[]
  tools?: SpecToolRule[]
  toolCommon?: Record<string, unknown>
  connectors?: {
    conditionToWhen?: boolean
    approval?: { set?: Record<string, unknown> }
  }
  defaults?: {
    triggers?: Array<Record<string, unknown>>
    inputs?: Record<string, unknown>
    outputs?: Record<string, unknown>
    state?: Record<string, unknown>
    limits?: Record<string, number>
    endOutput?: string
    expressionRoots?: string[]
    knowledgeTopK?: number
  }
}

export interface PublishedGenerationSpec {
  /** 0 is the built-in default. */
  version: number
  status: 'published' | 'default'
  document: WorkflowGenerationSpec
}
