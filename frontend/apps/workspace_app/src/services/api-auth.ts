import { STORAGE_KEYS } from '@/constants'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000'

let refreshInFlight: Promise<boolean> | null = null
/** Set in localStorage on sign-out, so every open tab hears it (a `storage` event) and drops its own copy. */
const SIGNED_OUT_KEY = 'eleven-nodes-signed-out'
/** Fired in every tab when the user signs out (in this tab or another). */
export const SIGNED_OUT_EVENT = 'eleven-nodes-signed-out-event'
/** Bumped on every sign-out: a refresh or session check that began before it is ignored when it finishes. */
let signOutCount = 0

export function signOutGeneration(): number {
  return signOutCount
}

// Another tab signed out: this tab's copy of the tokens (its sessionStorage) goes too, so it cannot refresh them
// back into localStorage and sign every tab in again
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== SIGNED_OUT_KEY || !event.newValue) return
    signOutCount += 1
    removeStorage(STORAGE_KEYS.accessToken)
    removeStorage(STORAGE_KEYS.refreshToken)
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
  })
}

export function authHeaders(): Record<string, string> {
  const token = readStorage(STORAGE_KEYS.accessToken)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function storeAuthTokens(payload: { access_token?: unknown; refresh_token?: unknown }) {
  if (typeof payload.access_token === 'string' && payload.access_token) {
    writeStorage(STORAGE_KEYS.accessToken, payload.access_token)
  }
  if (typeof payload.refresh_token === 'string' && payload.refresh_token) {
    writeStorage(STORAGE_KEYS.refreshToken, payload.refresh_token)
  }
}

export function clearAuthTokens() {
  removeStorage(STORAGE_KEYS.accessToken)
  removeStorage(STORAGE_KEYS.refreshToken)
}

/** Sign out everywhere: forget the tokens here, tell the other tabs, and void requests still in flight. */
export function signOutAllTabs() {
  signOutCount += 1
  clearAuthTokens()
  try {
    localStorage.setItem(SIGNED_OUT_KEY, String(Date.now()))
  } catch {
    // private mode: only this tab signs out
  }
}

/** Call the API with the current access token, refreshing it once after a 401. */
export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!readStorage(STORAGE_KEYS.accessToken)) {
    await refreshAccessToken()
  }
  const response = await fetch(`${API_BASE}${path}`, withAuth(init))
  if (response.status !== 401 || isCredentialRequest(path)) return response
  const refreshed = await refreshAccessToken()
  if (!refreshed) return response
  return fetch(`${API_BASE}${path}`, withAuth(init))
}

function withAuth(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers)
  const token = readStorage(STORAGE_KEYS.accessToken)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return { ...init, headers }
}

function isCredentialRequest(path: string): boolean {
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/register') ||
    path.includes('/auth/google') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/reset-password')
  )
}

function refreshAccessToken(): Promise<boolean> {
  if (!readStorage(STORAGE_KEYS.refreshToken)) return Promise.resolve(false)
  if (!refreshInFlight) {
    refreshInFlight = requestRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function requestRefresh(): Promise<boolean> {
  const refreshToken = readStorage(STORAGE_KEYS.refreshToken)
  if (!refreshToken) return false
  const generation = signOutCount
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
  } catch {
    return false
  }
  if (!response.ok) {
    clearAuthTokens()
    return false
  }
  const payload = (await response.json().catch(() => null)) as {
    access_token?: unknown
    refresh_token?: unknown
  } | null
  if (!payload || typeof payload.access_token !== 'string') {
    clearAuthTokens()
    return false
  }
  // Signed out while this refresh was on its way: its tokens must not sign the user back in
  if (generation !== signOutCount) return false
  storeAuthTokens(payload)
  return true
}

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    sessionStorage.setItem(key, value)
  } catch {
    // private mode
  }
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  } catch {
    // private mode
  }
}
