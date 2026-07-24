import { memo, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Coins,
  Copy,
  Cpu,
  ExternalLink,
  Hash,
  MemoryStick,
  PenLine,
  Rocket,
  Sparkles,
  Timer,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  formatCurrency,
  formatLatency,
  formatNumber,
  formatWhen,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import {
  CreditBar,
  DetailRow,
  MetaChip,
  MiniStat,
  RunRow,
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
import { Button } from '@/components/ui/button'
import {
  isLatestPublishedInstance,
  type PublishedWorkflowInstance,
} from '@/services/published-instances-store'
import { cn } from '@/utils/cn'

const STATUS_FILTERS = ['all', 'deployed', 'failed'] as const

interface DeploymentsCanvasViewProps {
  onBackToCanvas: () => void
}

/** Full-canvas deployments board — metrics, resources, and recent run logs. */
export const DeploymentsCanvasView = memo(function DeploymentsCanvasView({
  onBackToCanvas,
}: DeploymentsCanvasViewProps) {
  const { instances } = usePublishedInstances()
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setExpandedId((current) => {
      if (current && instances.some((item) => item.id === current)) return current
      return instances[0]?.id ?? null
    })
  }, [instances])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return instances
    return instances.filter((item) => item.status === statusFilter)
  }, [instances, statusFilter])

  function copyEndpoint(url: string) {
    void navigator.clipboard.writeText(url).then(
      () => toast.success('Endpoint copied'),
      () => toast.error('Could not copy endpoint'),
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--canvas))]">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-card px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-300">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">Deployments</p>
          <p className="truncate text-[11px] text-muted-foreground">
            Each deploy creates a new version — older versions stay listed separately
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-medium capitalize transition-colors',
                statusFilter === value
                  ? 'bg-red-600 font-semibold text-white'
                  : 'border border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {value === 'all' ? 'All' : value}
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onBackToCanvas}>
          <PenLine className="h-3.5 w-3.5" />
          Back to canvas
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-red-500/10">
              <Rocket className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">
              {instances.length === 0 ? 'No deployments yet' : 'No matches'}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {instances.length === 0
                ? 'Validate and deploy a workflow — it will show up here with runs and logs.'
                : 'Try another status filter.'}
            </p>
            <Button type="button" size="sm" className="mt-5 bg-red-600 hover:bg-red-700" onClick={onBackToCanvas}>
              <PenLine className="h-3.5 w-3.5" />
              Open canvas
            </Button>
          </div>
        ) : (
          <div className="w-full space-y-3">
            {filtered.map((item) => (
              <InstanceDetailCard
                key={item.id}
                item={item}
                isCurrent={isLatestPublishedInstance(item, instances)}
                expanded={expandedId === item.id}
                onToggle={() =>
                  setExpandedId((current) => (current === item.id ? null : item.id))
                }
                onCopyEndpoint={() => copyEndpoint(item.endpointUrl)}
                onBackToCanvas={onBackToCanvas}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

function InstanceDetailCard({
  item,
  isCurrent,
  expanded,
  onToggle,
  onCopyEndpoint,
  onBackToCanvas,
}: {
  item: PublishedWorkflowInstance
  isCurrent: boolean
  expanded: boolean
  onToggle: () => void
  onCopyEndpoint: () => void
  onBackToCanvas: () => void
}) {
  const estSpend = item.metrics.totalCredits * 0.012
  const health = getInstanceHealth(item)

  return (
    <article
      className={cn(
        'overflow-hidden rounded-lg border border-border/70 bg-card transition-colors',
        expanded && 'border-red-500/30 ring-1 ring-red-500/10',
        !isCurrent && 'opacity-95',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-accent/25"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-foreground">{item.workflowName}</h2>
            <StatusPill status={item.status} />
            {isCurrent ? (
              <Badge className="bg-red-600 text-[10px] font-semibold text-white hover:bg-red-600">
                Current
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                Previous
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-[10px]', HEALTH_TONE[health])}>
              {HEALTH_LABEL[health]}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              v{item.version}
            </Badge>
            <Badge
              variant="outline"
              className="border-red-500/30 bg-red-500/5 text-[10px] font-normal capitalize text-red-700 dark:text-red-300"
            >
              {item.environment}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {item.region}
            </Badge>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {item.instanceName}
            <span className="mx-1.5 text-border">·</span>
            Deployed {formatWhen(item.deployedAt)}
            <span className="mx-1.5 text-border">·</span>
            {formatNumber(item.metrics.totalRuns)} runs
            <span className="mx-1.5 text-border">·</span>
            {item.metrics.successRate}% success
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <MetaChip icon={Sparkles} label={`${formatNumber(item.metrics.totalCredits)} credits`} />
            <MetaChip icon={Hash} label={`${formatNumber(item.metrics.totalTokens)} tokens`} />
            <MetaChip icon={Timer} label={formatLatency(item.metrics.avgLatencyMs)} />
            <MetaChip icon={Cpu} label={`${item.metrics.avgCpuPct}% CPU`} />
            <MetaChip
              icon={MemoryStick}
              label={`${formatNumber(item.metrics.avgMemoryMb)} MB`}
            />
          </div>
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-border bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={onCopyEndpoint}>
              <Copy className="h-3.5 w-3.5" />
              Copy endpoint
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onBackToCanvas}>
              <PenLine className="h-3.5 w-3.5" />
              Open canvas
            </Button>
            <Button asChild size="sm" className="bg-red-600 hover:bg-red-700">
              <a href={item.endpointUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open endpoint
              </a>
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Deployment
              </h3>
              <dl className="mt-3 space-y-2.5 text-[12px]">
                <DetailRow label="Endpoint" value={item.endpointUrl} mono />
                <DetailRow label="Method" value={item.triggerMethod} />
                <DetailRow label="Auth" value={item.authType} />
                <DetailRow label="Workflow ID" value={item.workflowId} mono />
                <DetailRow label="Workspace" value={item.workspaceId} mono />
                <DetailRow
                  label="Account type"
                  value={item.accountType === 'company' ? 'Company' : 'Individual'}
                />
              </dl>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Credits & spend
                  </h3>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                    {formatNumber(item.metrics.totalCredits)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Est. {formatCurrency(estSpend)}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                  <Coins className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <CreditBar
                  label="LLM"
                  value={item.metrics.creditBreakdown.llm}
                  total={item.metrics.totalCredits}
                  className="bg-red-500"
                />
                <CreditBar
                  label="Tools"
                  value={item.metrics.creditBreakdown.tools}
                  total={item.metrics.totalCredits}
                  className="bg-rose-400"
                />
                <CreditBar
                  label="Compute"
                  value={item.metrics.creditBreakdown.compute}
                  total={item.metrics.totalCredits}
                  className="bg-amber-500"
                />
                <CreditBar
                  label="Approvals"
                  value={item.metrics.creditBreakdown.approval}
                  total={item.metrics.totalCredits}
                  className="bg-emerald-500"
                />
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resource utilization
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <UtilizationMeter
                label="Avg CPU"
                value={`${item.metrics.avgCpuPct}%`}
                pct={item.metrics.avgCpuPct}
                icon={Cpu}
              />
              <UtilizationMeter
                label="Avg memory"
                value={`${formatNumber(item.metrics.avgMemoryMb)} MB`}
                pct={Math.min(100, (item.metrics.avgMemoryMb / 1024) * 100)}
                icon={MemoryStick}
              />
              <UtilizationMeter
                label="Avg latency"
                value={formatLatency(item.metrics.avgLatencyMs)}
                pct={Math.min(100, item.metrics.avgLatencyMs / 50)}
                icon={Timer}
              />
              <UtilizationMeter
                label="Tool calls"
                value={formatNumber(item.metrics.totalToolCalls)}
                pct={Math.min(100, item.metrics.totalToolCalls / 2)}
                icon={Wrench}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Succeeded" value={formatNumber(item.metrics.succeeded)} />
              <MiniStat label="Failed" value={formatNumber(item.metrics.failed)} />
              <MiniStat label="Waiting" value={formatNumber(item.metrics.waiting)} />
              <MiniStat label="Running" value={formatNumber(item.metrics.running)} />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent runs & logs
              </h3>
              <p className="text-[11px] text-muted-foreground">{item.recentRuns.length} latest</p>
            </div>
            <div className="space-y-2">
              {item.recentRuns.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </article>
  )
}
