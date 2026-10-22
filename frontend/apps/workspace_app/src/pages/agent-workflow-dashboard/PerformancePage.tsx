import { Link } from 'react-router-dom'
import {
  Coins,
  Cpu,
  Gauge,
  Hash,
  MemoryStick,
  ShieldCheck,
  Timer,
  Wrench,
} from 'lucide-react'
import {
  formatCurrency,
  formatLatency,
  formatNumber,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import {
  CreditBar,
  PageIntro,
  StatCard,
  StatusPill,
  UtilizationMeter,
} from '@/components/agent-workflow/dashboard/dashboard-ui'
import {
  getInstanceHealth,
  HEALTH_LABEL,
  HEALTH_TONE,
} from '@/components/agent-workflow/dashboard/instance-health'
import { usePublishedInstances } from '@/components/agent-workflow/dashboard/use-published-instances'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

export default function PerformancePage() {
  const { instances, overview } = usePublishedInstances()

  const breakdown = instances.reduce(
    (acc, item) => {
      acc.llm += item.metrics.creditBreakdown.llm
      acc.tools += item.metrics.creditBreakdown.tools
      acc.compute += item.metrics.creditBreakdown.compute
      acc.approval += item.metrics.creditBreakdown.approval
      acc.cpu += item.metrics.avgCpuPct
      acc.memory += item.metrics.avgMemoryMb
      acc.latency += item.metrics.avgLatencyMs
      acc.toolsCalls += item.metrics.totalToolCalls
      return acc
    },
    {
      llm: 0,
      tools: 0,
      compute: 0,
      approval: 0,
      cpu: 0,
      memory: 0,
      latency: 0,
      toolsCalls: 0,
    },
  )

  const count = instances.length || 1
  const avgCpu = Number((breakdown.cpu / count).toFixed(1))
  const avgMemory = Math.round(breakdown.memory / count)
  const avgLatency = Math.round(breakdown.latency / count)
  const estSpend = overview.totalCredits * 0.012

  const ranked = [...instances].sort(
    (a, b) => b.metrics.successRate - a.metrics.successRate,
  )

  return (
    <div>
      <PageIntro
        eyebrow="Performance"
        title="How your instances are running"
        description="Latency, success rate, credit burn, and resource load across the instances you published."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Success rate"
          value={`${overview.successRate}%`}
          hint={`${formatNumber(overview.succeeded)} / ${formatNumber(overview.totalRuns)} runs`}
          icon={ShieldCheck}
        />
        <StatCard
          label="Avg latency"
          value={instances.length ? formatLatency(avgLatency) : '—'}
          hint="Fleet average"
          icon={Timer}
        />
        <StatCard
          label="Credits used"
          value={formatNumber(overview.totalCredits)}
          hint={`Est. ${formatCurrency(estSpend)}`}
          icon={Coins}
        />
        <StatCard
          label="Tokens"
          value={formatNumber(overview.totalTokens)}
          hint={`${formatNumber(overview.failed)} failed runs`}
          icon={Hash}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border/70 bg-card p-5">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Credit burn
              </h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                {formatNumber(overview.totalCredits)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Est. {formatCurrency(estSpend)}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
              <Gauge className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            <CreditBar
              label="LLM"
              value={Number(breakdown.llm.toFixed(2))}
              total={overview.totalCredits}
              className="bg-red-500"
            />
            <CreditBar
              label="Tools"
              value={Number(breakdown.tools.toFixed(2))}
              total={overview.totalCredits}
              className="bg-rose-400"
            />
            <CreditBar
              label="Compute"
              value={Number(breakdown.compute.toFixed(2))}
              total={overview.totalCredits}
              className="bg-amber-500"
            />
            <CreditBar
              label="Approvals"
              value={Number(breakdown.approval.toFixed(2))}
              total={overview.totalCredits}
              className="bg-emerald-500"
            />
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-card p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resource load
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <UtilizationMeter
              label="Avg CPU"
              value={`${avgCpu}%`}
              pct={avgCpu}
              icon={Cpu}
            />
            <UtilizationMeter
              label="Avg memory"
              value={`${formatNumber(avgMemory)} MB`}
              pct={Math.min(100, (avgMemory / 1024) * 100)}
              icon={MemoryStick}
            />
            <UtilizationMeter
              label="Avg latency"
              value={formatLatency(avgLatency)}
              pct={Math.min(100, avgLatency / 50)}
              icon={Timer}
            />
            <UtilizationMeter
              label="Tool calls"
              value={formatNumber(breakdown.toolsCalls)}
              pct={Math.min(100, breakdown.toolsCalls / 2)}
              icon={Wrench}
            />
          </div>
        </section>
      </div>

      {ranked.length > 0 && (
        <section className="mt-6 rounded-lg border border-border/70 bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Instance leaderboard
            </h2>
            <Link
              to={ROUTES.agentWorkflowDashboardInstances}
              className="text-[11px] font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Open instances
            </Link>
          </div>
          <div className="space-y-2">
            {ranked.map((item, index) => {
              const health = getInstanceHealth(item)
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {item.workflowName}
                        </p>
                        <StatusPill status={item.status} />
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', HEALTH_TONE[health])}
                        >
                          {HEALTH_LABEL[health]}
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {item.instanceName}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-right text-[11px]">
                    <div>
                      <p className="font-semibold tabular-nums text-foreground">
                        {item.metrics.successRate}%
                      </p>
                      <p className="text-muted-foreground">success</p>
                    </div>
                    <div>
                      <p className="font-semibold tabular-nums text-foreground">
                        {formatLatency(item.metrics.avgLatencyMs)}
                      </p>
                      <p className="text-muted-foreground">latency</p>
                    </div>
                    <div>
                      <p className="font-semibold tabular-nums text-foreground">
                        {formatNumber(item.metrics.totalCredits)}
                      </p>
                      <p className="text-muted-foreground">credits</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
