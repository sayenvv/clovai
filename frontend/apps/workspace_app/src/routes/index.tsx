import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout'
import { ROUTES } from '@/constants'

/** Every page is code-split; the layout shell loads instantly while
 *  page chunks stream in behind the Suspense fallback. */
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const ToolsPage = lazy(() => import('@/pages/ToolsPage'))
const ToolDetailPage = lazy(() => import('@/pages/ToolDetailPage'))
const AgentWorkflowPage = lazy(() => import('@/pages/AgentWorkflowPage'))
const AgentWorkflowDashboardShell = lazy(
  () => import('@/components/agent-workflow/dashboard/DashboardShell'),
)
const AgentWorkflowDashboardOverview = lazy(
  () => import('@/pages/agent-workflow-dashboard/OverviewPage'),
)
const AgentWorkflowDashboardInstances = lazy(
  () => import('@/pages/agent-workflow-dashboard/InstancesPage'),
)
const AgentWorkflowDashboardRuns = lazy(
  () => import('@/pages/agent-workflow-dashboard/RunsPage'),
)
const AgentWorkflowDashboardPerformance = lazy(
  () => import('@/pages/agent-workflow-dashboard/PerformancePage'),
)
const AgentWorkflowDashboardUsage = lazy(
  () => import('@/pages/agent-workflow-dashboard/UsagePage'),
)
const AgentWorkflowDashboardAgents = lazy(
  () => import('@/pages/agent-workflow-dashboard/AgentsPage'),
)
const AgentWorkflowDashboardTraces = lazy(
  () => import('@/pages/agent-workflow-dashboard/TracesPage'),
)
const AgentWorkflowDashboardTraceDetail = lazy(
  () => import('@/pages/agent-workflow-dashboard/TraceDetailPage'),
)
const WorkflowExecutePage = lazy(() => import('@/pages/WorkflowExecutePage'))
const AdminConfigPage = lazy(() => import('@/pages/admin/AdminConfigPage'))
const DynamicPage = lazy(() => import('@/pages/DynamicPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const PublicAppPage = lazy(() => import('@/pages/PublicAppPage'))

/** Old /tools/agent-workflow/... links: the same place at the root, keeping the query (?open=, ?settings=). */
function LegacyWorkspaceRedirect() {
  const { pathname, search, hash } = useLocation()
  const rest = pathname.replace(/^\/tools\/agent-workflow/, '') || '/'
  return <Navigate to={`${rest}${search}${hash}`} replace />
}

function DashboardRedirect() {
  const [params] = useSearchParams()
  return <Navigate to={ROUTES.workspaceSettings(params.get('tab') ?? 'overview')} replace />
}

/**
 * The workspace a page is served for when it is a user's app subdomain (`<workspace>.<VITE_APPS_BASE_DOMAIN>`), or
 * null on the platform's own address.
 */
function appSubdomain(): string | null {
  // The host name has no port; the setting may (localhost:5173 in development)
  const base = (import.meta.env.VITE_APPS_BASE_DOMAIN as string | undefined)?.trim().toLowerCase().split(':')[0]
  const host = window.location.hostname.toLowerCase()
  if (!base || !host.endsWith(`.${base}`)) return null
  return host.slice(0, -(base.length + 1)) || null
}

const appsHost = appSubdomain()

/** A published app page, loaded on its own (it has no workspace layout around it). */
function PublicApp({ workspace }: { workspace?: string }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PublicAppPage workspace={workspace} />
    </Suspense>
  )
}

/** On a user's app subdomain only their published apps are served: `/<app>`. */
const appRoutes = [{ path: '/:slug', element: <PublicApp workspace={appsHost ?? undefined} /> }]

export const router = createBrowserRouter(appsHost ? appRoutes : [
  // Published apps, open to anyone: /apps/<workspace>/<app> (on its own subdomain in production)
  { path: '/apps/:workspace/:slug', element: <PublicApp /> },
  // Tool workspaces open in their own tab with no site chrome (like n8n/Figma).
  {
    element: <WorkspaceLayout />,
    children: [
      {
        path: '/tools/agent-workflow/dashboard',
        element: <AgentWorkflowDashboardShell />,
        children: [
          { index: true, element: <AgentWorkflowDashboardOverview /> },
          { path: 'instances', element: <AgentWorkflowDashboardInstances /> },
          { path: 'runs', element: <AgentWorkflowDashboardRuns /> },
          { path: 'performance', element: <AgentWorkflowDashboardPerformance /> },
          { path: 'usage', element: <AgentWorkflowDashboardUsage /> },
          { path: 'agents', element: <AgentWorkflowDashboardAgents /> },
          { path: 'traces', element: <AgentWorkflowDashboardTraces /> },
          { path: 'traces/:traceId', element: <AgentWorkflowDashboardTraceDetail /> },
        ],
      },
      {
        path: '/',
        element: <AgentWorkflowPage />,
        children: [
          { index: true, element: <></> },
          { path: 'library', element: <></> },
          { path: 'inspect', element: <></> },
          { path: 'logs', element: <></> },
        ],
      },
      { path: '/execute', element: <WorkflowExecutePage /> },
      { path: '/tools/agent-workflow', element: <LegacyWorkspaceRedirect /> },
      { path: '/tools/agent-workflow/library', element: <LegacyWorkspaceRedirect /> },
      { path: '/tools/agent-workflow/inspect', element: <LegacyWorkspaceRedirect /> },
      { path: '/tools/agent-workflow/logs', element: <LegacyWorkspaceRedirect /> },
      { path: '/tools/agent-workflow/execute', element: <LegacyWorkspaceRedirect /> },
      // The dashboard now lives in the workspace's Settings; old links land on the same tab there.
      { path: '/dashboard', element: <DashboardRedirect /> },
      { path: '/tools/:toolId', element: <ToolDetailPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      // The old landing page; the marketing site (apps/website) replaces it at www.<domain>
      { path: '/home', element: <LandingPage /> },
      { path: '/tools', element: <ToolsPage /> },
      { path: '/admin/config', element: <AdminConfigPage /> },
      { path: '/404', element: <NotFoundPage /> },
      // Catch-all: resolves extra pages defined purely in JSON config.
      { path: '/:slug', element: <DynamicPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
