import { request } from './api'

export type Allowance = {
  tokenLimit: number
  tokensUsed: number
  tokensRemaining: number
  percentUsed: number
}

export type UserCredits = Allowance & {
  userId: string
  email: string
  fullName: string
  accessRole: string
  periodTokens: number
  periodCalls: number
  periodRuns: number
  lastUsedAt: string | null
}

export type CreditsOverview = {
  days: number
  summary: { users: number; periodTokens: number; nearLimit: number; exhausted: number }
  users: UserCredits[]
}

export type UserCreditDetail = Allowance & {
  userId: string
  email: string
  fullName: string
  accessRole: string
  days: number
  daily: { date: string; tokens: number; calls: number }[]
  sources: { source: string; tokens: number; calls: number }[]
  workflows: { workflow: string; workflowId: string; tokens: number; runs: number }[]
  recentRuns: { runId: string; source: string; workflow: string; tokens: number; calls: number; at: string }[]
}

export function creditsOverview(days: number, query: string): Promise<CreditsOverview> {
  const params = new URLSearchParams({ days: String(days), ...(query.trim() ? { q: query.trim() } : {}) })
  return request(`/api/v1/admin/credit-usage?${params}`)
}

export function userCredits(userId: string, days: number): Promise<UserCreditDetail> {
  return request(`/api/v1/admin/credit-usage/${encodeURIComponent(userId)}?days=${days}`)
}

export function addCredits(userId: string, amount: number): Promise<Allowance & { userId: string }> {
  return request(`/api/v1/admin/credit-usage/${encodeURIComponent(userId)}/credits`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
}

export const formatTokens = (value: number): string =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(1)}k` : String(value)

/** Amber from 90% used, red from 95% (and when nothing is left). */
export function usageTone(allowance: Allowance): 'ok' | 'warn' | 'over' {
  if (allowance.tokenLimit > 0 && allowance.tokensRemaining <= 0) return 'over'
  return allowance.percentUsed >= 95 ? 'over' : allowance.percentUsed >= 90 ? 'warn' : 'ok'
}

export const SOURCE_LABELS: Record<string, string> = {
  assistant: 'AI assistant',
  workflow: 'Workflows',
  execute: 'Classic runs',
}
