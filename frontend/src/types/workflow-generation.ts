export type WorkflowGenerationExecutionType =
  | 'sequential'
  | 'parallel'
  | 'human-in-the-loop'
  | 'conditional'

export interface GeneratedWorkflowAgent {
  key: string
  name: string
  description: string
  paletteId: string
  instructions: string
  tools: string[]
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
  plan: WorkflowGenerationPlan
  model: string
  origin: string
}
