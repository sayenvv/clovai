import { authorizedFetch } from '@/services/api-auth'
import { getSession } from '@/services/project-auth-store'

export interface OrchestrationIdentity {
  /** The tab's own workflow id (a UUID): the saved row's key. */
  workflowId: string
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
  /** What the stage is doing while it runs, such as "Designing". */
  activity?: string
  /** `usage` events: one model call's token counts. */
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  /** `usage` events from the workflow chat: the request's total so far. */
  runTotalTokens?: number
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

/** Tracing and application headers for routes that run on the application's model. */
export async function orchestrationHeaders(): Promise<Record<string, string>> {
  return tracingHeaders(await aiIntegrationId())
}

export function orchestrationIdentity(tabId: string, workflowId: string): OrchestrationIdentity {
  const session = getSession()
  if (!session) {
    throw new Error('Sign in before using the workflow API.')
  }
  return {
    workflowId,
    workspaceId: session.workspaceId,
    tabId,
    userId: session.accountId,
  }
}

export async function errorMessage(response: Response): Promise<string> {
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
  /** The Code tab's workflow JSON, saved in the row's `definition` column. */
  definition?: Record<string, unknown>
}): Promise<{ id: string }> {
  const response = await authorizedFetch('/api/v1/workflows', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflowId: input.identity.workflowId,
      userId: input.identity.userId,
      name: input.name ?? '',
      document: input.document,
      ...(input.definition ? { definition: input.definition } : {}),
    }),
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  const body = (await response.json()) as { id: string }
  return body
}

