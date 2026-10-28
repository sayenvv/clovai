/**
 * Admin API for the workflow generation spec: the rules the canvas follows to turn blocks and
 * connectors into workflow format 4.0. Admins edit a draft, validate it and publish it as the next
 * version; the canvas picks up the latest published version within a minute.
 */

import { apiFetch } from '@/api/auth'

export interface SpecIssue {
  path: string
  message: string
}

export interface SpecVersion {
  /** Null for the draft; 0 for the built-in default. */
  version: number | null
  status: 'draft' | 'published' | 'default'
  note?: string
  updatedBy?: string
  updatedAt?: string
  publishedAt?: string | null
  document?: Record<string, unknown>
}

export interface SpecOverview {
  draft: SpecVersion | null
  published: SpecVersion
  versions: SpecVersion[]
}

/** An API failure; `issues` lists what made a spec invalid. */
export class SpecError extends Error {
  constructor(
    message: string,
    readonly issues: SpecIssue[] = [],
  ) {
    super(message)
  }
}

const BASE = '/api/v1/admin/workflow-generation-spec'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (response.status === 204) return undefined as T
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`.trim()
    let issues: SpecIssue[] = []
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (body.detail?.message) {
        message = body.detail.message
        issues = Array.isArray(body.detail.errors) ? body.detail.errors : []
      }
    } catch {
      /* keep the status text */
    }
    throw new SpecError(message, issues)
  }
  return response.json() as Promise<T>
}

export const getSpecOverview = () => request<SpecOverview>('')

export const getDefaultSpec = () => request<SpecVersion>('/default')

export const getSpecVersion = (version: number) => request<SpecVersion>(`/versions/${version}`)

export const validateSpec = (document: Record<string, unknown>) =>
  request<{ valid: boolean; errors: SpecIssue[] }>('/validate', { method: 'POST', body: JSON.stringify({ document }) })

export const saveSpecDraft = (document: Record<string, unknown>, note: string) =>
  request<SpecVersion>('/draft', { method: 'PUT', body: JSON.stringify({ document, note }) })

export const discardSpecDraft = () => request<void>('/draft', { method: 'DELETE' })

export const publishSpecDraft = () => request<SpecVersion>('/publish', { method: 'POST' })
