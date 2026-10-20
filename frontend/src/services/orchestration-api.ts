import { authorizedFetch } from '@/services/api-auth'
import { getSession } from '@/services/project-auth-store'

export interface OrchestrationIdentity {
  workspaceId: string
  tabId: string
  userId: string
}

export interface ExecutionLogEvent {
  event: string
  step?: string
  status?: string
  message?: string
  detail?: unknown
}

export function orchestrationIdentity(tabId: string): OrchestrationIdentity {
  const session = getSession()
  if (!session) {
    throw new Error('Sign in before using the workflow API.')
  }
  return {
    workspaceId: session.workspaceId,
    tabId,
    userId: session.accountId,
  }
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text) return `Request failed (${response.status})`
  try {
    const parsed = JSON.parse(text) as { detail?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((issue) => {
          if (!issue || typeof issue !== 'object') return ''
          const record = issue as { loc?: unknown; msg?: unknown; message?: unknown }
          const message = record.msg ?? record.message
          return typeof message === 'string' ? message : ''
        })
        .filter(Boolean)
        .join('; ')
    }
  } catch {
    // plain text
  }
  return text
}

export async function saveOrchestration(input: {
  identity: OrchestrationIdentity
  name?: string
  description?: string
  document: Record<string, unknown>
}): Promise<{ id: string }> {
  const response = await authorizedFetch('/api/v1/workflows', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.identity.workspaceId,
      tabId: input.identity.tabId,
      userId: input.identity.userId,
      name: input.name ?? '',
      description: input.description ?? '',
      document: input.document,
    }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  const body = (await response.json()) as { id: string }
  return body
}

export async function validateOrchestration(input: {
  identity: OrchestrationIdentity
  inputs?: Record<string, unknown>
  env?: Record<string, unknown>
}): Promise<{ schema_version: string; workflow: Record<string, unknown> }> {
  const response = await authorizedFetch('/api/v1/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.identity.workspaceId,
      tabId: input.identity.tabId,
      userId: input.identity.userId,
      inputs: input.inputs ?? {},
      env: input.env ?? {},
    }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return response.json() as Promise<{ schema_version: string; workflow: Record<string, unknown> }>
}

export async function executeOrchestration(input: {
  identity: OrchestrationIdentity
  inputs?: Record<string, unknown>
  onEvent: (event: ExecutionLogEvent) => void
}): Promise<void> {
  const response = await authorizedFetch('/api/v1/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      workspaceId: input.identity.workspaceId,
      tabId: input.identity.tabId,
      userId: input.identity.userId,
      inputs: input.inputs ?? {},
    }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  if (!response.body) throw new Error('Execution stream is empty.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const eventName = chunk.match(/^event: (.+)$/m)?.[1] ?? 'log'
      const dataLine = chunk
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n')
      if (!dataLine) continue
      const payload = JSON.parse(dataLine) as Omit<ExecutionLogEvent, 'event'>
      input.onEvent({ event: eventName, ...payload })
    }
  }
}
