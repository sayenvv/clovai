import { lazy, Suspense, type ReactNode } from 'react'
import {
  Activity,
  BarChart3,
  BookOpen,
  CircleHelp,
  ExternalLink,
  GripVertical,
  Info,
  Bot,
  Braces,
  Cpu,
  Gauge,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { SHORTCUT_GROUPS } from '@/components/agent-workflow/HelpMenu'
import { APP_NAME } from '@/constants'
import { DashboardPageSkeleton } from '@/components/agent-workflow/dashboard/dashboard-skeletons'
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

export type SettingsTab =
  | 'insights'
  | 'workflow'
  | 'overview'
  | 'usage'
  | 'activity'
  | 'workflows'
  | 'agents'
  | 'models'
  | 'variables'
  | 'profile'
  | 'workspace'
  | 'appearance'
  | 'security'
  | 'help'

const TABS: Record<SettingsTab, { label: string; icon: LucideIcon; description: string }> = {
  insights: { label: 'Insights', icon: Gauge, description: 'Runs, agents, tokens and recommendations for this workflow' },
  workflow: { label: 'Workflow settings', icon: SlidersHorizontal, description: 'Pattern, default model and details of this workflow' },
  overview: { label: 'Overview', icon: LayoutDashboard, description: 'Usage, agents, and activity at a glance' },
  usage: { label: 'Usage', icon: BarChart3, description: 'Tokens by day, workflow, and agent' },
  activity: { label: 'Activity', icon: Activity, description: 'Every recent model call' },
  workflows: { label: 'Workflows', icon: Workflow, description: 'Saved workflows and what they use' },
  agents: { label: 'Agents', icon: Bot, description: 'Agent health, calls, and retries' },
  models: { label: 'Models', icon: Cpu, description: 'Your own models for agents to run on' },
  variables: { label: 'Variables', icon: Braces, description: 'API keys, credentials and settings' },
  profile: { label: 'Profile', icon: UserRound, description: 'Your name, role and email' },
  workspace: { label: 'Workspace', icon: Users, description: 'Workspace name and details' },
  appearance: { label: 'Appearance', icon: Palette, description: 'Theme and editor auto-save' },
  security: { label: 'Security', icon: ShieldCheck, description: 'Password, sign out and deletion' },
  help: { label: 'Help & shortcuts', icon: CircleHelp, description: 'Keyboard shortcuts, documentation and about' },
}

const GROUPS: Array<{ label: string; description: string; tabs: SettingsTab[] }> = [
  { label: 'This workflow', description: 'The workflow open in the editor.', tabs: ['insights', 'workflow'] },
  { label: 'Insights', description: 'Everything you run, across workflows.', tabs: ['overview', 'usage', 'activity'] },
  { label: 'Build', description: 'What your workflows are made of.', tabs: ['workflows', 'agents'] },
  { label: 'Configure', description: 'What your agents run with.', tabs: ['models', 'variables'] },
  { label: 'Account', description: 'You and your workspace.', tabs: ['profile', 'workspace', 'appearance', 'security'] },
  { label: 'Help', description: 'Shortcuts and where to learn more.', tabs: ['help'] },
]

export function isSettingsTab(value: string | null | undefined): value is SettingsTab {
  return Boolean(value && value in TABS)
}

interface WorkspaceSettingsViewProps {
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  /** The open workflow's Insights and settings (rendered by the editor, which owns that state). */
  insights: ReactNode
  workflowSettings: ReactNode
}

/**
 * Settings, inside the workspace: the open workflow's insights and settings, then what used to be the
 * separate dashboard (usage, activity, workflows, agents, models, variables and the account).
 */
export function WorkspaceSettingsView({ tab, onTabChange, insights, workflowSettings }: WorkspaceSettingsViewProps) {
  const current = TABS[tab]
  const workflowTab = tab === 'insights' || tab === 'workflow' || tab === 'help'

  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label="Settings sections"
        className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-[hsl(var(--chrome))] scrollbar-subtle"
      >
        {GROUPS.map((group) => (
          <section key={group.label} className="border-b border-border/80 px-3.5 pb-3 pt-3">
            <h2 className="text-[13px] font-semibold text-foreground">{group.label}</h2>
            <p className="mb-2 mt-0.5 text-[10px] leading-snug text-muted-foreground">{group.description}</p>
            <ul className="-mx-1.5">
              {group.tabs.map((id) => {
                const item = TABS[id]
                const Icon = item.icon
                const active = id === tab
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onTabChange(id)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-7 w-full items-center gap-2 rounded-[2px] px-1.5 text-left text-[11px]',
                        active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-foreground/[0.05]',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>

      <main className="scrollbar-subtle min-h-0 min-w-0 flex-1 overflow-y-auto bg-[hsl(var(--canvas))]" role="tabpanel">
        {/* The dashboard tabs carry their own headings */}
        {workflowTab ? (
          <div className="px-6 pb-2 pt-4">
            <h1 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-foreground">{current.label}</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{current.description}</p>
          </div>
        ) : null}
        <div className={cn('w-full px-6 pb-8', workflowTab ? 'max-w-3xl pt-2' : 'max-w-6xl pt-6')}>
          <Suspense fallback={<DashboardPageSkeleton tab={tab as never} />}>
            {tab === 'insights' ? insights : null}
            {tab === 'workflow' ? workflowSettings : null}
            {tab === 'overview' ? <OverviewTab onOpen={(next) => onTabChange(next as SettingsTab)} /> : null}
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
            {tab === 'help' ? <HelpContent /> : null}
          </Suspense>
        </div>
      </main>
    </div>
  )
}

/** A card as elsewhere in the workspace: thin border, a grip and a bold title. */
function HelpCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h3 className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold text-foreground">
        <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Help: the editor's keyboard shortcuts, then links to the docs and about page. */
function HelpContent() {
  return (
    <div className="space-y-3">
      {SHORTCUT_GROUPS.map((group) => (
        <HelpCard key={group.title} title={group.title}>
          <ul className="divide-y divide-border/70">
            {group.items.map((shortcut) => (
              <li key={shortcut.action} className="flex items-center justify-between gap-4 py-1.5">
                <span className="text-[11.5px] text-foreground">{shortcut.action}</span>
                <kbd className="shrink-0 rounded-[2px] bg-[hsl(var(--chrome-input))] px-1.5 py-0.5 font-sans text-[10.5px] text-muted-foreground">
                  {shortcut.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </HelpCard>
      ))}
      <HelpCard title="Learn more">
        <ul className="-mx-1.5">
          {[
            { href: '/#faq', label: 'FAQ & documentation', icon: BookOpen },
            { href: '/', label: `About ${APP_NAME}`, icon: Info },
          ].map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noopener"
                className="flex h-7 items-center gap-2 rounded-[2px] px-1.5 text-[11.5px] text-foreground hover:bg-foreground/[0.05]"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {label}
                <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      </HelpCard>
    </div>
  )
}
