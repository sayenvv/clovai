/**
 * The shared chat assistant: the one workflow an admin publishes with purpose `ai_assistant`.
 * Everyone's chat runs it; the admin keeps editing it on their own canvas, and each save updates it.
 */
import { authorizedFetch } from '@/services/api-auth'
import { errorMessage } from '@/services/orchestration-api'

export type WorkflowPurpose = 'ai_assistant' | 'user_build'
export type AccessRole = 'user' | 'admin'

export interface PublishedAssistant {
  workflowId: string
  name: string
}

/** The published assistant, or null when no workflow is published yet. */
export async function fetchAssistant(): Promise<PublishedAssistant | null> {
  const response = await authorizedFetch('/api/v1/assistant')
  if (response.status === 404) return null
  if (!response.ok) throw new Error(await errorMessage(response))
  return (await response.json()) as PublishedAssistant
}

/** Admins only: publish a saved workflow as the assistant (`ai_assistant`), or take it back (`user_build`). */
export async function setWorkflowPurpose(workflowId: string, purpose: WorkflowPurpose): Promise<void> {
  const response = await authorizedFetch(`/api/v1/workflows/${encodeURIComponent(workflowId)}/purpose`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
}

/**
 * A stored workflow's JSON by workflow id: the saved copy, or else the admin-published definition
 * (an admin opening a workflow another account saved, such as the assistant).
 */
export async function fetchWorkflowDefinition(workflowId: string): Promise<{ name: string; definition: Record<string, unknown> }> {
  const id = encodeURIComponent(workflowId)
  const saved = await authorizedFetch(`/api/v1/workflows/${id}`)
  if (saved.ok) {
    const row = (await saved.json()) as { name?: string; definition?: Record<string, unknown> | null }
    if (row.definition) return { name: row.name || 'Workflow', definition: row.definition }
  }
  const published = await authorizedFetch(`/api/v1/admin/definitions/workflows/${id}`)
  if (!published.ok) throw new Error(await errorMessage(published))
  const row = (await published.json()) as { name?: string; definition: Record<string, unknown> }
  return { name: row.name || 'Workflow', definition: row.definition }
}

/** What the signed-in account may do; "user" when it cannot be read. */
export async function fetchAccessRole(): Promise<AccessRole> {
  try {
    const response = await authorizedFetch('/api/v1/auth/me')
    if (!response.ok) return 'user'
    const body = (await response.json()) as { account?: { accessRole?: string } }
    return body.account?.accessRole === 'admin' ? 'admin' : 'user'
  } catch {
    return 'user'
  }
}
