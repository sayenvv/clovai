export interface FlowchartGenerationNode {
  key: string
  label: string
  paletteId: string
}

export interface FlowchartGenerationEdge {
  fromKey: string
  toKey: string
  label: string
}

export interface FlowchartGenerationPlan {
  title: string
  summary: string
  nodes: FlowchartGenerationNode[]
  edges: FlowchartGenerationEdge[]
}

export interface GenerateFlowchartResponse {
  plan: FlowchartGenerationPlan
  reply: string
  model: string
  origin: string
}

export interface FlowchartChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}
