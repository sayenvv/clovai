import { Navigate, createBrowserRouter } from 'react-router-dom'
import AdminCenterPage from '@/pages/AdminCenterPage'
import { AccessView } from '@/components/admin-center/views/AccessView'
import { ActivityView } from '@/components/admin-center/views/ActivityView'
import { DashboardView } from '@/components/admin-center/views/DashboardView'
import { SettingsView } from '@/components/admin-center/views/SettingsView'
import { UserDetailView } from '@/components/admin-center/views/UserDetailView'
import { UserWorkflowDetailView } from '@/components/admin-center/views/UserWorkflowDetailView'
import { UsersView } from '@/components/admin-center/views/UsersView'
import { WorkflowsView } from '@/components/admin-center/views/WorkflowsView'

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
      { path: 'workflows', element: <WorkflowsView /> },
      { path: 'access', element: <AccessView /> },
      { path: 'settings', element: <SettingsView /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
