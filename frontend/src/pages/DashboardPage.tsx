import { lazy, Suspense, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Activity, BarChart3, Bot, LayoutDashboard, LayoutGrid, Loader2, PenLine, Workflow, type LucideIcon } from 'lucide-react'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { APP_NAME, ROUTES } from '@/constants'
import { getSession } from '@/services/project-auth-store'
import { cn } from '@/utils/cn'

const OverviewTab = lazy(() => import('@/pages/dashboard/OverviewTab'))
const AgentsTab = lazy(() => import('@/pages/agent-workflow-dashboard/AgentsPage'))
const UsageTab = lazy(() => import('@/pages/agent-workflow-dashboard/UsagePage'))
const WorkflowsTab = lazy(() => import('@/pages/dashboard/WorkflowsTab'))
const ActivityTab = lazy(() => import('@/pages/dashboard/ActivityTab'))

type TabId = 'overview' | 'agents' | 'usage' | 'workflows' | 'activity'

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon; description: string }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Usage, agents, and activity at a glance' },
  { id: 'agents', label: 'Agents', icon: Bot, description: 'Agent health, calls, and retries' },
  { id: 'usage', label: 'Usage', icon: BarChart3, description: 'Tokens by day, workflow, and agent' },
  { id: 'workflows', label: 'Workflows', icon: Workflow, description: 'Saved workflows and what they use' },
  { id: 'activity', label: 'Activity', icon: Activity, description: 'Every recent model call' },
]

function isTab(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

/** The standalone dashboard. The active tab lives in `?tab=` so each view can be linked to. */
export default function DashboardPage() {
  const session = getSession()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabId = isTab(requested) ? requested : 'overview'
  const current = TABS.find((item) => item.id === tab) ?? TABS[0]

  useEffect(() => {
    document.title = `${current.label} — Dashboard — ${APP_NAME}`
  }, [current.label])

  if (!session) return null

  const select = (id: TabId) => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })

  return (
    <div className="workspace-surface flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border/80 bg-card/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="flex h-12 items-center gap-2.5 px-3">
          <Link to={ROUTES.home} className="shrink-0" aria-label={`${APP_NAME} home`}>
            <Logo size={LOGO_SIZE_WORKSPACE} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">Dashboard</p>
            <p className="truncate text-[11px] text-muted-foreground">{current.description}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-9 rounded-lg">
            <Link to={ROUTES.agentWorkflowDashboard}>
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Console</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9 rounded-lg">
            <Link to={ROUTES.agentWorkflow}>
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Designer</span>
            </Link>
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3" role="tablist" aria-label="Dashboard sections">
          {TABS.map((item) => {
            const Icon = item.icon
            const active = item.id === tab
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => select(item.id)}
                className={cn(
                  '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-medium transition-colors',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[hsl(var(--canvas))]" role="tabpanel">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-6">
          <Suspense
            fallback={
              <div className="flex items-center gap-2 py-10 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            }
          >
            {tab === 'overview' ? <OverviewTab onOpen={select} workspaceId={session.workspaceId} /> : null}
            {tab === 'agents' ? <AgentsTab /> : null}
            {tab === 'usage' ? <UsageTab /> : null}
            {tab === 'workflows' ? <WorkflowsTab workspaceId={session.workspaceId} /> : null}
            {tab === 'activity' ? <ActivityTab /> : null}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
