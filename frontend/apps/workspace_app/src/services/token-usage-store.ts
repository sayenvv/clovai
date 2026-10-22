import { STORAGE_KEYS } from '@/constants'
import { authorizedFetch } from '@/services/api-auth'
import { getSession } from '@/services/project-auth-store'

/** The signed-in user's token allowance, as the API reports it. */
export interface TokenUsageSnapshot {
  tokenLimit: number
  tokensUsed: number
  tokensRemaining: number
}

interface StoredUsage extends TokenUsageSnapshot {
  accountId: string
}

const CHANGE_EVENT = 'eleven-nodes-token-usage'
let loading: Promise<void> | null = null
let cached: { raw: string | null; value: TokenUsageSnapshot | null } = { raw: null, value: null }

function accountId(): string {
  return getSession()?.accountId ?? ''
}

/**
 * The allowance kept in local storage for the signed-in account.
 *
 * Model runs update it as their `usage` events stream in, and the final
 * result replaces it with the server's figures, so `/me` is only read when
 * nothing is stored yet.
 */
export function readTokenUsage(): TokenUsageSnapshot | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEYS.tokenUsage)
  } catch {
    return null
  }
  // useSyncExternalStore needs the same object while the stored value is unchanged.
  if (raw === cached.raw) return cached.value
  let value: TokenUsageSnapshot | null = null
  try {
    const stored = raw ? (JSON.parse(raw) as StoredUsage) : null
    if (stored && stored.accountId === accountId()) {
      value = { tokenLimit: stored.tokenLimit, tokensUsed: stored.tokensUsed, tokensRemaining: stored.tokensRemaining }
    }
  } catch {
    value = null
  }
  cached = { raw, value }
  return value
}

/** Replace the stored allowance, for example with the totals a finished run returns. */
export function writeTokenUsage(snapshot: TokenUsageSnapshot): void {
  const stored: StoredUsage = { ...snapshot, accountId: accountId() }
  try {
    localStorage.setItem(STORAGE_KEYS.tokenUsage, JSON.stringify(stored))
  } catch {
    // Private mode or full storage: the bar simply shows nothing new.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Count tokens a running request just used, ahead of the server's final totals. */
export function addTokenUsage(tokens: number): void {
  const current = readTokenUsage()
  if (!current || !Number.isFinite(tokens) || tokens <= 0) return
  const tokensUsed = current.tokensUsed + tokens
  writeTokenUsage({ ...current, tokensUsed, tokensRemaining: Math.max(0, current.tokenLimit - tokensUsed) })
}

/** Notify `listener` when the allowance changes here or in another tab. */
export function subscribeTokenUsage(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.tokenUsage) listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Read `/me` once when nothing is stored for this account yet. */
export function ensureTokenUsage(): Promise<void> {
  if (readTokenUsage()) return Promise.resolve()
  if (!loading) {
    loading = authorizedFetch('/api/v1/auth/me')
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as { subscription?: TokenUsageSnapshot }
        if (body.subscription) writeTokenUsage(body.subscription)
      })
      .catch(() => undefined)
      .finally(() => {
        loading = null
      })
  }
  return loading
}
