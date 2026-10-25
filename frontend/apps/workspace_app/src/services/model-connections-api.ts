/**
 * Saved model connections: models a user brings themselves (their own endpoint, key and model),
 * stored on the server and offered to agents next to the admin's model catalog.
 *
 * API contract (the server stores the API key encrypted and never returns it):
 *
 *   GET    /api/v1/models/connections              → { connections: ModelConnection[] }
 *   POST   /api/v1/models/connections              body ModelConnectionInput (apiKey required)
 *                                                  → ModelConnection
 *   PUT    /api/v1/models/connections/{id}         body ModelConnectionInput (apiKey omitted or
 *                                                  empty keeps the stored key) → ModelConnection
 *   DELETE /api/v1/models/connections/{id}         → 204
 *   POST   /api/v1/models/connections/test         body ModelConnectionInput, or { id } to test a
 *                                                  saved one → { ok: boolean, message: string }
 *
 * Connections are the signed-in user's own (`scope: "user"`); the admin's model clients for the
 * application are listed too (`scope: "application"`), read-only. Instead of a pasted key and a
 * literal endpoint, `apiKeyVariable` and `endpointVariable` can name variables (see variables-api.ts)
 * that the server resolves at run time: the user's variable first, then the application's. At run time an agent points at a connection by `connectionId`; the server
 * builds that agent's chat client from the stored settings and key.
 */

import { authorizedFetch } from '@/services/api-auth'
import { orchestrationHeaders } from '@/services/orchestration-api'

export type ModelConnectionProvider =
  | 'openai'
  | 'azure-openai'
  | 'anthropic'
  | 'gemini'
  | 'mistral'
  | 'groq'
  | 'ollama'
  | 'openai-compatible'

/** `user`: the user's own; `application`: the admin's, offered to every user read-only. */
export type ModelConnectionScope = 'user' | 'workspace' | 'application'

export interface ModelConnection {
  id: string
  name: string
  providerType: ModelConnectionProvider
  /** Base URL, e.g. https://my-gateway.example.com/v1. Empty for the provider's public API. */
  endpoint: string
  /** The endpoint comes from this variable instead of `endpoint`. */
  endpointVariable?: string | null
  /** Model name, or the deployment name for Azure OpenAI. */
  model: string
  /** Azure OpenAI only. */
  apiVersion?: string | null
  /** A key is stored for this connection (the key itself is never returned). */
  hasApiKey: boolean
  /** The key comes from this environment variable instead of a stored key. */
  apiKeyVariable?: string | null
  /** modelConfig options the model rejects, such as `temperature` on reasoning models. */
  unsupportedOptions?: string[]
  scope: ModelConnectionScope
  createdAt: string
  updatedAt: string
}

export interface ModelConnectionInput {
  name: string
  providerType: ModelConnectionProvider
  endpoint: string
  model: string
  apiVersion?: string | null
  /** Write-only. Required on create; leave empty on update to keep the stored key. */
  apiKey?: string
  /** Name of an environment variable holding the key; when set, `apiKey` is not sent. */
  apiKeyVariable?: string | null
  /** Name of a variable holding the endpoint; when set, `endpoint` is not used. */
  endpointVariable?: string | null
  scope: ModelConnectionScope
}

export interface ModelConnectionTestResult {
  ok: boolean
  message: string
}

/** Raised when the server has no connections API yet (404 / 501). */
export class ConnectionsUnavailableError extends Error {
  constructor() {
    super('Saved model connections aren’t available on this server yet.')
    this.name = 'ConnectionsUnavailableError'
  }
}

const BASE = '/api/v1/models/connections'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await orchestrationHeaders()), ...(init?.headers ?? {}) },
  })
  if (response.status === 404 || response.status === 501) throw new ConnectionsUnavailableError()
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function listModelConnections(): Promise<ModelConnection[]> {
  const body = await request<{ connections?: ModelConnection[] }>('')
  return Array.isArray(body.connections) ? body.connections : []
}

export function createModelConnection(input: ModelConnectionInput): Promise<ModelConnection> {
  return request<ModelConnection>('', { method: 'POST', body: JSON.stringify(input) })
}

export function updateModelConnection(id: string, input: ModelConnectionInput): Promise<ModelConnection> {
  const { apiKey, ...rest } = input
  // An empty key means "keep the stored one".
  const body = apiKey?.trim() ? { ...rest, apiKey } : rest
  return request<ModelConnection>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function deleteModelConnection(id: string): Promise<void> {
  return request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function testModelConnection(input: ModelConnectionInput | { id: string }): Promise<ModelConnectionTestResult> {
  return request<ModelConnectionTestResult>('/test', { method: 'POST', body: JSON.stringify(input) })
}

/** How the library refers to a saved model client when it is picked or dragged onto an agent. */
export const MODEL_CLIENT_REF_PREFIX = 'client:'

export function modelClientRef(id: string): string {
  return `${MODEL_CLIENT_REF_PREFIX}${id}`
}
