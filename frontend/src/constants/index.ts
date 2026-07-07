export const APP_NAME = 'Eleven Nodes'

export const STORAGE_KEYS = {
  theme: 'clovai-theme',
  configStore: 'clovai-config-store-v4',
  diagram: (toolId: string) => `clovai-diagram-${toolId}`,
  shareSettings: (toolId: string) => `clovai-share-${toolId}`,
  workflowBuild: (workspaceId: string, pageId: string) =>
    `clovai-workflow-build:${workspaceId}:${pageId}`,
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
