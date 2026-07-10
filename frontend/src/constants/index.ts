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
} as const

/** Simulated network latency (ms) for the mock API layer. */
export const MOCK_API_DELAY = 350
