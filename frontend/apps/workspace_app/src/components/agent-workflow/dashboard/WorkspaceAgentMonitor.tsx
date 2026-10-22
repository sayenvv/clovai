import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, ChevronRight, CircleDashed, Layers, XCircle } from 'lucide-react'
import { ReportState, Section } from '@/components/agent-workflow/dashboard/activity-ui'
import { formatCompact, formatLatency, formatNumber, formatWhen } from '@/components/agent-workflow/dashboard/dashboard-format'
import { useActivityReport } from '@/components/agent-workflow/dashboard/use-activity-report'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  fetchMonitoredWorkspaces,
  fetchWorkspaceTabs,
  type MonitoredTab,
  type MonitoredWorkspace,
} from '@/services/activity-api'
import { getSession } from '@/services/project-auth-store'
import { cn } from '@/utils/cn'

const NO_WORKSPACES: MonitoredWorkspace[] = []

type TabHealth = 'healthy' | 'degraded' | 'failing' | 'idle'

const TAB_HEALTH: Record<TabHealth, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: 'Healthy', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  degraded: { label: 'Degraded', tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: AlertTriangle },
  failing: { label: 'Failing', tone: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300', icon: XCircle },
  idle: { label: 'Not run', tone: 'border-border bg-muted text-muted-foreground', icon: CircleDashed },
}

/** Health from how the tab's runs ended in the window. */
function tabHealth(tab: MonitoredTab): TabHealth {
  if (tab.runs.total === 0) return 'idle'
  const rate = tab.runs.succeeded / tab.runs.total
  if (rate >= 0.9) return 'healthy'
  if (rate >= 0.7) return 'degraded'
  return 'failing'
}

/**
 * Agent monitoring per workspace tab: pick a workspace, and each saved tab
 * lists its agents with calls, tokens, runs, and last activity, under the
 * tab's own run health.
 */
export function WorkspaceAgentMonitor({ days }: { days: number }) {
  const workspaces = useActivityReport(fetchMonitoredWorkspaces, 0)
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const list = workspaces.data ?? NO_WORKSPACES

  // Start on the signed-in workspace when it has tabs, otherwise the most recently changed one.
  useEffect(() => {
    if (workspaceId || list.length === 0) return
    const own = getSession()?.workspaceId
    setWorkspaceId(list.find((item) => item.workspaceId === own)?.workspaceId ?? list[0].workspaceId)
  }, [list, workspaceId])

  const loadTabs = useCallback((window: number) => fetchWorkspaceTabs(workspaceId, window), [workspaceId])
  const tabs = useActivityReport(workspaceId ? loadTabs : noTabs, days)

  return (
    <Section
      title="By workspace tab"
      className="mt-0"
      action={
        list.length > 0 ? (
          <div className="w-56">
            <Select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              aria-label="Workspace"
              className="h-8 text-[12px]"
            >
              {list.map((item) => (
                <option key={item.workspaceId} value={item.workspaceId}>
                  {item.name} · {item.tabs} tab{item.tabs === 1 ? '' : 's'}
                </option>
              ))}
            </Select>
          </div>
        ) : null
      }
    >
      <ReportState
        isLoading={(workspaces.isLoading && !workspaces.data) || (Boolean(workspaceId) && tabs.isLoading && !tabs.data)}
        error={workspaces.error ?? tabs.error}
        empty={Boolean(workspaces.data) && list.length === 0}
        icon={Layers}
        emptyTitle="No saved workflows yet"
        emptyHint="Save a tab in the designer and run it. Each tab's agents are monitored here."
      />
      {tabs.data && tabs.data.length > 0 ? (
        <div className="space-y-2">
          {tabs.data.map((tab, index) => (
            <TabCard key={tab.tabId} tab={tab} defaultOpen={index === 0} />
          ))}
        </div>
      ) : null}
    </Section>
  )
}

function noTabs(): Promise<MonitoredTab[]> {
  return Promise.resolve([])
}

function TabCard({ tab, defaultOpen }: { tab: MonitoredTab; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const health = TAB_HEALTH[tabHealth(tab)]
  const HealthIcon = health.icon
  const { runs } = tab
  const active = tab.agents.filter((agent) => agent.calls > 0).length
  const busiest = Math.max(0, ...tab.agents.map((agent) => agent.totalTokens))

  return (
    <div className="rounded-lg border border-border/70 bg-background/50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-[13px] font-semibold text-foreground">{tab.name}</p>
              <Badge variant="outline" className={cn('gap-1 text-[10px] font-normal', health.tone)}>
                <HealthIcon className="h-3 w-3" />
                {health.label}
              </Badge>
            </div>
            <p className="truncate text-[10.5px] text-muted-foreground">
              {tab.agents.length} agent{tab.agents.length === 1 ? '' : 's'} · {active} active ·{' '}
              {runs.lastRun ? `last run ${formatWhen(runs.lastRun)}` : `saved ${formatWhen(tab.updatedAt)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-right text-[11px]">
          <Metric value={formatNumber(runs.total)} label="runs" />
          <Metric value={runs.total ? `${Math.round((runs.succeeded / runs.total) * 100)}%` : '—'} label={`${runs.failed} failed`} />
          <Metric value={runs.avgDurationMs !== null ? formatLatency(runs.avgDurationMs) : '—'} label="avg run" />
          <Metric value={formatCompact(runs.totalTokens)} label="tokens" />
        </div>
      </button>

      {open ? (
        <div className="border-t border-border/60 px-3 pb-3 pt-2">
          {runs.lastError ? (
            <p className="mb-2 flex items-start gap-1.5 rounded-md border border-foreground/30 bg-foreground/5 px-2.5 py-1.5 text-[11px] text-foreground dark:text-foreground">
              <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">Last failure: {runs.lastError}</span>
            </p>
          ) : null}
          {tab.agents.length === 0 ? (
            <p className="py-2 text-[11.5px] text-muted-foreground">This tab has no agents.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-[11.5px]">
                <thead className="text-muted-foreground">
                  <tr>
                    {['Agent', 'Calls', 'Tokens', 'Per call', 'Runs', 'Last active'].map((heading, index) => (
                      <th key={heading} className={cn('px-2 py-1.5 font-medium', index === 0 ? 'text-left' : 'text-right')}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tab.agents.map((agent) => {
                    const share = busiest > 0 ? (agent.totalTokens / busiest) * 100 : 0
                    return (
                      <tr key={agent.id} className="border-t border-border/40">
                        <td className="max-w-[18rem] px-2 py-2">
                          <div className="flex items-center gap-2">
                            <Bot className={cn('h-3.5 w-3.5 shrink-0', agent.calls ? 'text-foreground' : 'text-muted-foreground/60')} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{agent.name}</p>
                              {agent.role ? <p className="truncate text-[10.5px] text-muted-foreground">{agent.role}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatNumber(agent.calls)}</td>
                        <td className="px-2 py-2 text-right">
                          <span className="tabular-nums font-medium text-foreground">{formatCompact(agent.totalTokens)}</span>
                          <span className="ml-auto mt-1 block h-1 w-16 overflow-hidden rounded-full bg-muted sm:ml-2 sm:inline-block sm:align-middle">
                            <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${share}%` }} />
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {agent.calls ? formatCompact(Math.round(agent.totalTokens / agent.calls)) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {runs.total ? `${agent.runs}/${runs.total}` : formatNumber(agent.runs)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-muted-foreground">
                          {agent.lastActive ? formatWhen(agent.lastActive) : 'Idle'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  )
}
