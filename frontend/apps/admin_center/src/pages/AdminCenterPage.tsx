import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { AdminNotificationsMenu } from '@/components/admin-center/AdminNotificationsMenu'
import { AdminProfileMenu } from '@/components/admin-center/AdminProfileMenu'
import { AdminSidebar } from '@/components/admin-center/AdminSidebar'
import { ADMIN_MOBILE_NAV, navItemForPath } from '@/components/admin-center/nav-config'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { APP_NAME, APP_TITLE, MAIN_APP_URL } from '@/constants'
import { cn } from '@/utils/cn'

/** Standalone Admin Center shell, laid out like the workspace app's console. */
export default function AdminCenterPage() {
  const location = useLocation()
  const current = navItemForPath(location.pathname)

  useEffect(() => {
    document.title = `${current.label} — ${APP_TITLE} — ${APP_NAME}`
  }, [current.label])

  return (
    <div className="workspace-surface admin-shell flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border/80 bg-card/95 pt-[max(0px,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex h-12 items-center gap-2.5 px-3">
          <Logo size={LOGO_SIZE_WORKSPACE} rounded="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">{APP_TITLE}</p>
            <p className="truncate text-[11px] text-muted-foreground">{current.description}</p>
          </div>

          <Badge
            variant="outline"
            className="hidden shrink-0 border-foreground/30 bg-foreground/5 text-[10px] font-medium text-foreground dark:text-foreground sm:inline-flex"
          >
            {current.label}
          </Badge>

          <Button asChild variant="outline" size="sm" className="hidden h-9 rounded-lg md:inline-flex">
            <a href={MAIN_APP_URL}>
              <ExternalLink className="h-3.5 w-3.5" />
              Workspace
            </a>
          </Button>
          <span className="mx-0.5 hidden h-6 w-px bg-border/70 md:block" aria-hidden />
          <AdminNotificationsMenu />
          <ThemeToggle />
          <AdminProfileMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-[hsl(var(--page))]">
          <Outlet />
        </main>
      </div>

      <nav className="flex shrink-0 items-center justify-around border-t border-border/70 bg-card/95 px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {ADMIN_MOBILE_NAV.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[9.5px] font-medium',
                  isActive ? 'text-foreground dark:text-foreground' : 'text-muted-foreground',
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
  )
}
