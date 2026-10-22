/** Admin API for applications and their config and template documents. */

export type DocumentCollection = 'configs' | 'templates'

export interface DocumentSummary {
  id: string
  kind: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdminDocument extends DocumentSummary {
  ai_integration_id: string
  document: unknown
}

export interface Application {
  ai_integration_id: string
  name: string
  location: string
}

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

function withApplication(path: string, aiIntegrationId: string): string {
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}ai_integration_id=${encodeURIComponent(aiIntegrationId)}`
}

export function listApplications(): Promise<Application[]> {
  return request('/api/v1/applications')
}

export function createApplication(body: { name: string; location: string }): Promise<Application> {
  return request('/api/v1/applications', { method: 'POST', body: JSON.stringify(body) })
}

export function listDocuments(collection: DocumentCollection, aiIntegrationId: string): Promise<DocumentSummary[]> {
  return request(withApplication(`/api/v1/admin/${collection}`, aiIntegrationId))
}

export function getDocument(collection: DocumentCollection, id: string, aiIntegrationId: string): Promise<AdminDocument> {
  return request(withApplication(`/api/v1/admin/${collection}/${id}`, aiIntegrationId))
}

export function createDocument(
  collection: DocumentCollection,
  aiIntegrationId: string,
  body: { name: string; document: unknown; is_active?: boolean },
): Promise<AdminDocument> {
  return request(withApplication(`/api/v1/admin/${collection}`, aiIntegrationId), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateDocument(
  collection: DocumentCollection,
  id: string,
  aiIntegrationId: string,
  body: { name?: string; document?: unknown; is_active?: boolean },
): Promise<AdminDocument> {
  return request(withApplication(`/api/v1/admin/${collection}/${id}`, aiIntegrationId), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function deleteDocument(collection: DocumentCollection, id: string, aiIntegrationId: string): Promise<void> {
  return request(withApplication(`/api/v1/admin/${collection}/${id}`, aiIntegrationId), { method: 'DELETE' })
}

/** The active saved config (or the first one) for an application. */
export async function loadActiveConfig(aiIntegrationId: string): Promise<AdminDocument> {
  const rows = await listDocuments('configs', aiIntegrationId)
  const active = rows.find((row) => row.is_active) ?? rows[0]
  if (!active) throw new Error('No configuration is saved for this application.')
  return getDocument('configs', active.id, aiIntegrationId)
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

/** Replace one top-level section of a saved config, keeping the rest. */
export function saveConfigSection(current: AdminDocument, section: string, value: unknown): Promise<AdminDocument> {
  const document = { ...asRecord(current.document), [section]: value }
  return updateDocument('configs', current.id, current.ai_integration_id, { document })
}

export function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback
}
