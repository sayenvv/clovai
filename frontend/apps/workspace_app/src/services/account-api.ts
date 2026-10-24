/**
 * The signed-in user's own account and workspace, edited from Dashboard → Account.
 *
 * API contract:
 *
 *   PATCH  /api/v1/auth/me                 body { fullName, role }        → { account }
 *   PATCH  /api/v1/instances/{workspaceId} body { displayName }           → { instance }
 *   DELETE /api/v1/auth/me                 → 204 (the account, its workspace and saved data)
 *
 * Password changes use the existing POST /api/v1/auth/reset-password.
 */

import { authorizedFetch } from '@/services/api-auth'
import { getSession, logout, setSession, type ProjectRole } from '@/services/project-auth-store'

/** Raised when the server has no endpoint for this yet (404 / 405 / 501). */
export class AccountUnavailableError extends Error {
  constructor() {
    super('This isn’t available on this server yet.')
    this.name = 'AccountUnavailableError'
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await authorizedFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (response.status === 404 || response.status === 405 || response.status === 501) {
    throw new AccountUnavailableError()
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function updateProfile(input: { fullName: string; role: ProjectRole }): Promise<void> {
  await request('/api/v1/auth/me', { method: 'PATCH', body: JSON.stringify(input) })
  const session = getSession()
  if (session) setSession({ ...session, ...input })
}

export async function renameWorkspace(workspaceId: string, displayName: string): Promise<void> {
  await request(`/api/v1/instances/${encodeURIComponent(workspaceId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  })
  const session = getSession()
  if (session) setSession({ ...session, displayName })
}

export async function deleteAccount(): Promise<void> {
  await request('/api/v1/auth/me', { method: 'DELETE' })
  logout()
}
