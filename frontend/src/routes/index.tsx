import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout'

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
const WorkflowExecutePage = lazy(() => import('@/pages/WorkflowExecutePage'))
const AdminConfigPage = lazy(() => import('@/pages/admin/AdminConfigPage'))
const DynamicPage = lazy(() => import('@/pages/DynamicPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export const router = createBrowserRouter([
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
          { path: 'usage', element: <AgentWorkflowDashboardPerformance /> },
        ],
      },
      {
        path: '/tools/agent-workflow',
        element: <AgentWorkflowPage />,
        children: [
          { index: true, element: <></> },
          { path: 'library', element: <></> },
          { path: 'inspect', element: <></> },
          { path: 'logs', element: <></> },
        ],
      },
      { path: '/tools/agent-workflow/execute', element: <WorkflowExecutePage /> },
      { path: '/tools/:toolId', element: <ToolDetailPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/tools', element: <ToolsPage /> },
      { path: '/admin/config', element: <AdminConfigPage /> },
      { path: '/404', element: <NotFoundPage /> },
      // Catch-all: resolves extra pages defined purely in JSON config.
      { path: '/:slug', element: <DynamicPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
