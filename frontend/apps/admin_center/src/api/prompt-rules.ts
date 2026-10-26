/** Admin API for the rules that complete custom orchestration prompts (e.g. Magentic's manager prompts). */

import { apiFetch } from '@/api/auth'

export interface PromptRule {
  id: string
  pattern: string
  promptKey: string
  description: string
  requiredFields: string[]
  fieldHeadings: Record<string, string>
  requiredSuffix: string
  suffixMarker: string
  isActive: boolean
  updatedAt: string | null
}

export type PromptRuleWrite = Partial<Omit<PromptRule, 'id' | 'pattern' | 'promptKey' | 'updatedAt'>>

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
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

export function listPromptRules(pattern?: string): Promise<PromptRule[]> {
  const query = pattern ? `?pattern=${encodeURIComponent(pattern)}` : ''
  return request(`/api/v1/admin/prompt-rules${query}`)
}

export function savePromptRule(pattern: string, promptKey: string, body: PromptRuleWrite): Promise<PromptRule> {
  return request(`/api/v1/admin/prompt-rules/${encodeURIComponent(pattern)}/${encodeURIComponent(promptKey)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function deletePromptRule(id: string): Promise<void> {
  return request(`/api/v1/admin/prompt-rules/${id}`, { method: 'DELETE' })
}
