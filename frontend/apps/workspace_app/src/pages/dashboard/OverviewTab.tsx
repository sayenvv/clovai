import { useCallback, useSyncExternalStore } from 'react'
import { Activity, Bot, Hash, ShieldCheck, Wallet, Workflow } from 'lucide-react'
import { DailyUsageChart, ReportState, Section } from '@/components/agent-workflow/dashboard/activity-ui'
import { HEALTH, healthOf, successRate } from '@/components/agent-workflow/dashboard/agent-health'
import { formatCompact, formatNumber, formatWhen } from '@/components/agent-workflow/dashboard/dashboard-format'
import { PageIntro, StatCard } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { useActivityReport } from '@/components/agent-workflow/dashboard/use-activity-report'
import { Badge } from '@/components/ui/badge'
import {
  fetchAgentsReport,
  fetchRecentCalls,
  fetchSavedWorkflows,
  fetchUsageReport,
} from '@/services/activity-api'
import { readTokenUsage, subscribeTokenUsage } from '@/services/token-usage-store'
import { cn } from '@/utils/cn'

type Tab = 'agents' | 'usage' | 'workflows' | 'activity'
const DAYS = 30

/** Everything at a glance over the last 30 days, with a way into each tab. */
export default function OverviewTab({ onOpen, workspaceId }: { onOpen: (tab: Tab) => void; workspaceId: string }) {
  const usage = useActivityReport(fetchUsageReport, DAYS)
  const agents = useActivityReport(fetchAgentsReport, DAYS)
  const recent = useActivityReport(useCallback(() => fetchRecentCalls(8), []), DAYS)
  const workflows = useActivityReport(useCallback(() => fetchSavedWorkflows(workspaceId), [workspaceId]), DAYS)
  const allowance = useSyncExternalStore(subscribeTokenUsage, readTokenUsage, () => null)

  const list = agents.data?.agents ?? []
  const steps = list.reduce((sum, agent) => sum + agent.steps, 0)
  const succeeded = list.reduce((sum, agent) => sum + agent.succeeded, 0)
  const failing = list.filter((agent) => healthOf(agent) === 'failing')
  const totals = usage.data?.totals
  const nothingYet = Boolean(usage.data) && (totals?.calls ?? 0) === 0 && list.length === 0

  return (
    <div>
      <PageIntro
        eyebrow="Overview"
        title="Your workspace at a glance"
        description={`Model usage, agent health, and activity over the last ${DAYS} days.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Tokens · last ${DAYS} days`}
          value={totals ? formatCompact(totals.totalTokens) : '—'}
          hint={totals ? `${formatNumber(totals.calls)} model calls` : 'Loading'}
          icon={Hash}
        />
        <StatCard
          label="Active agents"
          value={agents.data ? formatNumber(list.length) : '—'}
          hint={failing.length ? `${failing.length} failing` : 'None failing'}
          icon={Bot}
        />
        <StatCard
          label="Step success rate"
          value={steps ? `${Math.round((succeeded / steps) * 100)}%` : '—'}
          hint={`${formatNumber(succeeded)} of ${formatNumber(steps)} plan steps`}
          icon={ShieldCheck}
        />
        <StatCard
          label="Allowance remaining"
          value={allowance ? formatCompact(allowance.tokensRemaining) : '—'}
          hint={allowance ? `of ${formatCompact(allowance.tokenLimit)} this period` : 'Loads with your account'}
          icon={Wallet}
        />
      </div>

      <div className="mt-6">
        <ReportState
          isLoading={usage.isLoading && !usage.data}
          error={usage.error ?? agents.error}
          empty={nothingYet}
          icon={Activity}
          emptyTitle="Nothing recorded yet"
          emptyHint="Run a workflow or ask the Workflow AI to build one. Usage, agents, and activity appear here as they run."
        />
      </div>

      {usage.data && !nothingYet ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Tokens per day" className="lg:col-span-2" action={<OpenLink onClick={() => onOpen('usage')} label="Usage" />}>
            <DailyUsageChart daily={usage.data.daily} />
          </Section>

          <Section title="Agents" action={<OpenLink onClick={() => onOpen('agents')} label="All agents" />}>
            <div className="space-y-2">
              {[...failing, ...list.filter((agent) => !failing.includes(agent))].slice(0, 5).map((agent) => {
                const health = HEALTH[healthOf(agent)]
                const HealthIcon = health.icon
                return (
                  <div key={agent.agentId} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-foreground">{agent.agent}</p>
                      <p className="text-[10.5px] tabular-nums text-muted-foreground">
                        {formatNumber(agent.calls)} calls · {formatCompact(agent.totalTokens)} tokens · {successRate(agent)} steps
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 gap-1 text-[10px] font-normal', health.tone)}>
                      <HealthIcon className="h-3 w-3" />
                      {health.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Recent activity" className="lg:col-span-2" action={<OpenLink onClick={() => onOpen('activity')} label="All activity" />}>
            <div className="divide-y divide-border/60">
              {(recent.data ?? []).map((call, index) => (
                <div key={`${call.createdAt}-${index}`} className="flex items-center justify-between gap-3 py-2 text-[11.5px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{call.agent}</p>
                    <p className="truncate text-[10.5px] text-muted-foreground">
                      {call.workflow || call.source} · {formatWhen(call.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatNumber(call.totalTokens)} tokens</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Workflows" action={<OpenLink onClick={() => onOpen('workflows')} label="All workflows" />}>
            <div className="flex items-baseline gap-2">
              <Workflow className="h-4 w-4 self-center text-muted-foreground" />
              <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatNumber(workflows.data?.length ?? 0)}</p>
              <p className="text-[11px] text-muted-foreground">saved in this workspace</p>
            </div>
            <div className="mt-3 space-y-1.5">
              {(workflows.data ?? []).slice(0, 4).map((workflow) => (
                <p key={workflow.id} className="flex justify-between gap-2 text-[11.5px]">
                  <span className="truncate text-foreground">{workflow.name}</span>
                  <span className="shrink-0 text-muted-foreground">{formatWhen(workflow.updated_at)}</span>
                </p>
              ))}
            </div>
          </Section>
        </div>
      ) : null}
    </div>
  )
}

function OpenLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="text-[11px] font-medium text-foreground hover:underline dark:text-foreground">
      {label}
    </button>
  )
}
