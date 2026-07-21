import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import {
  ADMIN_NAV_GROUPS,
  SETTINGS_NAV_ITEM,
  type AdminNavItem,
} from '@/components/admin-center/nav-config'
import { SearchInput } from '@/components/admin-center/SearchInput'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { APP_NAME, APP_TITLE } from '@/constants'
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
          'hidden h-full shrink-0 flex-col overflow-hidden border-r border-border/60 bg-muted/30 backdrop-blur-xl md:flex',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center',
            collapsed ? 'justify-center px-2' : 'gap-2.5 px-4',
          )}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="shrink-0 px-4 pb-5 pt-1">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search navigation…"
              inputClassName="h-9"
            />
          </div>
        )}

        <nav
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-5',
            collapsed ? 'flex flex-col items-center gap-6 px-2 pt-3' : 'space-y-7 px-4',
          )}
        >
          {collapsed
            ? groups.flatMap((group) =>
                group.items.map((item) => (
                  <SidebarNavLink key={item.to} item={item} collapsed />
                )),
              )
            : groups.map((group) => (
                <div key={group.title} className="min-w-0">
                  <p className="mb-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-2">
                    {group.items.map((item) => (
                      <SidebarNavLink key={item.to} item={item} collapsed={false} />
                    ))}
                  </div>
                </div>
              ))}
          {!collapsed && groups.length === 0 && (
            <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
              No matching pages.
            </p>
          )}
        </nav>

        <div
          className={cn(
            'shrink-0 border-t border-border/60',
            collapsed ? 'flex justify-center px-2 py-3.5' : 'px-4 py-3.5',
          )}
        >
          <SidebarNavLink item={SETTINGS_NAV_ITEM} collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  )
}

function SidebarNavLink({ item, collapsed }: { item: AdminNavItem; collapsed: boolean }) {
  const Icon = item.icon

  const link = (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'relative flex items-center rounded-xl text-left transition-colors',
          collapsed
            ? 'h-11 w-11 shrink-0 items-center justify-center'
            : 'w-full min-w-0 gap-3 px-3 py-3',
          isActive
            ? 'bg-primary/10 text-foreground'
            : 'text-muted-foreground hover:bg-accent/55 hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
              {item.label}
            </span>
          )}
          {!collapsed && item.badge ? (
            <span className="shrink-0 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
              {item.badge}
            </span>
          ) : null}
          {collapsed && item.badge ? (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          ) : null}
        </>
      )}
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
