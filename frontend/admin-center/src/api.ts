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

export function listDocuments(collection: string): Promise<DocumentSummary[]> {
  return request(`/api/v1/admin/${collection}`)
}

export function getDocument(collection: string, id: string): Promise<AdminDocument> {
  return request(`/api/v1/admin/${collection}/${id}`)
}

export function createDocument(
  collection: string,
  body: { name: string; document: unknown; is_active?: boolean },
): Promise<AdminDocument> {
  return request(`/api/v1/admin/${collection}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateDocument(
  collection: string,
  id: string,
  body: { name?: string; document?: unknown; is_active?: boolean },
): Promise<AdminDocument> {
  return request(`/api/v1/admin/${collection}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function deleteDocument(collection: string, id: string): Promise<void> {
  return request(`/api/v1/admin/${collection}/${id}`, { method: 'DELETE' })
}
