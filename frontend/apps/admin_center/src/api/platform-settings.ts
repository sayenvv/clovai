/** Admin API for platform settings (tokens per credit). */

import { apiFetch } from '@/api/auth'

export interface PlatformSettings {
  tokensPerCredit: number
  /** Where each value comes from: set here (`admin`) or the server's environment. */
  sources: { tokensPerCredit: 'admin' | 'environment' }
}

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await apiFetch('/api/v1/admin/platform-settings', {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`.trim()
    try {
      const body = await response.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // not JSON
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export const readPlatformSettings = () => request<PlatformSettings>()

export const savePlatformSettings = (values: { tokensPerCredit: number }) =>
  request<PlatformSettings>({ method: 'PUT', body: JSON.stringify(values) })
