/**
 * Admin Center sign-in: the same accounts and tokens as the API (`/api/v1/auth/*`), kept in this
 * app's storage. Only accounts whose access role is "admin" may use the Admin Center.
 */
import { STORAGE_KEYS } from '@/constants'

export interface AdminAccount {
  id: string
  email: string
  fullName: string
  accessRole: string
}

let refreshInFlight: Promise<boolean> | null = null

/** `fetch` with the access token, refreshing it once after a 401. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(path, withToken(init))
  if (response.status !== 401) return response
  if (!(await refresh())) {
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    return response
  }
  return fetch(path, withToken(init))
}

/** Fired when the session ends (signed out, or the tokens can no longer be refreshed). */
export const SIGNED_OUT_EVENT = 'eleven-nodes-admin-signed-out'

export async function signIn(email: string, password: string): Promise<AdminAccount> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: email.trim().toLowerCase(), password }),
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'Wrong email or password.' : `Sign-in failed (${response.status}).`)
  storeTokens(await response.json())
  const account = await currentAccount()
  if (!account) throw new Error('Could not read the account.')
  if (account.accessRole !== 'admin') {
    signOut()
    throw new Error('This account is not an admin. Ask an admin to grant access.')
  }
  return account
}

/** The signed-in account, or null when there is no valid session. */
export async function currentAccount(): Promise<AdminAccount | null> {
  if (!read(STORAGE_KEYS.accessToken) && !read(STORAGE_KEYS.refreshToken)) return null
  const response = await apiFetch('/api/v1/auth/me')
  if (!response.ok) return null
  const body = (await response.json()) as { account?: Partial<AdminAccount> }
  const account = body.account
  if (!account?.id) return null
  return { id: account.id, email: account.email ?? account.id, fullName: account.fullName ?? '', accessRole: account.accessRole ?? 'user' }
}

export function signOut(): void {
  remove(STORAGE_KEYS.accessToken)
  remove(STORAGE_KEYS.refreshToken)
  window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
}

function withToken(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers)
  const token = read(STORAGE_KEYS.accessToken)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

function refresh(): Promise<boolean> {
  const refreshToken = read(STORAGE_KEYS.refreshToken)
  if (!refreshToken) return Promise.resolve(false)
  refreshInFlight ??= fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) return false
      storeTokens(await response.json())
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

function storeTokens(payload: { access_token?: unknown; refresh_token?: unknown }): void {
  if (typeof payload.access_token === 'string') write(STORAGE_KEYS.accessToken, payload.access_token)
  if (typeof payload.refresh_token === 'string') write(STORAGE_KEYS.refreshToken, payload.refresh_token)
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage blocked: the session lasts until reload */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing stored */
  }
}
