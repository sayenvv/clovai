import { authorizedFetch } from '@/services/api-auth'
import { getSession } from '@/services/project-auth-store'

export interface OrchestrationIdentity {
  workspaceId: string
  tabId: string
  userId: string
}

export interface ExecutionStepDetail {
  id?: string
  message?: string
  status?: string
  complete?: boolean
  mark?: string
  detail?: string
}

export interface ExecutionLogEvent {
  event: string
  status?: string
  message?: string
  agentId?: string
  agent?: string
  /** True when `message` is a streamed piece of the agent's open turn. */
  delta?: boolean
  kind?: 'reasoning'
  title?: string
  steps?: ExecutionStepDetail[]
  result?: {
    execution?: {
      outputs?: unknown
    }
  }
}

let integrationIdPromise: Promise<string> | null = null

async function aiIntegrationId(): Promise<string> {
  const configured = (import.meta.env.VITE_AI_INTEGRATION_ID as string | undefined)?.trim()
  if (configured) return configured
  if (!integrationIdPromise) {
    integrationIdPromise = loadAiIntegrationId().catch((error: unknown) => {
      integrationIdPromise = null
      throw error
    })
  }
  return integrationIdPromise
}

async function loadAiIntegrationId(): Promise<string> {
  const response = await authorizedFetch('/api/v1/applications')
  if (!response.ok) throw new Error(await errorMessage(response))
  const rows = (await response.json()) as Array<{ ai_integration_id?: unknown }>
  const id = rows.find((row) => typeof row.ai_integration_id === 'string')?.ai_integration_id
  if (typeof id !== 'string' || !id) {
    throw new Error('No AI integration is configured for this workspace.')
  }
  return id
}

function tracingHeaders(aiIntegrationId: string): Record<string, string> {
  const requestId = crypto.randomUUID()
  return {
    'X-Request-Id': requestId,
    'X-Correlation-Id': requestId,
    'X-AI-Integration-Id': aiIntegrationId,
  }
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
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.identity.workspaceId,
      tabId: input.identity.tabId,
      userId: input.identity.userId,
      name: input.name ?? '',
      document: input.document,
    }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  const body = (await response.json()) as { id: string }
  return body
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
      ...(await tracingHeaders(await aiIntegrationId())),
    },
    body: JSON.stringify({
      workspaceId: input.identity.workspaceId,
      tabId: input.identity.tabId,
      inputs: input.inputs ?? {},
      events: true,
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
