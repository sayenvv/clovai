import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { PenLine, Rocket } from 'lucide-react'
import { DashboardSidebar } from '@/components/agent-workflow/dashboard/DashboardSidebar'
import { DASHBOARD_NAV } from '@/components/agent-workflow/dashboard/dashboard-nav'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { APP_NAME, ROUTES } from '@/constants'
import { getSession } from '@/services/project-auth-store'
import { cn } from '@/utils/cn'

function pageMeta(pathname: string) {
  const match = DASHBOARD_NAV.find((item) =>
    item.to === ROUTES.agentWorkflowDashboard
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )
  return match ?? DASHBOARD_NAV[0]
}

export default function DashboardShell() {
  const session = getSession()
  const location = useLocation()
  const current = pageMeta(location.pathname)

  useEffect(() => {
    document.title = `${current.label} — Console — ${APP_NAME}`
  }, [current.label])

  if (!session) return null

  return (
    <div className="workspace-surface flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Same chrome language as AgentWorkflowHeader */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-3 backdrop-blur-sm">
        <Link to={ROUTES.home} className="shrink-0" aria-label={`${APP_NAME} home`}>
          <Logo size={LOGO_SIZE_WORKSPACE} />
        </Link>

        <div className="h-5 w-px bg-border" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="truncate text-sm font-semibold tracking-tight">Console</p>
          <Badge
            variant="outline"
            className="shrink-0 border-red-500/30 bg-red-500/5 text-[10px] font-normal text-red-700 dark:text-red-300"
          >
            {current.label}
          </Badge>
          <Badge
            variant="outline"
            className="hidden max-w-[12rem] truncate text-[10px] font-normal sm:inline-flex"
            title={session.email}
          >
            {session.displayName}
          </Badge>
          <Badge
            variant="outline"
            className="hidden border-indigo-500/30 bg-indigo-500/5 text-[10px] font-normal text-indigo-700 dark:text-indigo-300 sm:inline-flex"
          >
            {session.accountType === 'company' ? 'Company' : 'Individual'}
          </Badge>
        </div>

        <nav className="flex max-w-[45%] items-center gap-1 overflow-x-auto md:hidden">
          {DASHBOARD_NAV.map((item) => {
            const active =
              item.to === ROUTES.agentWorkflowDashboard
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium',
                  active
                    ? 'bg-foreground/[0.08] text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.agentWorkflow}>
              <PenLine className="h-3.5 w-3.5" />
              Designer
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-red-600 hover:bg-red-700">
            <Link to={ROUTES.agentWorkflow}>
              <Rocket className="h-3.5 w-3.5" />
              Deploy
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <DashboardSidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[hsl(var(--canvas))]">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
