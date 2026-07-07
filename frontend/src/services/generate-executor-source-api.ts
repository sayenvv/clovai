const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface GenerateExecutorSourceRequest {
  executorName: string
  description: string
  handlerKind: 'class' | 'function'
  executorId: string
  inputType: string
  outputType: string
}

export interface GenerateExecutorSourceResponse {
  source: string
  model: string
  origin: 'openai' | 'template' | string
}

/** Ask the backend to draft Python executor handler source. */
export async function generateExecutorSource(
  request: GenerateExecutorSourceRequest,
): Promise<GenerateExecutorSourceResponse> {
  const response = await fetch(`${API_BASE}/api/workflows/generate-executor-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executor_name: request.executorName,
      description: request.description,
      handler_kind: request.handlerKind,
      executor_id: request.executorId,
      input_type: request.inputType,
      output_type: request.outputType,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `Failed to generate handler source (${response.status})`)
  }

  const body = (await response.json()) as {
    source: string
    model: string
    origin: string
  }

  return {
    source: body.source,
    model: body.model,
    origin: body.origin,
  }
}
