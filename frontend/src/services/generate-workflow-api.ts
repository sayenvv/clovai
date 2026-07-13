import type { GenerateWorkflowResponse, WorkflowGenerationPlan } from '@/types/workflow-generation'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface GenerateWorkflowRequest {
  prompt: string
  workflowName?: string
}

function mapPlan(body: {
  workflow_name: string
  description: string
  execution_type: string
  agents: Array<{
    key: string
    name: string
    description: string
    palette_id: string
    instructions: string
    tools: string[]
    x?: number
    y?: number
  }>
  edges: Array<{
    from_key: string
    to_key: string
    label: string
    human_approval: boolean
  }>
}): WorkflowGenerationPlan {
  return {
    workflowName: body.workflow_name,
    description: body.description,
    executionType: body.execution_type as WorkflowGenerationPlan['executionType'],
    agents: body.agents.map((agent) => ({
      key: agent.key,
      name: agent.name,
      description: agent.description,
      paletteId: agent.palette_id,
      instructions: agent.instructions,
      tools: agent.tools ?? [],
      ...(typeof agent.x === 'number' && typeof agent.y === 'number'
        ? { x: agent.x, y: agent.y }
        : {}),
    })),
    edges: body.edges.map((edge) => ({
      fromKey: edge.from_key,
      toKey: edge.to_key,
      label: edge.label ?? '',
      humanApproval: edge.human_approval ?? false,
    })),
  }
}

/** Ask the backend to draft a complete workflow plan from a natural-language prompt. */
export async function generateWorkflowFromPrompt(
  request: GenerateWorkflowRequest,
): Promise<GenerateWorkflowResponse> {
  const response = await fetch(`${API_BASE}/api/workflows/generate-workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: request.prompt,
      workflow_name: request.workflowName ?? '',
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Failed to generate workflow (${response.status})`)
  }

  const body = (await response.json()) as {
    plan: Parameters<typeof mapPlan>[0]
    model: string
    origin: string
  }

  return {
    plan: mapPlan(body.plan),
    model: body.model,
    origin: body.origin,
  }
}
