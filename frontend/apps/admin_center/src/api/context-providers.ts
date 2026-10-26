/** Admin API for the context providers catalog: what agents may use for memory and knowledge. */

import { apiFetch } from '@/api/auth'

export interface ContextProvider {
  id: string
  name: string
  description: string
  /** The code that builds it, `package.module:function`, as for tools. */
  handler: string
  slot: 'memory' | 'knowledge'
  config: Record<string, unknown>
  isActive: boolean
  updatedAt: string | null
}

/** A handler marked `@context_provider` in code, offered as a starting point. */
export interface ContextProviderStarter {
  handler: string
  label: string
  slot: 'memory' | 'knowledge'
  description: string
  /** The handler's settings with their defaults. */
  config: Record<string, unknown>
}

export type ContextProviderWrite = Pick<ContextProvider, 'name' | 'description' | 'handler' | 'slot' | 'config' | 'isActive'>

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`.trim()
    try {
      const body = await response.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep the status text */
    }
    throw new Error(detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const BASE = '/api/v1/admin/context-providers'

export const listContextProviders = () => request<ContextProvider[]>(BASE)
export const listContextProviderStarters = () => request<ContextProviderStarter[]>(`${BASE}/starters`)
export const createContextProvider = (body: ContextProviderWrite) =>
  request<ContextProvider>(BASE, { method: 'POST', body: JSON.stringify(body) })
export const updateContextProvider = (id: string, body: ContextProviderWrite) =>
  request<ContextProvider>(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) })
export const deleteContextProvider = (id: string) => request<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
