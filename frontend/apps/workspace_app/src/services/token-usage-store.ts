import { STORAGE_KEYS } from '@/constants'
import { authorizedFetch } from '@/services/api-auth'
import { getSession } from '@/services/project-auth-store'

/** The signed-in user's token allowance, as the API reports it; users see it in credits. */
export interface TokenUsageSnapshot {
  tokenLimit: number
  tokensUsed: number
  tokensRemaining: number
  /** Tokens one credit buys (the server's `TOKENS_PER_CREDIT`). */
  tokensPerCredit?: number
}

/** The rate until the server has sent its own. */
const DEFAULT_TOKENS_PER_CREDIT = 1000

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
      value = {
        tokenLimit: stored.tokenLimit,
        tokensUsed: stored.tokensUsed,
        tokensRemaining: stored.tokensRemaining,
        tokensPerCredit: stored.tokensPerCredit,
      }
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

/** Read `/me` again for the server's totals: after a run (the server charges what it used) or on returning to the tab. */
export function refreshTokenUsage(): Promise<void> {
  if (!getSession()) return Promise.resolve()
  return authorizedFetch('/api/v1/auth/me')
    .then(async (response) => {
      if (!response.ok) return
      const body = (await response.json()) as { subscription?: TokenUsageSnapshot }
      if (body.subscription) writeTokenUsage(body.subscription)
    })
    .catch(() => undefined)
}

export type TokenUsageLevel = 'normal' | 'warning' | 'critical' | 'exhausted'

/** How much of the allowance is used: warning from 90%, critical from 95%, exhausted at 100%. */
export function tokenUsageLevel(snapshot: TokenUsageSnapshot | null): { level: TokenUsageLevel; percent: number } {
  if (!snapshot || snapshot.tokenLimit <= 0) return { level: 'normal', percent: 0 }
  const ratio = Math.min(1, snapshot.tokensUsed / snapshot.tokenLimit)
  const percent = Math.floor(ratio * 100)
  const level = snapshot.tokensRemaining <= 0 ? 'exhausted' : ratio >= 0.95 ? 'critical' : ratio >= 0.9 ? 'warning' : 'normal'
  return { level, percent }
}

/** Credits worth `tokens` at the server's rate. */
export function creditsFor(tokens: number, snapshot: TokenUsageSnapshot | null = readTokenUsage()): number {
  const rate = snapshot?.tokensPerCredit && snapshot.tokensPerCredit > 0 ? snapshot.tokensPerCredit : DEFAULT_TOKENS_PER_CREDIT
  return tokens / rate
}

/** `tokens` as credits for people: "0.4 credits", "12 credits", "1,250 credits"; "<0.1" for a sliver. */
export function formatCredits(tokens: number, snapshot: TokenUsageSnapshot | null = readTokenUsage()): string {
  const credits = creditsFor(Math.max(0, tokens), snapshot)
  if (credits > 0 && credits < 0.1) return '<0.1 credits'
  const shown = credits < 10 ? Number(credits.toFixed(1)) : Math.round(credits)
  return `${shown.toLocaleString()} ${shown === 1 ? 'credit' : 'credits'}`
}
