import type {
  FlowchartChatHistoryMessage,
  FlowchartGenerationPlan,
  GenerateFlowchartResponse,
} from '@/types/flowchart-generation'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface GenerateFlowchartRequest {
  prompt: string
  diagramName?: string
  history?: FlowchartChatHistoryMessage[]
}

function mapPlan(body: {
  title: string
  summary: string
  nodes: Array<{ key: string; label: string; palette_id: string }>
  edges: Array<{ from_key: string; to_key: string; label: string }>
}): FlowchartGenerationPlan {
  return {
    title: body.title,
    summary: body.summary ?? '',
    nodes: body.nodes.map((node) => ({
      key: node.key,
      label: node.label,
      paletteId: node.palette_id,
    })),
    edges: body.edges.map((edge) => ({
      fromKey: edge.from_key,
      toKey: edge.to_key,
      label: edge.label ?? '',
    })),
  }
}

/** Ask the backend to draft a flowchart plan from a chat prompt. */
export async function generateFlowchartFromPrompt(
  request: GenerateFlowchartRequest,
): Promise<GenerateFlowchartResponse> {
  const response = await fetch(`${API_BASE}/api/diagrams/generate-flowchart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: request.prompt,
      diagram_name: request.diagramName ?? '',
      history: (request.history ?? []).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Failed to generate flowchart (${response.status})`)
  }

  const body = (await response.json()) as {
    plan: Parameters<typeof mapPlan>[0]
    reply: string
    model: string
    origin: string
  }

  return {
    plan: mapPlan(body.plan),
    reply: body.reply,
    model: body.model,
    origin: body.origin,
  }
}
