import {
  Activity,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { DEFINITION_KINDS } from '@/components/admin-center/definition-kinds'
import { ROUTES } from '@/constants'

export type AdminNavItem = {
  label: string
  to: string
  icon: LucideIcon
  description: string
  badge?: string
  /** Shorter label for the mobile tab bar */
  mobileLabel?: string
}

export type AdminNavGroup = {
  title: string
  items: AdminNavItem[]
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        to: ROUTES.dashboard,
        icon: LayoutDashboard,
        description: 'Platform KPIs',
        mobileLabel: 'Home',
      },
      {
        label: 'Activity',
        to: ROUTES.activity,
        icon: Activity,
        description: 'Recent events',
      },
    ],
  },
  {
    title: 'Workspace',
    items: [
      {
        label: 'Users',
        to: ROUTES.users,
        icon: Users,
        description: 'Members & invites',
        badge: '6',
      },
    ],
  },
  {
    title: 'Definitions',
    items: (['workflows', 'agents', 'tools', 'middlewares'] as const).map((kind) => {
      const config = DEFINITION_KINDS[kind]
      return { label: config.label, to: ROUTES[kind], icon: config.icon, description: config.description }
    }),
  },
  {
    title: 'Configuration',
    items: [
      {
        label: 'System',
        to: ROUTES.systemConfig,
        icon: SlidersHorizontal,
        description: 'Models, runtime & limits',
      },
      {
        label: 'Environment',
        to: ROUTES.environmentConfig,
        icon: Globe,
        description: 'Environment variables',
      },
      { label: 'Template', to: ROUTES.template, icon: LayoutTemplate, description: 'Orchestration template' },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Access control',
        to: ROUTES.access,
        icon: ShieldCheck,
        description: 'Roles & permissions',
        mobileLabel: 'Access',
      },
    ],
  },
]

export const SETTINGS_NAV_ITEM: AdminNavItem = {
  label: 'Settings',
  to: ROUTES.settings,
  icon: Settings,
  description: 'Admin preferences',
}

/** Every page, for titling the current route. */
export const ADMIN_ALL_NAV: AdminNavItem[] = [
  ...ADMIN_NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV_ITEM,
]

/** The mobile bottom bar has room for a few pages; the rest are reachable from them. */
const MOBILE_PAGES: string[] = [ROUTES.dashboard, ROUTES.users, ROUTES.workflows, ROUTES.agents, ROUTES.settings]
export const ADMIN_MOBILE_NAV: AdminNavItem[] = ADMIN_ALL_NAV.filter((item) => MOBILE_PAGES.includes(item.to))

/** The nav item a path belongs to, so the shell can title the page. Detail pages match their section. */
export function navItemForPath(pathname: string): AdminNavItem {
  return (
    ADMIN_ALL_NAV.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)) ?? ADMIN_ALL_NAV[0]
  )
}
