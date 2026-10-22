import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Gauge,
  Rocket,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from 'lucide-react'
import {
  formatLatency,
  formatNumber,
  formatWhen,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import {
  PageIntro,
  RunRow,
  StatusPill,
} from '@/components/agent-workflow/dashboard/dashboard-ui'
import {
  fleetHealthScore,
  getInstanceHealth,
  HEALTH_LABEL,
  HEALTH_TONE,
  type InstanceHealth,
} from '@/components/agent-workflow/dashboard/instance-health'
import { usePublishedInstances } from '@/components/agent-workflow/dashboard/use-published-instances'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'
import type { PublishedWorkflowInstance } from '@/services/published-instances-store'
import { cn } from '@/utils/cn'

function greetingForNow(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function OverviewPage() {
  const { session, instances, overview } = usePublishedInstances()
  const firstName = session?.displayName?.split(/\s+/)[0] || 'there'

  const avgLatency = useMemo(() => {
    if (instances.length === 0) return 0
    return Math.round(
      instances.reduce((sum, item) => sum + item.metrics.avgLatencyMs, 0) /
        instances.length,
    )
  }, [instances])

  const healthScore = fleetHealthScore(instances)
  const attention = instances
    .map((item) => ({ item, health: getInstanceHealth(item) }))
    .filter((row) => row.health !== 'healthy')
    .slice(0, 4)

  const recentAcross = instances
    .flatMap((item) =>
      item.recentRuns.slice(0, 2).map((run) => ({
        run,
        workflowName: item.workflowName,
      })),
    )
    .sort((a, b) => b.run.startedAt.localeCompare(a.run.startedAt))
    .slice(0, 5)

  return (
    <div>
      <PageIntro
        eyebrow="Console"
        title={`${greetingForNow()}, ${firstName}`}
        description="Your management console for published instances — health, success rate, latency, and spend."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to={ROUTES.agentWorkflowDashboardPerformance}>
                <Gauge className="h-3.5 w-3.5" />
                Performance
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-red-600 hover:bg-red-700">
              <Link to={ROUTES.agentWorkflowDashboardInstances}>
                My instances
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </>
        }
      />

      <section className="mb-5 overflow-hidden rounded-lg border border-border/70 bg-card">
        <div className="grid gap-0 lg:grid-cols-[1fr_1.35fr]">
          <div className="border-b border-border/60 p-4 lg:border-b-0 lg:border-r">
            <p className="text-[11px] font-medium text-muted-foreground">Fleet health</p>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
                {instances.length === 0 ? '—' : healthScore}
              </p>
              <div className="mb-0.5">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    healthScore >= 85
                      ? HEALTH_TONE.healthy
                      : healthScore >= 60
                        ? HEALTH_TONE.watch
                        : HEALTH_TONE.critical,
                  )}
                >
                  {instances.length === 0
                    ? 'No instances'
                    : healthScore >= 85
                      ? 'Stable'
                      : healthScore >= 60
                        ? 'Watch'
                        : 'At risk'}
                </Badge>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {overview.liveCount} live · {overview.instanceCount} total
                </p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-red-600 transition-all"
                style={{ width: `${instances.length === 0 ? 0 : healthScore}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Based on deploy status, success rate, and active waits.
            </p>
          </div>

          <div className="grid gap-px bg-border/60 sm:grid-cols-2">
            <KpiTile
              label="Success rate"
              value={`${overview.successRate}%`}
              hint={`${formatNumber(overview.succeeded)} succeeded`}
              icon={ShieldCheck}
            />
            <KpiTile
              label="Avg latency"
              value={instances.length ? formatLatency(avgLatency) : '—'}
              hint="Across my instances"
              icon={Timer}
            />
            <KpiTile
              label="Total runs"
              value={formatNumber(overview.totalRuns)}
              hint={`${formatNumber(overview.failed)} failed`}
              icon={Activity}
            />
            <KpiTile
              label="Credits used"
              value={formatNumber(overview.totalCredits)}
              hint={`${formatNumber(overview.totalTokens)} tokens`}
              icon={Gauge}
            />
          </div>
        </div>
      </section>

      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold text-foreground">Instance performance</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Success, latency, and load for each published endpoint.
          </p>
        </div>
        <Link
          to={ROUTES.agentWorkflowDashboardInstances}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          View all
        </Link>
      </div>

      {instances.length === 0 ? (
        <EmptyDeploy />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {instances.slice(0, 6).map((item) => (
            <InstancePerfCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-5">
        <section className="rounded-lg border border-border/70 bg-card p-3.5 lg:col-span-2">
          <div className="mb-2.5 flex items-center gap-2">
            <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-[11px] font-semibold text-muted-foreground">Needs attention</h2>
          </div>
          {attention.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              All tracked instances look healthy.
            </p>
          ) : (
            <div className="space-y-1.5">
              {attention.map(({ item, health }) => (
                <Link
                  key={item.id}
                  to={ROUTES.agentWorkflowDashboardInstances}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background p-2.5 transition-colors hover:border-red-400/50 hover:bg-red-500/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{item.workflowName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {item.metrics.successRate}% success ·{' '}
                      {formatLatency(item.metrics.avgLatencyMs)}
                    </p>
                  </div>
                  <HealthPill health={health} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border/70 bg-card p-3.5 lg:col-span-3">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold text-muted-foreground">Latest activity</h2>
            <Link
              to={ROUTES.agentWorkflowDashboardRuns}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              All activity
            </Link>
          </div>
          {recentAcross.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Runs show up here after your instances execute.
            </p>
          ) : (
            <div className="space-y-2">
              {recentAcross.map(({ run, workflowName }) => (
                <RunRow key={run.id} run={run} workflowName={workflowName} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Activity
}) {
  return (
    <div className="bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-1.5 text-lg font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function HealthPill({ health }: { health: InstanceHealth }) {
  return (
    <Badge variant="outline" className={cn('shrink-0 text-[10px]', HEALTH_TONE[health])}>
      {HEALTH_LABEL[health]}
    </Badge>
  )
}

function InstancePerfCard({ item }: { item: PublishedWorkflowInstance }) {
  const health = getInstanceHealth(item)
  const failPct =
    item.metrics.totalRuns === 0
      ? 0
      : Math.round((item.metrics.failed / item.metrics.totalRuns) * 100)

  return (
    <Link
      to={ROUTES.agentWorkflowDashboardInstances}
      className="group rounded-lg border border-border/70 bg-card p-3.5 transition-colors hover:border-red-400/50 hover:bg-red-500/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-foreground">
              {item.workflowName}
            </h3>
            <StatusPill status={item.status} />
            <HealthPill health={health} />
          </div>
          <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
            {item.instanceName}
            <span className="mx-1.5 text-border">·</span>
            v{item.version}
            <span className="mx-1.5 text-border">·</span>
            {item.region}
            <span className="mx-1.5 text-border">·</span>
            {formatWhen(item.deployedAt)}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Success" value={`${item.metrics.successRate}%`} />
        <Metric label="Latency" value={formatLatency(item.metrics.avgLatencyMs)} />
        <Metric label="Runs" value={formatNumber(item.metrics.totalRuns)} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>Run mix</span>
          <span>
            {formatNumber(item.metrics.succeeded)} ok · {formatNumber(item.metrics.failed)}{' '}
            fail
          </span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${Math.max(0, 100 - failPct)}%` }}
          />
          <div className="h-full bg-red-500" style={{ width: `${failPct}%` }} />
        </div>
      </div>
    </Link>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function EmptyDeploy() {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-card px-6 py-14 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-300">
        <Rocket className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">No instances to track yet</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground">
        Deploy a workflow from the designer. It will show up here so you can monitor
        performance, runs, and spend.
      </p>
      <Button asChild size="sm" className="mt-4 bg-red-600 hover:bg-red-700">
        <Link to={ROUTES.agentWorkflow}>
          Open designer
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  )
}
