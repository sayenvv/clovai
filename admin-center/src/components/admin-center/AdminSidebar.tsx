import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity,
  Bot,
  LayoutDashboard,
  PanelLeft,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { APP_NAME, APP_TITLE, ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

const SIDEBAR_COLLAPSED_KEY = 'admin-center.sidebar-collapsed'

type NavItem = {
  label: string
  to: string
  icon: typeof Users
  description: string
  badge?: string
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        to: ROUTES.dashboard,
        icon: LayoutDashboard,
        description: 'Platform KPIs',
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
      },
    ],
  },
]

const SETTINGS_ITEM: NavItem = {
  label: 'Settings',
  to: ROUTES.settings,
  icon: Settings,
  description: 'Admin preferences',
}

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AdminSidebar() {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(readCollapsedPreference())
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return NAV_GROUPS
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.items.length > 0)
  }, [query])

  return (
    <aside
      className={cn(
        'hidden h-full shrink-0 flex-col border-r border-border/60 bg-muted/30 backdrop-blur-xl transition-[width] duration-200 ease-out md:flex',
        collapsed ? 'w-[4.25rem]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center',
          collapsed ? 'justify-center px-2' : 'gap-2 px-3',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="group relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
            title="Expand sidebar"
            aria-label="Expand sidebar"
            aria-expanded={false}
          >
            <Logo
              size={LOGO_SIZE_WORKSPACE}
              rounded="md"
              className="transition-opacity duration-150 group-hover:opacity-0"
            />
            <PanelLeft className="absolute h-4 w-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:text-foreground" />
          </button>
        ) : (
          <>
            <Logo size={LOGO_SIZE_WORKSPACE} rounded="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                {APP_TITLE}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">{APP_NAME}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              aria-expanded
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="shrink-0 px-3 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search navigation…"
              className="h-8 border-border/70 bg-background/70 pl-8 text-xs"
            />
          </div>
        </div>
      )}

      <nav
        className={cn(
          'min-h-0 flex-1 space-y-5 overflow-y-auto pb-4',
          collapsed ? 'px-2 pt-3' : 'px-3',
          collapsed && 'space-y-2',
        )}
      >
        {groups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {group.title}
              </p>
            )}
            <div className={cn('space-y-0.5', collapsed && 'space-y-1')}>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? `${item.label} — ${item.description}` : item.description}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex w-full items-center rounded-lg text-left transition-all',
                        collapsed
                          ? 'justify-center px-0 py-2.5'
                          : 'gap-2.5 px-2.5 py-2',
                        isActive
                          ? 'bg-gradient-to-r from-primary/12 to-primary/[0.04] text-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                        <Icon
                          className={cn('h-3.5 w-3.5 shrink-0', isActive && 'text-primary')}
                        />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate text-[11.5px] font-medium">
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {collapsed && item.badge && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
        {!collapsed && groups.length === 0 && (
          <p className="px-2.5 py-6 text-center text-[11px] text-muted-foreground">
            No matching pages.
          </p>
        )}
      </nav>

      <div
        className={cn(
          'shrink-0 border-t border-border/60',
          collapsed ? 'px-2 py-3' : 'px-3 py-3',
        )}
      >
        <SidebarNavLink item={SETTINGS_ITEM} collapsed={collapsed} />
      </div>
    </aside>
  )
}

function SidebarNavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      title={collapsed ? `${item.label} — ${item.description}` : item.description}
      className={({ isActive }) =>
        cn(
          'group relative flex w-full items-center rounded-lg text-left transition-all',
          collapsed ? 'h-10 justify-center px-0' : 'gap-2.5 px-2.5 py-2',
          isActive
            ? 'bg-gradient-to-r from-primary/12 to-primary/[0.04] text-foreground'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive && 'text-primary')} />
          {!collapsed && (
            <span className="flex-1 truncate text-[11.5px] font-medium">{item.label}</span>
          )}
        </>
      )}
    </NavLink>
  )
}
