import { STORAGE_KEYS } from '@/constants'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000'

let refreshInFlight: Promise<boolean> | null = null

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
