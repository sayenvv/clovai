export const APP_NAME = 'Eleven Nodes'
export const APP_SLUG = 'eleven-nodes'

export const STORAGE_KEYS = {
  theme: 'eleven-nodes-theme',
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
  /** Custom code blocks, kept in the browser until the custom-code API exists. */
  customCode: 'eleven-nodes-custom-code',
} as const

export const QUERY_KEYS = {
  activeConfig: ['config', 'active'] as const,
  configList: ['config', 'list'] as const,
  config: (id: string) => ['config', id] as const,
} as const

export const ROUTES = {
  home: '/',
  tools: '/tools',
  tool: (route: string) => route,
  admin: '/admin/config',
  page: (slug: string) => `/${slug}`,
  agentWorkflow: '/tools/agent-workflow',
  dashboard: '/dashboard',
  /** Settings inside the workspace (what used to be the separate dashboard), on one of its tabs. */
  workspaceSettings: (tab = 'overview') => `/tools/agent-workflow?settings=${tab}`,
  agentWorkflowLibrary: '/tools/agent-workflow/library',
  agentWorkflowInspect: '/tools/agent-workflow/inspect',
  agentWorkflowLogs: '/tools/agent-workflow/logs',
  agentWorkflowDashboard: '/tools/agent-workflow/dashboard',
  agentWorkflowDashboardInstances: '/tools/agent-workflow/dashboard/instances',
  agentWorkflowDashboardRuns: '/tools/agent-workflow/dashboard/runs',
  agentWorkflowDashboardPerformance: '/tools/agent-workflow/dashboard/performance',
  agentWorkflowDashboardUsage: '/tools/agent-workflow/dashboard/usage',
  agentWorkflowDashboardAgents: '/tools/agent-workflow/dashboard/agents',
  agentWorkflowDashboardTraces: '/tools/agent-workflow/dashboard/traces',
  agentWorkflowExecute: '/tools/agent-workflow/execute',
} as const

/** Standalone Admin Center micro-app (separate Vite process / port). */
/**
 * Opens the dashboard in its own tab. `rel="opener"` keeps the tab linked to this one so the browser
 * copies the signed-in session (sessionStorage) into it; it's our own page, so that's safe.
 */
export const DASHBOARD_TAB_LINK = { target: '_blank', rel: 'opener' } as const

export const ADMIN_CENTER_URL =
  import.meta.env.VITE_ADMIN_CENTER_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5174'

/** Simulated network latency (ms) for the mock API layer. */
export const MOCK_API_DELAY = 350
