/** Admin API for stored workflow, agent, tool and middleware definitions. */

export type DefinitionKind = 'workflows' | 'agents' | 'tools' | 'middlewares'
export type WorkflowType = 'system_generated' | 'user_generated'

export interface DefinitionSummary {
  id: string
  name: string
  description: string
  workflowType: WorkflowType
  userId: string | null
  workspaceId: string | null
  tabId: string | null
  purpose: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface DefinitionDetail extends DefinitionSummary {
  definition: Record<string, unknown>
}

const BASE = '/api/v1/admin/definitions'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
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

export function listDefinitions(kind: DefinitionKind, workflowType?: WorkflowType): Promise<DefinitionDetail[]> {
  const query = workflowType ? `?workflowType=${workflowType}` : ''
  return request(`${BASE}/${kind}${query}`)
}

export function getDefinition(kind: DefinitionKind, id: string): Promise<DefinitionDetail> {
  return request(`${BASE}/${kind}/${encodeURIComponent(id)}`)
}

export function createDefinition(kind: DefinitionKind, definition: Record<string, unknown>): Promise<DefinitionDetail> {
  return request(`${BASE}/${kind}`, { method: 'POST', body: JSON.stringify({ definition }) })
}

export function saveDefinition(
  kind: DefinitionKind,
  id: string,
  definition: Record<string, unknown>,
): Promise<DefinitionDetail> {
  return request(`${BASE}/${kind}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ definition }),
  })
}

export function deleteDefinition(kind: DefinitionKind, id: string): Promise<void> {
  return request(`${BASE}/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
