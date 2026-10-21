import { authorizedFetch } from '@/services/api-auth'

export interface LocalModel {
  name: string
  size?: number | null
  parameterSize?: string | null
  family?: string | null
}

/** List the models installed on an Ollama server, as seen by the API server. */
export async function fetchOllamaModels(baseUrl: string): Promise<LocalModel[]> {
  const query = baseUrl.trim() ? `?baseUrl=${encodeURIComponent(baseUrl.trim())}` : ''
  const response = await authorizedFetch(`/api/v1/models/ollama${query}`)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Could not load models (${response.status})`)
  }
  const body = (await response.json()) as { models?: LocalModel[] }
  return Array.isArray(body.models) ? body.models : []
}
