export const APP_NAME = 'Eleven Nodes'
export const APP_TITLE = 'Admin Center'

/** Main product app (tools / marketing). Override with VITE_MAIN_APP_URL. */
export const MAIN_APP_URL =
  import.meta.env.VITE_MAIN_APP_URL?.replace(/\/$/, '') || 'http://localhost:5173'

export const CONFIG_CONSOLE_URL =
  import.meta.env.VITE_CONFIG_CONSOLE_URL?.replace(/\/$/, '') ||
  `${MAIN_APP_URL}/admin/config`

export const AGENT_WORKFLOW_URL =
  import.meta.env.VITE_AGENT_WORKFLOW_URL?.replace(/\/$/, '') ||
  MAIN_APP_URL

/** The workflow on the canvas, opened from the Admin Center; saving it there updates this row. */
export const canvasUrl = (workflowId: string) => `${AGENT_WORKFLOW_URL}/?open=${encodeURIComponent(workflowId)}`

export const STORAGE_KEYS = {
  theme: 'eleven-nodes-admin-theme',
  application: 'eleven-nodes-admin-application',
  accessToken: 'eleven-nodes-admin-access-token',
  refreshToken: 'eleven-nodes-admin-refresh-token',
} as const

/** In-app routes (this micro-app owns the root). */
export const ROUTES = {
  root: '/',
  dashboard: '/dashboard',
  activity: '/activity',
  playground: '/playground',
  users: '/users',
  user: (id: string) => `/users/${id}`,
  userWorkflow: (userId: string, workflowId: string) =>
    `/users/${userId}/workflows/${workflowId}`,
  workflows: '/workflows',
  agents: '/agents',
  tools: '/tools',
  middlewares: '/middlewares',
  definition: (kind: string, id: string) => `/${kind}/${id}`,
  systemConfig: '/configuration/system',
  environmentConfig: '/configuration/environment',
  modelClients: '/configuration/model-clients',
  promptRules: '/configuration/prompt-rules',
  contextProviders: '/configuration/context-providers',
  workflowGeneration: '/configuration/workflow-generation',
  template: '/template',
  access: '/access',
  systemLogs: '/system-logs',
  settings: '/settings',
} as const
