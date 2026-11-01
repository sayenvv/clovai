import { STORAGE_KEYS } from '@/constants'
import type { PublishedWorkflowInstance } from '@/services/published-instances-store'

/** How a deployed workflow's app looks and asks for input. The server keeps it with the deployment; a deploy made
 * before deployments existed on the server keeps it in this browser. */
export interface WorkflowAppConfig {
  instanceId: string
  /** `chat`: a conversation with the workflow; `form`: fields, a submit button and the result. */
  template: 'chat' | 'form'
  title: string
  description: string
  /** The accent colour (buttons, the user's messages), as #rrggbb. */
  accentColor: string
  theme: 'light' | 'dark'
  corners: 'sharp' | 'rounded' | 'pill'
  welcome: string
  /** Prompts offered under an empty chat. */
  suggestions: string[]
  /** The form template's inputs, sent to the workflow by name. */
  fields: WorkflowAppField[]
  submitLabel: string
  showBranding: boolean
  status: 'draft' | 'published'
  publishedAt?: string
  updatedAt: string
}

export interface WorkflowAppField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'email' | 'date'
  required: boolean
}

const CHANGE_EVENT = 'eleven-nodes-workflow-apps'

function readAll(): Record<string, WorkflowAppConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.workflowApps)
    return raw ? (JSON.parse(raw) as Record<string, WorkflowAppConfig>) : {}
  } catch {
    return {}
  }
}

/** A new app for a deployment: a chat titled after the workflow. */
export function defaultAppConfig(instance: PublishedWorkflowInstance): WorkflowAppConfig {
  return {
    instanceId: instance.id,
    template: 'chat',
    title: instance.workflowName || 'Workflow app',
    description: 'Ask anything this workflow can help with.',
    accentColor: '#EB6115',
    theme: 'light',
    corners: 'rounded',
    welcome: `Hi! I'm ${instance.workflowName || 'your assistant'}. How can I help?`,
    suggestions: ['What can you do?', 'Start a new request'],
    fields: [{ name: 'message', label: 'Your request', type: 'textarea', required: true }],
    submitLabel: 'Run',
    showBranding: true,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }
}

export function readAppConfig(instance: PublishedWorkflowInstance): WorkflowAppConfig {
  return readAll()[instance.id] ?? defaultAppConfig(instance)
}

export function saveAppConfig(config: WorkflowAppConfig): WorkflowAppConfig {
  const saved = { ...config, updatedAt: new Date().toISOString() }
  try {
    localStorage.setItem(STORAGE_KEYS.workflowApps, JSON.stringify({ ...readAll(), [config.instanceId]: saved }))
  } catch {
    // Private mode or full storage: the edit stays in the page only
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return saved
}
