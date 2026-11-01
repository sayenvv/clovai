export const APP_NAME = 'Eleven Nodes'
export const APP_SLUG = 'eleven-nodes'

export const STORAGE_KEYS = {
  theme: 'eleven-nodes-theme',
  autoSave: 'eleven-nodes-auto-save',
  configStore: 'eleven-nodes-config-store-v4',
  diagram: (toolId: string, workspaceId?: string) =>
    workspaceId
      ? `eleven-nodes-diagram-${toolId}:${workspaceId}`
      : `eleven-nodes-diagram-${toolId}`,
  shareSettings: (toolId: string) => `eleven-nodes-share-${toolId}`,
  workflowBuild: (workspaceId: string, pageId: string) =>
    `eleven-nodes-workflow-build:${workspaceId}:${pageId}`,
  projectAccounts: 'eleven-nodes-project-accounts',
  projectSession: 'eleven-nodes-project-session',
  accessToken: 'eleven-nodes-access-token',
  refreshToken: 'eleven-nodes-refresh-token',
  publishedInstances: 'eleven-nodes-published-instances',
  tokenUsage: 'eleven-nodes-token-usage',
  workflowApps: 'eleven-nodes-workflow-apps',
  /** Custom code blocks, kept in the browser until the custom-code API exists. */
  customCode: 'eleven-nodes-custom-code',
} as const

export const QUERY_KEYS = {
  activeConfig: ['config', 'active'] as const,
  configList: ['config', 'list'] as const,
  config: (id: string) => ['config', id] as const,
  generationSpec: ['workflow-generation-spec'] as const,
} as const

export const ROUTES = {
  home: '/',
  tools: '/tools',
  tool: (route: string) => route,
  admin: '/admin/config',
  page: (slug: string) => `/${slug}`,
  /** The workspace opens at the site's root (cloud.<domain>/); the marketing site is a separate app. */
  agentWorkflow: '/',
  dashboard: '/dashboard',
  /** Settings inside the workspace (what used to be the separate dashboard), on one of its tabs. */
  workspaceSettings: (tab = 'overview') => `/?settings=${tab}`,
  agentWorkflowLibrary: '/library',
  agentWorkflowInspect: '/inspect',
  agentWorkflowLogs: '/logs',
  agentWorkflowDashboard: '/tools/agent-workflow/dashboard',
  agentWorkflowDashboardInstances: '/tools/agent-workflow/dashboard/instances',
  agentWorkflowDashboardRuns: '/tools/agent-workflow/dashboard/runs',
  agentWorkflowDashboardPerformance: '/tools/agent-workflow/dashboard/performance',
  agentWorkflowDashboardUsage: '/tools/agent-workflow/dashboard/usage',
  agentWorkflowDashboardAgents: '/tools/agent-workflow/dashboard/agents',
  agentWorkflowDashboardTraces: '/tools/agent-workflow/dashboard/traces',
  agentWorkflowExecute: '/execute',
} as const

/** Standalone Admin Center micro-app (separate Vite process / port). */
/**
 * Opens the dashboard in its own tab. `rel="opener"` keeps the tab linked to this one so the browser
 * copies the signed-in session (sessionStorage) into it; it's our own page, so that's safe.
 */
export const DASHBOARD_TAB_LINK = { target: '_blank', rel: 'opener' } as const

/** Where a user buys more tokens: VITE_BUY_CREDITS_URL, else the website's pricing page. */
export const BUY_CREDITS_URL =
  import.meta.env.VITE_BUY_CREDITS_URL ||
  `${(import.meta.env.VITE_WEBSITE_URL || 'https://www.abc.com').replace(/\/$/, '')}/pricing/`

export const ADMIN_CENTER_URL =
  import.meta.env.VITE_ADMIN_CENTER_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5174'

/** Simulated network latency (ms) for the mock API layer. */
export const MOCK_API_DELAY = 350

/**
 * Minutes away from the app after which the Workflow AI starts a new chat when the user comes back
 * (VITE_ASSISTANT_CHAT_IDLE_MINUTES, default 480: a working day). The old chat stays in the list. Short values make
 * the chat restart whenever the user switches to another window for a while.
 */
export const ASSISTANT_CHAT_IDLE_MINUTES = Number(import.meta.env.VITE_ASSISTANT_CHAT_IDLE_MINUTES) > 0
  ? Number(import.meta.env.VITE_ASSISTANT_CHAT_IDLE_MINUTES)
  : 480
