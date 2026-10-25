import {
  Activity,
  BarChart3,
  Bot,
  Gauge,
  LayoutDashboard,
  ListTree,
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
    label: 'Usage',
    to: ROUTES.agentWorkflowDashboardUsage,
    icon: BarChart3,
    description: 'Tokens by day, workflow, agent',
  },
  {
    label: 'Agents',
    to: ROUTES.agentWorkflowDashboardAgents,
    icon: Bot,
    description: 'Monitor agent activity',
  },
  {
    label: 'Traces',
    to: ROUTES.agentWorkflowDashboardTraces,
    icon: ListTree,
    description: 'Run traces: agents, model & tool calls',
  },
  {
    label: 'Activity',
    to: ROUTES.agentWorkflowDashboardRuns,
    icon: Activity,
    description: 'Recent run history',
  },
]
