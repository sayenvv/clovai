import { Navigate, createBrowserRouter } from 'react-router-dom'
import AdminCenterPage from '@/pages/AdminCenterPage'
import { ConfigDocumentsView } from '@/components/admin-center/views/ConfigDocumentsView'
import { ConfigSectionView } from '@/components/admin-center/views/ConfigSectionView'
import { EnvironmentView } from '@/components/admin-center/views/EnvironmentView'
import { AccessView } from '@/components/admin-center/views/AccessView'
import { ActivityView } from '@/components/admin-center/views/ActivityView'
import { DashboardView } from '@/components/admin-center/views/DashboardView'
import { SettingsView } from '@/components/admin-center/views/SettingsView'
import { UserDetailView } from '@/components/admin-center/views/UserDetailView'
import { UserWorkflowDetailView } from '@/components/admin-center/views/UserWorkflowDetailView'
import { UsersView } from '@/components/admin-center/views/UsersView'
import { DefinitionDetailView } from '@/components/admin-center/views/DefinitionDetailView'
import { DefinitionsView } from '@/components/admin-center/views/DefinitionsView'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminCenterPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardView /> },
      { path: 'activity', element: <ActivityView /> },
      { path: 'users', element: <UsersView /> },
      { path: 'users/:userId', element: <UserDetailView /> },
      {
        path: 'users/:userId/workflows/:workflowId',
        element: <UserWorkflowDetailView />,
      },
      // key= remounts the page when switching kinds, so state never leaks between them.
      ...(['workflows', 'agents', 'tools', 'middlewares'] as const).flatMap((kind) => [
        { path: kind, element: <DefinitionsView key={kind} kind={kind} /> },
        { path: `${kind}/:id`, element: <DefinitionDetailView key={kind} kind={kind} /> },
      ]),
      { path: 'configuration', element: <Navigate to="/configuration/system" replace /> },
      { path: 'configuration/system', element: <ConfigSectionView /> },
      { path: 'configuration/environment', element: <EnvironmentView /> },
      // Old addresses, kept so bookmarks land on the new pages.
      { path: 'configurations', element: <Navigate to="/configuration/system" replace /> },
      { path: 'application-config', element: <Navigate to="/configuration/system" replace /> },
      { path: 'environment-config', element: <Navigate to="/configuration/environment" replace /> },
      { path: 'variables', element: <Navigate to="/configuration/environment" replace /> },
      {
        path: 'template',
        element: (
          <ConfigDocumentsView
            key="templates"
            title="Orchestration template"
            singular="template"
            description="Saved copies of the orchestration template. The active one is the template document."
            collection="templates"
          />
        ),
      },
      { path: 'access', element: <AccessView /> },
      { path: 'settings', element: <SettingsView /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
