import { authorizedFetch } from '@/services/api-auth'
import { orchestrationHeaders } from '@/services/orchestration-api'

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

export interface CatalogModelOption {
  id: string
  label: string
  /** For discovered models, such as "3.2B · llama". */
  detail?: string
  maxTokens?: number
  supportsTools?: boolean
  supportsJsonSchema?: boolean
}

export interface CatalogProvider {
  id: string
  label: string
  type: string
  models: CatalogModelOption[]
  /** Set when a discover provider (Ollama) could not be reached. */
  error?: string
}

export interface ModelCatalog {
  default: { provider?: string; modelId?: string }
  providers: CatalogProvider[]
}

/** The application's model catalog: every provider with its models, and the default. No secrets. */
export async function fetchModelCatalog(): Promise<ModelCatalog> {
  const response = await authorizedFetch('/api/v1/models/catalog', { headers: await orchestrationHeaders() })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Could not load models (${response.status})`)
  }
  return (await response.json()) as ModelCatalog
}
