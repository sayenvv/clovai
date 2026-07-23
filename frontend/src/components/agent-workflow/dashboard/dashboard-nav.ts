import {
  Activity,
  Gauge,
  LayoutDashboard,
  Rocket,
  type LucideIcon,
} from 'lucide-react'
import { ROUTES } from '@/constants'

export type DashboardNavItem = {
  label: string
  to: string
  icon: LucideIcon
  description: string
}

export const DASHBOARD_NAV: DashboardNavItem[] = [
  {
    label: 'Console home',
    to: ROUTES.agentWorkflowDashboard,
    icon: LayoutDashboard,
    description: 'Instance health & KPIs',
  },
  {
    label: 'My instances',
    to: ROUTES.agentWorkflowDashboardInstances,
    icon: Rocket,
    description: 'View & manage deploys',
  },
  {
    label: 'Performance',
    to: ROUTES.agentWorkflowDashboardPerformance,
    icon: Gauge,
    description: 'Latency, credits, load',
  },
  {
    label: 'Activity',
    to: ROUTES.agentWorkflowDashboardRuns,
    icon: Activity,
    description: 'Recent run history',
  },
]
