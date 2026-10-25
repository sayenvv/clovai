/**
 * Environment variables: values a user stores once (API keys, credentials, endpoints) and refers to
 * by name from model connections, tools and agents, instead of pasting them into workflows.
 *
 * API contract (secret values are stored encrypted and never returned):
 *
 *   GET    /api/v1/me/variables           → { variables: EnvVariable[] }
 *   POST   /api/v1/me/variables           body EnvVariableInput (value required) → EnvVariable
 *   PUT    /api/v1/me/variables/{id}      body EnvVariableInput (value omitted or empty keeps the
 *                                         stored value) → EnvVariable
 *   DELETE /api/v1/me/variables/{id}      → 204
 *
 * Each variable is a "Manual entry" (`secret: false`, stored as entered) or a "Secret"
 * (`secret: true`, stored encrypted). The admin's application variables live under
 * /api/v1/variables; a model client looks up the user's variable first, then the application's.
 *
 * Names are unique per user, UPPER_SNAKE_CASE. At run time the server resolves a reference such as
 * `apiKeyVariable: "OPENAI_API_KEY"` to the stored value; workflow JSON only ever holds the name.
 */

import { authorizedFetch } from '@/services/api-auth'
import { orchestrationHeaders } from '@/services/orchestration-api'

export type EnvVariableScope = 'user' | 'workspace'

export interface EnvVariable {
  id: string
  /** UPPER_SNAKE_CASE, e.g. OPENAI_API_KEY. */
  name: string
  description: string
  /** `manual` (Manual entry) or `secret`. */
  type?: 'manual' | 'secret'
  /** Secret values are write-only; manual ones come back in `value`. */
  secret: boolean
  /** Present for plain variables only. */
  value?: string | null
  hasValue: boolean
  scope: EnvVariableScope
  createdAt: string
  updatedAt: string
}

export interface EnvVariableInput {
  name: string
  description: string
  secret: boolean
  /** Required on create; leave empty on update to keep the stored value. */
  value?: string
  scope: EnvVariableScope
}

export const VARIABLE_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/

/** Raised when the server has no variables API yet (404 / 501). */
export class VariablesUnavailableError extends Error {
  constructor() {
    super('Environment variables aren’t available on this server yet.')
    this.name = 'VariablesUnavailableError'
  }
}

const BASE = '/api/v1/me/variables'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await orchestrationHeaders()), ...(init?.headers ?? {}) },
  })
  if (response.status === 404 || response.status === 501) throw new VariablesUnavailableError()
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function listVariables(): Promise<EnvVariable[]> {
  const body = await request<{ variables?: EnvVariable[] }>('')
  return Array.isArray(body.variables) ? body.variables : []
}

export function createVariable(input: EnvVariableInput): Promise<EnvVariable> {
  return request<EnvVariable>('', { method: 'POST', body: JSON.stringify(input) })
}

export function updateVariable(id: string, input: EnvVariableInput): Promise<EnvVariable> {
  const { value, ...rest } = input
  // An empty value means "keep the stored one".
  const body = value?.length ? { ...rest, value } : rest
  return request<EnvVariable>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) })
}

export function deleteVariable(id: string): Promise<void> {
  return request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
