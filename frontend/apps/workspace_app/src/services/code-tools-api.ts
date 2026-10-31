import { authorizedFetch } from '@/services/api-auth'
import { errorMessage } from '@/services/orchestration-api'

/** A code tool as `/api/v1/code-tools` returns it; `source` only when one tool is read. */
export interface CodeTool {
  id: string
  name: string
  description: string
  language: 'python'
  inputSchema: Record<string, unknown>
  timeoutSeconds: number
  updatedAt: string | null
  source?: string
}

export interface CodeToolWrite {
  name: string
  description: string
  source: string
  /** Left out: derived from `run`'s signature. */
  inputSchema?: Record<string, unknown>
  timeoutSeconds: number
}

/** One sandboxed call: what `run` returned, or the error and the line it was raised on. */
export interface CodeRunResult {
  ok: boolean
  result?: unknown
  error?: string
  line?: number
  logs?: string
  durationMs: number
  timedOut?: boolean
}

export interface SandboxStatus {
  sandbox: 'docker' | 'hyperlight' | 'local' | 'off'
  available: boolean
  reason?: string
  image?: string
  maxTimeoutSeconds: number
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(`/api/v1/code-tools${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return (response.status === 204 ? undefined : await response.json()) as T
}

export const listCodeTools = () => call<CodeTool[]>('')
export const getCodeTool = (id: string) => call<CodeTool>(`/${id}`)
export const sandboxStatus = () => call<SandboxStatus>('/sandbox')

export const saveCodeTool = (tool: CodeToolWrite, id?: string) =>
  call<CodeTool>(id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify(tool) })

/** Run code once in the sandbox, saved or not, with these arguments. */
export const runCode = (source: string, args: Record<string, unknown>, timeoutSeconds: number) =>
  call<CodeRunResult>('/test', { method: 'POST', body: JSON.stringify({ source, arguments: args, timeoutSeconds }) })

/** Check code without running it; resolves to the argument schema derived from `run`. */
export const checkCode = (source: string) =>
  call<{ valid: boolean; inputSchema: Record<string, unknown> }>('/check', { method: 'POST', body: JSON.stringify({ source }) })
