export type WorkflowGenerationExecutionType =
  | 'sequential'
  | 'parallel'
  | 'human-in-the-loop'
  | 'conditional'
  | 'group-chat'
  | 'dependency'

export interface GeneratedWorkflowAgent {
  key: string
  name: string
  description: string
  paletteId: string
  instructions: string
  tools: string[]
  /** Optional canvas position from the LLM / template. */
  x?: number
  y?: number
}

export interface GeneratedWorkflowEdge {
  fromKey: string
  toKey: string
  label: string
  humanApproval: boolean
}

export interface WorkflowGenerationPlan {
  workflowName: string
  description: string
  executionType: WorkflowGenerationExecutionType
  agents: GeneratedWorkflowAgent[]
  edges: GeneratedWorkflowEdge[]
}

export interface GenerateWorkflowResponse {
  /** Null when the request was a question answered directly; `reply` holds the answer. */
  plan: WorkflowGenerationPlan | null
  reply?: string
  /** The assistant's short account of what it built or changed. */
  summary?: string
  /** What the assistant says it did: "create", "update" or "answer". Comes from the backend only. */
  mode?: string
  /** Tokens the whole request used, as the provider reported them. */
  tokens?: number
  model: string
  origin: string
}
