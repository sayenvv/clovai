import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Menu, PenLine, X } from 'lucide-react'
import { DashboardSidebar } from '@/components/agent-workflow/dashboard/DashboardSidebar'
import { DASHBOARD_NAV } from '@/components/agent-workflow/dashboard/dashboard-nav'
import { MobileWorkspaceNav } from '@/components/agent-workflow/MobileWorkspaceNav'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { APP_NAME, ROUTES } from '@/constants'
import { getSession } from '@/services/project-auth-store'
import { useWorkspaceBreakpoint } from '@/hooks/use-workspace-breakpoint'
import { cn } from '@/utils/cn'

function pageMeta(pathname: string) {
  return (
    DASHBOARD_NAV.find((item) =>
      item.to === ROUTES.agentWorkflowDashboard
        ? pathname === item.to
        : pathname === item.to || pathname.startsWith(`${item.to}/`),
    ) ?? DASHBOARD_NAV[0]
  )
}

export default function DashboardShell() {
  const session = getSession()
  const location = useLocation()
  const current = pageMeta(location.pathname)
  const { isMobile } = useWorkspaceBreakpoint()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    document.title = `${current.label} — Console — ${APP_NAME}`
  }, [current.label])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  if (!session) return null

  return (
    <div className="workspace-surface flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border/80 bg-card/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex h-12 items-center gap-2.5 px-3">
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open console menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          ) : (
            <Link to={ROUTES.home} className="shrink-0" aria-label={`${APP_NAME} home`}>
              <Logo size={LOGO_SIZE_WORKSPACE} />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">Console</p>
            <p className="truncate text-[11px] text-muted-foreground">{current.description}</p>
          </div>

          <Badge
            variant="outline"
            className="hidden shrink-0 border-red-500/30 bg-red-500/5 text-[10px] font-medium text-red-700 dark:text-red-300 sm:inline-flex"
          >
            {current.label}
          </Badge>

          <Button asChild variant="outline" size="sm" className="h-9 rounded-lg">
            <Link to={ROUTES.agentWorkflow}>
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Designer</span>
            </Link>
          </Button>
        </div>

        {isMobile ? (
          <div className="flex gap-1 overflow-x-auto px-3 pb-2.5">
            {DASHBOARD_NAV.map((item) => {
              const active =
                item.to === ROUTES.agentWorkflowDashboard
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                    active
                      ? 'bg-red-600 text-white'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ) : null}
      </header>

      <div className={cn('flex min-h-0 flex-1 overflow-hidden', isMobile && 'pb-[4.75rem]')}>
        <div className="hidden h-full lg:flex">
          <DashboardSidebar />
        </div>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[hsl(var(--canvas))]">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {isMobile ? <MobileWorkspaceNav /> : null}

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Console menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(100vw,19rem)] animate-in slide-in-from-left-2 flex-col bg-background shadow-2xl duration-200">
            <div className="flex h-12 items-center justify-between border-b border-border/70 px-3 pt-[max(0px,env(safe-area-inset-top))]">
              <div className="flex items-center gap-2.5">
                <Logo size={LOGO_SIZE_WORKSPACE} rounded="md" />
                <div>
                  <p className="text-sm font-semibold">Console</p>
                  <p className="text-[10px] text-muted-foreground">Management portal</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <DashboardSidebar />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
