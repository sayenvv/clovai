import { useState } from 'react'
import { Bot, CircleDashed, Repeat, ShieldCheck } from 'lucide-react'
import { HEALTH, healthOf, successRate } from '@/components/agent-workflow/dashboard/agent-health'
import {
  RangeSelect,
  ReportState,
  Section,
} from '@/components/agent-workflow/dashboard/activity-ui'
import {
  formatCompact,
  formatNumber,
  formatWhen,
  type RangeDays,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import { PageIntro, StatCard } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { useActivityReport } from '@/components/agent-workflow/dashboard/use-activity-report'
import { WorkspaceAgentMonitor } from '@/components/agent-workflow/dashboard/WorkspaceAgentMonitor'
import { Badge } from '@/components/ui/badge'
import { fetchAgentsReport } from '@/services/activity-api'
import { cn } from '@/utils/cn'

export default function AgentsPage() {
  const [days, setDays] = useState<RangeDays>(30)
  const { data, error, isLoading } = useActivityReport(fetchAgentsReport, days)
  const agents = data?.agents ?? []
  const calls = agents.reduce((sum, agent) => sum + agent.calls, 0)
  const steps = agents.reduce((sum, agent) => sum + agent.steps, 0)
  const succeeded = agents.reduce((sum, agent) => sum + agent.succeeded, 0)
  const attempts = agents.filter((agent) => agent.avgAttempts !== null)
  const avgAttempts = attempts.length
    ? attempts.reduce((sum, agent) => sum + (agent.avgAttempts ?? 0) * agent.steps, 0) /
      Math.max(1, attempts.reduce((sum, agent) => sum + agent.steps, 0))
    : null
  const failing = agents.filter((agent) => healthOf(agent) === 'failing').length

  return (
    <div>
      <PageIntro
        eyebrow="Agents"
        title="How your agents are doing"
        description="Pick a workspace to monitor each tab's agents and runs, or see every agent across your account below."
        actions={<RangeSelect value={days} onChange={setDays} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active agents"
          value={data ? formatNumber(agents.length) : '—'}
          hint={failing ? `${failing} failing` : 'None failing'}
          icon={Bot}
        />
        <StatCard label="Model calls" value={data ? formatNumber(calls) : '—'} hint={`Last ${days} days`} icon={Repeat} />
        <StatCard
          label="Step success rate"
          value={steps ? `${Math.round((succeeded / steps) * 100)}%` : '—'}
          hint={`${formatNumber(succeeded)} of ${formatNumber(steps)} plan steps`}
          icon={ShieldCheck}
        />
        <StatCard
          label="Avg attempts per step"
          value={avgAttempts !== null ? avgAttempts.toFixed(2) : '—'}
          hint="1.00 means no retries"
          icon={CircleDashed}
        />
      </div>

      <div className="mt-6">
        <WorkspaceAgentMonitor days={days} />
      </div>

      <div className="mt-4">
        <ReportState
          isLoading={isLoading && !data}
          error={error}
          empty={Boolean(data) && agents.length === 0}
          icon={Bot}
          emptyTitle="No agent activity in this period"
          emptyHint="Agents appear here once they run, from a workflow run or from the Workflow AI chat."
        />
      </div>

      {agents.length > 0 ? (
        <Section title="All agents · account-wide" className="mt-0">
          <div className="space-y-2">
            {agents.map((agent) => {
              const health = HEALTH[healthOf(agent)]
              const HealthIcon = health.icon
              return (
                <div
                  key={agent.agentId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-semibold text-foreground">{agent.agent}</p>
                        <Badge variant="outline" className={cn('gap-1 text-[10px] font-normal', health.tone)}>
                          <HealthIcon className="h-3 w-3" />
                          {health.label}
                        </Badge>
                      </div>
                      <p className="truncate font-mono text-[10.5px] text-muted-foreground">
                        {agent.agentId}
                        {agent.lastActive ? (
                          <span className="font-sans"> · last active {formatWhen(agent.lastActive)}</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-5 text-right text-[11px]">
                    <Metric value={formatNumber(agent.calls)} label="calls" />
                    <Metric value={formatCompact(agent.totalTokens)} label="tokens" />
                    <Metric
                      value={agent.calls ? formatCompact(Math.round(agent.totalTokens / agent.calls)) : '—'}
                      label="per call"
                    />
                    <Metric value={successRate(agent)} label={`${agent.succeeded}/${agent.steps} steps`} />
                    <Metric value={agent.avgAttempts !== null ? agent.avgAttempts.toFixed(1) : '—'} label="attempts" />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
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
