import { authorizedFetch } from '@/services/api-auth'
import { errorMessage, orchestrationHeaders } from '@/services/orchestration-api'
import type { WorkflowAppConfig } from '@/services/workflow-apps-store'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000'

/** A deployed workflow as `/api/v1/deployments` returns it. */
export interface Deployment {
  id: string
  workflowId: string
  name: string
  version: number
  status: 'active' | 'stopped'
  endpoint: string
  method: 'POST'
  auth: 'api-key'
  apiKeyPrefix: string
  createdAt: string | null
  updatedAt: string | null
  /** Only on the first deploy and after a key rotation: shown this once. */
  apiKey?: string
}

/** The settings a deployment's app is saved with (the builder's settings without its own bookkeeping). */
export type AppSettings = Omit<WorkflowAppConfig, 'instanceId' | 'status' | 'publishedAt' | 'updatedAt'>

export interface DeploymentApp {
  config: AppSettings | null
  status: 'draft' | 'published'
  /** What the address serves: the template (chat or form), or the code app built from `projectId`. */
  source?: 'template' | 'code'
  projectId?: string | null
  slug: string | null
  url: string | null
  publishedAt: string | null
}

/** What an outside caller sees of a run. */
export interface PublicRun {
  id: string
  status: string
  output: unknown
  error: string | null
  waitingFor: { kind: string; step: string; question?: string }[]
}

async function call<T>(path: string, init: RequestInit = {}, application = false): Promise<T> {
  const response = await authorizedFetch(`/api/v1/deployments${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(application ? await orchestrationHeaders() : {}), ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return (await response.json()) as T
}

/** Deploy the saved workflow: its current definition becomes the next version, run by the application's models. */
export const deployWorkflow = (workflowId: string) =>
  call<Deployment>('', { method: 'POST', body: JSON.stringify({ workflowId }) }, true)
export const listDeployments = () => call<Deployment[]>('')
export const rotateDeploymentKey = (id: string) => call<Deployment>(`/${id}/key`, { method: 'POST' })
export const getDeploymentApp = (id: string) => call<DeploymentApp>(`/${id}/app`)
export const saveDeploymentApp = (id: string, config: AppSettings) =>
  call<DeploymentApp>(`/${id}/app`, { method: 'PUT', body: JSON.stringify(config) })
export const publishDeploymentApp = (id: string) => call<DeploymentApp>(`/${id}/app/publish`, { method: 'POST' })
/** Build the code-mode project and publish it at the app's address, in place of the template (can take a minute). */
export const publishDeploymentCodeApp = (id: string, projectId: string) =>
  call<DeploymentApp>(`/${id}/app/publish-code`, { method: 'POST', body: JSON.stringify({ projectId }) })

/** Ask the design assistant for a change; the new settings come back unsaved. */
export const designDeploymentApp = (id: string, message: string, config: AppSettings) =>
  call<{ reply: string; config: AppSettings }>(`/${id}/app/design`, { method: 'POST', body: JSON.stringify({ message, config }) }, true)

async function publicCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1/public${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error(await errorMessage(response))
  return (await response.json()) as T
}

/** A published app's settings (no sign-in). */
export const getPublicApp = (workspace: string, slug: string) =>
  publicCall<{ name: string; config: AppSettings; source?: 'template' | 'code' }>(`/apps/${encodeURIComponent(workspace)}/${encodeURIComponent(slug)}`)

/** Where a published code app's built files are served. */
export const publicAppSiteUrl = (workspace: string, slug: string) =>
  `${API_BASE}/api/v1/public/apps/${encodeURIComponent(workspace)}/${encodeURIComponent(slug)}/site/`

/** Run a published app's workflow (no sign-in; limited per visitor). */
export const runPublicApp = (workspace: string, slug: string, inputs: Record<string, unknown>, conversationId?: string) =>
  publicCall<PublicRun>(`/apps/${encodeURIComponent(workspace)}/${encodeURIComponent(slug)}/runs`, {
    method: 'POST',
    body: JSON.stringify({ inputs, ...(conversationId ? { conversationId } : {}) }),
  })
