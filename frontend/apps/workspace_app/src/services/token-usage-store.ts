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
let cached: { key: string; value: TokenUsageSnapshot | null } = { key: '', value: null }

/**
 * Tokens this tab's running requests used that the server has not charged yet, one meter per run: the server
 * charges a run when it ends or pauses, and each run settles only its own meter.
 */
const meters = new Map<number, number>()
let nextMeter = 1
/**
 * The least this tab shows for an account and allowance: what it showed last. The share used never goes back while
 * the allowance is the same (a refresh racing a charge, another tab's write); a new allowance starts afresh.
 */
let floor: { accountId: string; tokenLimit: number; tokensUsed: number } | null = null

function accountId(): string {
  return getSession()?.accountId ?? ''
}

function notify(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** The server's figures for the signed-in account, as last read from `/me` (shared by the tabs). */
function readServerUsage(): { raw: string; value: StoredUsage } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tokenUsage)
    const stored = raw ? (JSON.parse(raw) as StoredUsage) : null
    return raw && stored && stored.accountId === accountId() ? { raw, value: stored } : null
  } catch {
    return null
  }
}

/**
 * The allowance as this tab shows it: the server's figures, plus what this tab's running requests used so far,
 * never below what it showed last for the same allowance, never past the allowance (the server never charges past it).
 */
export function readTokenUsage(): TokenUsageSnapshot | null {
  const server = readServerUsage()
  if (!server) return null
  const base = server.value
  let used = base.tokensUsed + [...meters.values()].reduce((sum, tokens) => sum + tokens, 0)
  if (floor && floor.accountId === base.accountId && floor.tokenLimit === base.tokenLimit) used = Math.max(used, floor.tokensUsed)
  if (base.tokenLimit > 0) used = Math.min(used, Math.max(base.tokenLimit, base.tokensUsed))
  // useSyncExternalStore needs the same object while nothing changed
  const key = `${server.raw}|${used}`
  if (key === cached.key) return cached.value
  floor = { accountId: base.accountId, tokenLimit: base.tokenLimit, tokensUsed: used }
  const value: TokenUsageSnapshot = {
    tokenLimit: base.tokenLimit,
    tokensUsed: used,
    tokensRemaining: Math.max(0, base.tokenLimit - used),
    tokensPerCredit: base.tokensPerCredit,
  }
  cached = { key, value }
  return value
}

/** Keep the server's figures, for example the totals `/me` returned. */
export function writeTokenUsage(snapshot: TokenUsageSnapshot): void {
  const stored: StoredUsage = { ...snapshot, accountId: accountId() }
  try {
    localStorage.setItem(STORAGE_KEYS.tokenUsage, JSON.stringify(stored))
  } catch {
    // Private mode or full storage: the bar simply shows nothing new.
  }
  notify()
}

/** Counts one run's tokens live, ahead of the server's charge; `settle` when the run ends, pauses or fails. */
export interface TokenMeter {
  add: (tokens: number) => void
  settle: () => Promise<void>
}

/** Start counting a run's tokens as its `usage` events arrive. */
export function startTokenMeter(): TokenMeter {
  const id = nextMeter++
  meters.set(id, 0)
  let settled = false
  return {
    add(tokens) {
      if (settled || !Number.isFinite(tokens) || tokens <= 0) return
      meters.set(id, (meters.get(id) ?? 0) + tokens)
      notify()
    },
    settle() {
      if (settled) return Promise.resolve()
      settled = true
      // The server charged this run before it answered: its totals now hold these tokens (the floor bridges the read)
      meters.delete(id)
      return refreshTokenUsage()
    },
  }
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

/**
 * Read `/me` again for the server's figures: after a run (it charged what the run used), credits an admin added,
 * another tab's runs. What this tab's running requests used so far stays on top (their meters).
 */
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
