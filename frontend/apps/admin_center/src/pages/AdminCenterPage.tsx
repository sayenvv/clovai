import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { AdminNotificationsMenu } from '@/components/admin-center/AdminNotificationsMenu'
import { AdminProfileMenu } from '@/components/admin-center/AdminProfileMenu'
import { AdminSidebar } from '@/components/admin-center/AdminSidebar'
import { ADMIN_MOBILE_NAV, navItemForPath } from '@/components/admin-center/nav-config'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { APP_NAME, APP_TITLE, MAIN_APP_URL, ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

/** Standalone Admin Center shell, laid out like the workspace app's console. */
export default function AdminCenterPage() {
  const location = useLocation()
  const current = navItemForPath(location.pathname)

  useEffect(() => {
    document.title = `${current.label} — ${APP_TITLE} — ${APP_NAME}`
  }, [current.label])

  return (
    <div className="workspace-surface admin-shell flex h-screen overflow-hidden bg-background text-foreground">
      {/* The orange app rail, as in the workspace: logo, back to the workspace, then theme and account */}
      <TooltipProvider delayDuration={200}>
        <nav
          aria-label="Admin Center"
          className="rail-surface relative z-50 hidden h-full w-10 shrink-0 flex-col items-center gap-1.5 py-2 md:flex"
        >
          <RailTip label={`${APP_TITLE} home`}>
            <NavLink
              to={ROUTES.dashboard}
              aria-label={`${APP_TITLE} home`}
              className="mb-3 mt-1 flex h-8 w-8 items-center justify-center rounded-[3px] hover:bg-white/10"
            >
              <img src="/brand/mark-white.svg" alt="" className="h-5 w-5" />
            </NavLink>
          </RailTip>
          <RailTip label="Open the workspace">
            <a
              href={MAIN_APP_URL}
              aria-label="Open the workspace"
              className="flex h-8 w-8 items-center justify-center rounded-[3px] text-foreground/85 transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
            </a>
          </RailTip>
          <div className="mt-auto flex flex-col items-center gap-2">
            <ThemeToggle className="h-8 w-8 rounded-[3px] text-foreground/85 hover:bg-white/10 hover:text-foreground [&_svg]:size-4" />
            <AdminProfileMenu compact side="right" />
          </div>
        </nav>
      </TooltipProvider>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* The thin top bar: where you are, then notifications */}
      <header className="relative z-40 flex h-8 shrink-0 items-center gap-2 border-b border-border bg-[hsl(var(--chrome))] pl-3 pr-2 pt-[max(0px,env(safe-area-inset-top))]">
        <span className="hidden shrink-0 text-[11.5px] font-medium text-foreground/85 md:inline">{APP_TITLE}</span>
        <span className="hidden text-foreground/30 md:inline" aria-hidden>/</span>
        <span className="min-w-0 truncate text-[11.5px] font-semibold text-foreground">{current.label}</span>
        <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground lg:inline">· {current.description}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <AdminNotificationsMenu />
          {/* On phones the rail is hidden, so the theme and account sit here */}
          <span className="md:hidden">
            <ThemeToggle className="h-6 w-6 rounded-[3px] [&_svg]:size-3.5" />
          </span>
          <span className="md:hidden">
            <AdminProfileMenu compact />
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[hsl(var(--page))]">
          <Outlet />
        </main>
      </div>

      <nav className="flex shrink-0 items-center justify-around border-t border-border bg-[hsl(var(--chrome))] px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden">
        {ADMIN_MOBILE_NAV.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 rounded-[3px] px-2 py-1 text-[9.5px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {link.mobileLabel ?? link.label}
            </NavLink>
          )
        })}
      </nav>
      </div>
    </div>
  )
}

function RailTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="px-2 py-1 text-xs font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
