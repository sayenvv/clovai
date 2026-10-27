/** Admin API for application logs: warnings and errors the backend recorded, with their tracebacks. */

import { apiFetch } from '@/api/auth'

export type LogLevel = 'WARNING' | 'ERROR' | 'CRITICAL'

export interface SystemLog {
  id: number
  time: string
  level: LogLevel
  logger: string
  message: string
  exception_type: string
  /** Where it was raised: ``app/...py:line in function``. */
  source: string
  /** The same failure from the same place shares one. */
  fingerprint: string
  method: string
  path: string
  status_code: number | null
  request_id: string
  user_id: string
  workflow_id: string
  /** The run's trace, when it happened during a workflow run. */
  trace_id: string
  has_traceback: boolean
}

export interface SystemLogDetail extends SystemLog {
  traceback: string
  extra: Record<string, unknown>
  occurrences: number
}

export interface SystemLogPage {
  items: SystemLog[]
  next_before_id: number | null
}

export interface SystemLogSummary {
  hours: number
  counts: Record<LogLevel, number>
  total: number
  timeline: Array<{ time: string } & Record<LogLevel, number>>
  top_errors: Array<{
    fingerprint: string
    count: number
    first_seen: string
    last_seen: string
    sample: SystemLog | null
  }>
}

async function request<T>(path: string): Promise<T> {
  const response = await apiFetch(path)
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`.trim()
    try {
      const body = await response.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep the status text */
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export interface SystemLogQuery {
  /** The lowest level to show. */
  level?: LogLevel
  q?: string
  hours: number
  fingerprint?: string
  beforeId?: number
}

export function listSystemLogs(query: SystemLogQuery): Promise<SystemLogPage> {
  const params = new URLSearchParams({ hours: String(query.hours), limit: '50' })
  if (query.level) params.set('level', query.level)
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.fingerprint) params.set('fingerprint', query.fingerprint)
  if (query.beforeId) params.set('before_id', String(query.beforeId))
  return request(`/api/v1/admin/system-logs?${params}`)
}

export const getSystemLogSummary = (hours: number) =>
  request<SystemLogSummary>(`/api/v1/admin/system-logs/summary?hours=${hours}`)

export const getSystemLog = (id: number) => request<SystemLogDetail>(`/api/v1/admin/system-logs/${id}`)
