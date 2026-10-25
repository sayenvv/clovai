import { lazy, Suspense, useEffect, useState, type ReactElement } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  Bot,
  Braces,
  Cpu,
  LayoutDashboard,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserRound,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { DashboardPageSkeleton } from '@/components/agent-workflow/dashboard/dashboard-skeletons'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { APP_NAME, ROUTES } from '@/constants'
import { useSession } from '@/hooks/use-session'
import { cn } from '@/utils/cn'

const OverviewTab = lazy(() => import('@/pages/dashboard/OverviewTab'))
const AgentsTab = lazy(() => import('@/pages/agent-workflow-dashboard/AgentsPage'))
const UsageTab = lazy(() => import('@/pages/agent-workflow-dashboard/UsagePage'))
const WorkflowsTab = lazy(() => import('@/pages/dashboard/WorkflowsTab'))
const ActivityTab = lazy(() => import('@/pages/dashboard/ActivityTab'))
const ModelsTab = lazy(() => import('@/pages/dashboard/ModelsTab'))
const VariablesTab = lazy(() => import('@/pages/dashboard/VariablesTab'))
const accountTab = (name: 'ProfileTab' | 'WorkspaceTab' | 'AppearanceTab' | 'SecurityTab') =>
  lazy(() => import('@/pages/dashboard/AccountTabs').then((module) => ({ default: module[name] })))
const ProfileTab = accountTab('ProfileTab')
const WorkspaceTab = accountTab('WorkspaceTab')
const AppearanceTab = accountTab('AppearanceTab')
const SecurityTab = accountTab('SecurityTab')

type TabId =
  | 'overview'
  | 'agents'
  | 'usage'
  | 'workflows'
  | 'models'
  | 'variables'
  | 'activity'
  | 'profile'
  | 'workspace'
  | 'appearance'
  | 'security'

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon; description: string }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Usage, agents, and activity at a glance' },
  { id: 'agents', label: 'Agents', icon: Bot, description: 'Agent health, calls, and retries' },
  { id: 'usage', label: 'Usage', icon: BarChart3, description: 'Tokens by day, workflow, and agent' },
  { id: 'workflows', label: 'Workflows', icon: Workflow, description: 'Saved workflows and what they use' },
  { id: 'models', label: 'Models', icon: Cpu, description: 'Your own models for agents to run on' },
  { id: 'variables', label: 'Variables', icon: Braces, description: 'API keys, credentials and settings' },
  { id: 'activity', label: 'Activity', icon: Activity, description: 'Every recent model call' },
  { id: 'profile', label: 'Profile', icon: UserRound, description: 'Your name, role and email' },
  { id: 'workspace', label: 'Workspace', icon: Users, description: 'Workspace name and details' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Light or dark theme' },
  { id: 'security', label: 'Security', icon: ShieldCheck, description: 'Password, sign out and deletion' },
]

/** Sidebar groups: what's running, what it's built from, what it runs with, and the account. */
const NAV_GROUPS: Array<{ label: string; tabs: TabId[] }> = [
  { label: 'Insights', tabs: ['overview', 'usage', 'activity'] },
  { label: 'Build', tabs: ['workflows', 'agents'] },
  { label: 'Configure', tabs: ['models', 'variables'] },
  { label: 'Account', tabs: ['profile', 'workspace', 'appearance', 'security'] },
]

const COLLAPSED_KEY = 'dashboard.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function isTab(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

/** A right-side tooltip, shown only when the sidebar is collapsed to icons. */
function SidebarTip({ label, show, children }: { label: string; show: boolean; children: ReactElement }) {
  if (!show) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="px-2.5 py-1.5 text-xs font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** The standalone dashboard. The active tab lives in `?tab=` so each view can be linked to. */
export default function DashboardPage() {
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabId = isTab(requested) ? requested : 'overview'
  const current = TABS.find((item) => item.id === tab) ?? TABS[0]
  const group = NAV_GROUPS.find((item) => item.tabs.includes(tab)) ?? NAV_GROUPS[0]
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1')
      } catch {
        // The preference just won't be remembered.
      }
      return !value
    })

  useEffect(() => {
    document.title = `${current.label} — Dashboard — ${APP_NAME}`
  }, [current.label])

  if (!session) {
    return (
      <div className="workspace-surface flex h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center text-foreground">
        <Logo size={LOGO_SIZE_WORKSPACE} />
        <p className="text-sm font-medium">Sign in to see your dashboard</p>
        <Link to={ROUTES.agentWorkflow} className="text-[12.5px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Sign in
        </Link>
      </div>
    )
  }

  const select = (id: TabId) => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })

  const name = session.fullName || session.displayName || session.email || 'You'
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const content = (
    <Suspense
      fallback={<DashboardPageSkeleton tab={tab} />}
    >
      {tab === 'overview' ? <OverviewTab onOpen={select} /> : null}
      {tab === 'agents' ? <AgentsTab /> : null}
      {tab === 'usage' ? <UsageTab /> : null}
      {tab === 'workflows' ? <WorkflowsTab /> : null}
      {tab === 'models' ? <ModelsTab /> : null}
      {tab === 'variables' ? <VariablesTab /> : null}
      {tab === 'activity' ? <ActivityTab /> : null}
      {tab === 'profile' ? <ProfileTab /> : null}
      {tab === 'workspace' ? <WorkspaceTab /> : null}
      {tab === 'appearance' ? <AppearanceTab /> : null}
      {tab === 'security' ? <SecurityTab /> : null}
    </Suspense>
  )

  return (
    <div className="workspace-surface flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar (desktop): same chrome as the editor's rail. */}
      <TooltipProvider delayDuration={180}>
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ease-out md:flex',
            collapsed ? 'w-[68px]' : 'w-60',
          )}
        >
          <div className={cn('flex h-12 shrink-0 items-center gap-2.5 border-b border-border/60', collapsed ? 'justify-center px-2' : 'px-3.5')}>
            {collapsed ? null : (
              <>
                <Link to={ROUTES.home} className="shrink-0" aria-label={`${APP_NAME} home`}>
                  <Logo size={LOGO_SIZE_WORKSPACE} />
                </Link>
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">Dashboard</p>
              </>
            )}
            <SidebarTip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} show>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </button>
            </SidebarTip>
          </div>

          <nav
            className={cn(
              'flex-1 space-y-4 overflow-y-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'px-2.5',
            )}
            aria-label="Dashboard sections"
          >
            {NAV_GROUPS.map((navGroup, index) => (
              <div key={navGroup.label}>
                {collapsed ? (
                  index > 0 ? <div className="mx-auto mb-3 h-px w-6 bg-border" aria-hidden /> : null
                ) : (
                  <h3 className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {navGroup.label}
                  </h3>
                )}
                <div className="space-y-0.5">
                  {navGroup.tabs.map((id) => {
                    const item = TABS.find((candidate) => candidate.id === id)!
                    const Icon = item.icon
                    const active = item.id === tab
                    return (
                      <SidebarTip key={item.id} label={item.label} show={collapsed}>
                        <button
                          type="button"
                          onClick={() => select(item.id)}
                          aria-current={active ? 'page' : undefined}
                          aria-label={collapsed ? item.label : undefined}
                          className={cn(
                            'group/nav relative flex h-9 w-full items-center gap-2.5 rounded-lg text-left transition-colors duration-150',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            collapsed ? 'justify-center' : 'px-2.5',
                            active
                              ? 'bg-accent text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]'
                              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                          )}
                        >
                          {/* Edge bar for the open section, as on the editor's rail. */}
                          <span
                            aria-hidden
                            className={cn(
                              'absolute -left-2.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-foreground transition-opacity duration-150',
                              active ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <Icon className="size-[17px] shrink-0" strokeWidth={active ? 2 : 1.75} />
                          {collapsed ? null : (
                            <span className={cn('truncate text-[12.5px]', active ? 'font-semibold' : 'font-medium')}>
                              {item.label}
                            </span>
                          )}
                        </button>
                      </SidebarTip>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={cn('shrink-0 border-t border-border/60 p-2.5', collapsed && 'flex justify-center')}>
            <SidebarTip label={name} show={collapsed}>
              <button
                type="button"
                onClick={() => select('profile')}
                aria-label={collapsed ? 'Profile' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg py-1.5 text-left transition-colors hover:bg-accent/60',
                  collapsed ? 'justify-center px-1.5' : 'w-full px-2',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background ring-1 ring-border">
                  {initials || 'U'}
                </span>
                {collapsed ? null : (
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium">{name}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">{session.email}</span>
                  </span>
                )}
              </button>
            </SidebarTip>
          </div>
        </aside>
      </TooltipProvider>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="shrink-0 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
          <div className="flex h-12 items-center gap-3 px-4 md:px-6">
            <Link to={ROUTES.home} className="shrink-0 md:hidden" aria-label={`${APP_NAME} home`}>
              <Logo size={LOGO_SIZE_WORKSPACE} />
            </Link>
            <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[12px] text-muted-foreground">
              <span className="hidden sm:inline">{session.displayName}</span>
              <span aria-hidden className="hidden sm:inline">/</span>
              <span>{group.label}</span>
              <span aria-hidden>/</span>
              <span className="font-medium text-foreground">{current.label}</span>
            </p>
          </div>
          {/* Tabs (mobile) */}
          <nav className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 md:hidden" aria-label="Dashboard sections">
            {TABS.map((item) => {
              const Icon = item.icon
              const active = item.id === tab
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => select(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
                    active
                      ? 'bg-accent text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </header>

        {/* Content sits on the same recessed surface as the editor's canvas. */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[hsl(var(--canvas))]" role="tabpanel">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{content}</div>
        </main>
      </div>
    </div>
  )
}
