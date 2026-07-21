import {
  Activity,
  Bot,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
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
      {
        label: 'Workflows',
        to: ROUTES.workflows,
        icon: Bot,
        description: 'Agent workflows',
        mobileLabel: 'Flows',
      },
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

/** Flat list for the mobile bottom bar (includes settings). */
export const ADMIN_MOBILE_NAV: AdminNavItem[] = [
  ...ADMIN_NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV_ITEM,
]
