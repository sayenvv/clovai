export const APP_NAME = 'Eleven Nodes'
export const APP_TITLE = 'Admin Center'

/** Main product app (tools / marketing). Override with VITE_MAIN_APP_URL. */
export const MAIN_APP_URL =
  import.meta.env.VITE_MAIN_APP_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5173'

export const CONFIG_CONSOLE_URL =
  import.meta.env.VITE_CONFIG_CONSOLE_URL?.replace(/\/$/, '') ||
  `${MAIN_APP_URL}/admin/config`

export const AGENT_WORKFLOW_URL =
  import.meta.env.VITE_AGENT_WORKFLOW_URL?.replace(/\/$/, '') ||
  `${MAIN_APP_URL}/tools/agent-workflow`

export const STORAGE_KEYS = {
  theme: 'eleven-nodes-admin-theme',
} as const

/** In-app routes (this micro-app owns the root). */
export const ROUTES = {
  root: '/',
  dashboard: '/dashboard',
  activity: '/activity',
  users: '/users',
  user: (id: string) => `/users/${id}`,
  userWorkflow: (userId: string, workflowId: string) =>
    `/users/${userId}/workflows/${workflowId}`,
  workflows: '/workflows',
  access: '/access',
  settings: '/settings',
} as const
