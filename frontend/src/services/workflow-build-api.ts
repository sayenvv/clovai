import type { WorkflowBuildSpec } from '@/types/workflow-build-spec'
import { projectIdentityHeaders } from '@/services/api-identity'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface WorkflowBuildApiResponse {
  workspaceId: string
  pageId: string
  workflowId: string
  databaseRecordId: string
  savedAt: string
}

export interface WorkflowExecutionRequest {
  inputs: Record<string, unknown>
  metadata?: Record<string, unknown>
  approvedEdgeIds?: string[]
  raiseOnError?: boolean
}

export interface WorkflowNodeRun {
  agentId: string
  status: string
  output: unknown
  error: string | null
  metadata: Record<string, unknown>
  startedAt: string | null
  completedAt: string | null
}

export interface WorkflowRunResponse {
  runId: string
  workflowId: string
  status: string
  mode: 'test' | 'execute'
  outputs: Record<string, unknown>
  failures: Record<string, string>
  nodes: Record<string, WorkflowNodeRun>
  startedAt: string
  completedAt: string
}

export class WorkflowExecutionApprovalRequiredError extends Error {
  readonly requiredEdgeIds: string[]

  constructor(requiredEdgeIds: string[], message = 'Workflow execution requires human approval') {
    super(message)
    this.name = 'WorkflowExecutionApprovalRequiredError'
    this.requiredEdgeIds = requiredEdgeIds
  }
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text) return `Request failed (${response.status})`
  try {
    const parsed = JSON.parse(text) as { detail?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail
    if (parsed.detail && typeof parsed.detail === 'object') {
      const detail = parsed.detail as { message?: unknown }
      if (typeof detail.message === 'string') return detail.message
    }
  } catch {
    // plain text
  }
  return text
}

/** PUT a build spec to the backend PostgreSQL workflow store. */
export async function saveWorkflowBuildSpecToApi(
  spec: WorkflowBuildSpec,
): Promise<WorkflowBuildApiResponse> {
  const { workspaceId, pageId } = spec.meta
  const response = await fetch(
    `${API_BASE}/api/workflows/${encodeURIComponent(workspaceId)}/pages/${encodeURIComponent(pageId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...projectIdentityHeaders(),
      },
      body: JSON.stringify(spec, null, 2),
    },
  )

  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }

  return response.json() as Promise<WorkflowBuildApiResponse>
}

/** GET a build spec from backend PostgreSQL storage. */
export async function loadWorkflowBuildSpecFromApi(
  workspaceId: string,
  pageId: string,
): Promise<WorkflowBuildSpec | null> {
  const response = await fetch(
    `${API_BASE}/api/workflows/${encodeURIComponent(workspaceId)}/pages/${encodeURIComponent(pageId)}`,
  )
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Failed to load workflow build spec (${response.status})`)
  }
  return response.json() as Promise<WorkflowBuildSpec>
}

/** POST execute — calls the Eleven Nodes workflow runtime on the backend. */
export async function executeWorkflowFromApi(
  workspaceId: string,
  pageId: string,
  request: WorkflowExecutionRequest,
): Promise<WorkflowRunResponse> {
  const response = await fetch(
    `${API_BASE}/api/workflows/${encodeURIComponent(workspaceId)}/pages/${encodeURIComponent(pageId)}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
  )

  if (response.status === 409) {
    const payload = (await response.json().catch(() => null)) as {
      detail?: { message?: string; requiredEdgeIds?: string[] }
    } | null
    const detail = payload?.detail
    if (Array.isArray(detail?.requiredEdgeIds)) {
      throw new WorkflowExecutionApprovalRequiredError(
        detail.requiredEdgeIds,
        detail.message,
      )
    }
  }

  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }

  return response.json() as Promise<WorkflowRunResponse>
}
