import { useEffect, useMemo, useState } from 'react'
import { NavLink, useMatch, useResolvedPath } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import {
  ADMIN_NAV_GROUPS,
  SETTINGS_NAV_ITEM,
  type AdminNavItem,
} from '@/components/admin-center/nav-config'
import { ApplicationSwitcher } from '@/components/admin-center/ApplicationSwitcher'
import { SearchInput } from '@/components/admin-center/SearchInput'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/utils/cn'

const SIDEBAR_COLLAPSED_KEY = 'admin-center.sidebar-collapsed'

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AdminSidebar() {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(readCollapsedPreference)

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return ADMIN_NAV_GROUPS
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.items.length > 0)
  }, [query])

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <aside
        className={cn(
          // A chrome side panel, like the workspace's library and outline
          'hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-[hsl(var(--chrome))] md:flex',
          // Dark mode: the rail and this panel are nearly the same black, so a line separates them
          'dark:border-l',
          collapsed ? 'w-12' : 'w-[220px]',
        )}
      >
        <ApplicationSwitcher collapsed={collapsed} />
        {!collapsed && (
          <div className="shrink-0 px-3 pb-3 pt-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search pages"
            />
          </div>
        )}

        <nav
          className={cn(
            'scrollbar-subtle min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4',
            collapsed ? 'flex flex-col items-center gap-1 px-2 pt-3' : 'space-y-4 px-2.5',
          )}
        >
          {collapsed
            ? groups.flatMap((group) =>
                group.items.map((item) => <SidebarNavLink key={item.to} item={item} collapsed />),
              )
            : groups.map((group) => (
                <div key={group.title} className="min-w-0">
                  <p className="mb-1 px-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <SidebarNavLink key={item.to} item={item} collapsed={false} />
                    ))}
                  </div>
                </div>
              ))}
          {!collapsed && groups.length === 0 && (
            <p className="px-2.5 py-6 text-center text-[11px] text-muted-foreground">No matching pages.</p>
          )}
        </nav>

        <div
          className={cn(
            'flex shrink-0 border-t border-border py-2',
            collapsed ? 'flex-col items-center gap-1 px-2' : 'items-center gap-1 px-3',
          )}
        >
          <div className={cn(!collapsed && 'min-w-0 flex-1')}>
            <SidebarNavLink item={SETTINGS_NAV_ITEM} collapsed={collapsed} />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((value) => !value)}
            className="h-6 w-6 shrink-0 rounded-[2px] text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground [&_svg]:size-3.5"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function SidebarNavLink({ item, collapsed }: { item: AdminNavItem; collapsed: boolean }) {
  const Icon = item.icon
  // Worked out here, not with NavLink's className function: the collapsed link sits in a
  // TooltipTrigger (asChild), whose Slot merges classNames as strings and drops a function,
  // which left collapsed links unstyled and squashed to their icon's height
  const isActive = Boolean(useMatch({ path: useResolvedPath(item.to).pathname, end: false }))

  const link = (
    <NavLink
      to={item.to}
      className={cn(
        'relative flex items-center rounded-[3px] text-left transition-colors',
        collapsed ? 'h-8 w-8 shrink-0 justify-center' : 'w-full min-w-0 gap-2.5 px-2 py-1.5',
        // Selected as in the workspace's library rail: the accent tint with an orange icon
        isActive
          ? 'bg-accent font-medium text-foreground'
          : 'text-foreground/75 hover:bg-foreground/[0.06] hover:text-foreground',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} strokeWidth={isActive ? 2 : 1.75} />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.label}</span>}
      {!collapsed && item.badge ? (
        <span className="shrink-0 rounded-[2px] bg-foreground/[0.06] px-1.5 py-px text-[10px] font-semibold tabular-nums text-muted-foreground">
          {item.badge}
        </span>
      ) : null}
      {collapsed && item.badge ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
    </NavLink>
  )

  // Tooltips only when collapsed — avoid wrapping expanded links (breaks label text).
  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}
