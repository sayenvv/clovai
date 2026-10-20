export type DocumentSummary = {
  id: string
  kind: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AdminDocument = DocumentSummary & {
  document: unknown
}

export type Application = {
  ai_integration_id: string
  name: string
  location: string
}

export type VariableRow = {
  id: string
  ai_integration_id: string
  name: string
  value: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let detail = `${response.status}`
    try {
      const body = await response.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      detail = response.statusText || detail
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

export function createApplication(body: {
  name: string
  location: string
}): Promise<Application> {
  return request('/api/v1/applications', { method: 'POST', body: JSON.stringify(body) })
}

export function listDocuments(collection: string, aiIntegrationId: string): Promise<DocumentSummary[]> {
  return request(withApplication(`/api/v1/admin/${collection}`, aiIntegrationId))
}

export function getDocument(collection: string, id: string, aiIntegrationId: string): Promise<AdminDocument> {
  return request(withApplication(`/api/v1/admin/${collection}/${id}`, aiIntegrationId))
}

export function createDocument(
  collection: string,
  aiIntegrationId: string,
  body: { name: string; document: unknown; is_active?: boolean },
): Promise<AdminDocument> {
  return request(withApplication(`/api/v1/admin/${collection}`, aiIntegrationId), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateDocument(
  collection: string,
  id: string,
  aiIntegrationId: string,
  body: { name?: string; document?: unknown; is_active?: boolean },
): Promise<AdminDocument> {
  return request(withApplication(`/api/v1/admin/${collection}/${id}`, aiIntegrationId), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function deleteDocument(collection: string, id: string, aiIntegrationId: string): Promise<void> {
  return request(withApplication(`/api/v1/admin/${collection}/${id}`, aiIntegrationId), {
    method: 'DELETE',
  })
}

export function listVariables(aiIntegrationId: string): Promise<VariableRow[]> {
  return request(withApplication('/api/v1/variables', aiIntegrationId))
}

export function replaceVariables(
  aiIntegrationId: string,
  variables: { name: string; value: string }[],
): Promise<VariableRow[]> {
  return request(withApplication('/api/v1/variables', aiIntegrationId), {
    method: 'PUT',
    body: JSON.stringify({ variables }),
  })
}
