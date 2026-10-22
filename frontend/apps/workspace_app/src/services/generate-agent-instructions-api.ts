const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface GenerateInstructionsRequest {
  agentName: string
  description: string
}

export interface GenerateInstructionsResponse {
  instructions: string
  model: string
  source: 'openai' | 'template' | string
}

/** Ask the backend to draft agent instructions from name + description. */
export async function generateAgentInstructions(
  request: GenerateInstructionsRequest,
): Promise<GenerateInstructionsResponse> {
  const response = await fetch(`${API_BASE}/api/workflows/generate-instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_name: request.agentName,
      description: request.description,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Failed to generate instructions (${response.status})`)
  }

  const body = (await response.json()) as {
    instructions: string
    model: string
    source: string
  }

  return {
    instructions: body.instructions,
    model: body.model,
    source: body.source,
  }
}
