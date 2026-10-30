/**
 * Admin sign-in for the dashboard: the API's accounts and tokens (`/api/v1/auth/*`), kept in this app's
 * storage. Pages that need an admin show the sign-in form when the API answers 401 or 403.
 */

const ACCESS = 'eleven-nodes-admin-dashboard-access'
const REFRESH = 'eleven-nodes-admin-dashboard-refresh'
export const AUTH_CHANGED = 'eleven-nodes-admin-dashboard-auth'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Without storage the admin signs in again on reload
  }
}

export function signedIn(): boolean {
  return Boolean(read(ACCESS) || read(REFRESH))
}

export function withToken(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers)
  const token = read(ACCESS)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

function store(tokens: { accessToken?: string; refreshToken?: string }): void {
  write(ACCESS, tokens.accessToken ?? null)
  if (tokens.refreshToken) write(REFRESH, tokens.refreshToken)
}

let refreshing: Promise<boolean> | null = null

/** A new access token from the refresh token, once at a time. */
export function refresh(): Promise<boolean> {
  const token = read(REFRESH)
  if (!token) return Promise.resolve(false)
  refreshing ??= fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  })
    .then(async (response) => {
      if (!response.ok) return false
      store(await response.json())
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function signIn(email: string, password: string): Promise<void> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: email.trim().toLowerCase(), password }),
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'Wrong email or password.' : `Sign-in failed (${response.status}).`)
  store(await response.json())
  const me = await fetch('/api/v1/auth/me', withToken())
  const body = me.ok ? ((await me.json()) as { account?: { accessRole?: string } }) : {}
  if (body.account?.accessRole !== 'admin') {
    signOut()
    throw new Error('This account is not an admin.')
  }
  window.dispatchEvent(new Event(AUTH_CHANGED))
}

export function signOut(): void {
  write(ACCESS, null)
  write(REFRESH, null)
  window.dispatchEvent(new Event(AUTH_CHANGED))
}
