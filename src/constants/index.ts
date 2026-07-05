export const APP_NAME = 'Clovai'

export const STORAGE_KEYS = {
  theme: 'clovai-theme',
  configStore: 'clovai-config-store-v4',
  diagram: (toolId: string) => `clovai-diagram-${toolId}`,
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
