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
  Wrench, GripVertical } from 'lucide-react'
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
      {/* Page header in the workspace style: large title, one-line summary, flat controls */}
      <div className="flex shrink-0 items-start gap-4 px-6 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-foreground">Deployments</h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Each deploy creates a new version — older versions stay listed separately.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-1.5" role="group" aria-label="Status">
          <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Status:</span>
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              aria-pressed={statusFilter === value}
              className={cn(
                'h-6 rounded-[2px] px-2 text-[11px] font-medium capitalize transition-colors',
                statusFilter === value ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-foreground/[0.07]',
              )}
            >
              {value === 'all' ? 'All' : value}
            </button>
          ))}
          <button
            type="button"
            onClick={onBackToCanvas}
            className="ml-3 flex h-6 items-center gap-1.5 rounded-[2px] bg-foreground/[0.045] px-2 text-[11px] text-foreground hover:bg-foreground/[0.09] [&_svg]:text-primary"
          >
            <PenLine className="h-3.5 w-3.5" />
            Back to canvas
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-2">
        {filtered.length === 0 ? (
          <section className="max-w-3xl rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
              <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
              <Rocket className="h-3.5 w-3.5 text-primary" />
              {instances.length === 0 ? 'No deployments yet' : 'No matches'}
            </h3>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              {instances.length === 0
                ? 'Validate and deploy a workflow — it will show up here with runs and logs.'
                : 'Try another status filter.'}
            </p>
            <button
              type="button"
              onClick={onBackToCanvas}
              className="mt-2.5 flex h-6 items-center gap-1.5 rounded-[2px] bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              <PenLine className="h-3.5 w-3.5" />
              Open canvas
            </button>
          </section>
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
        'overflow-hidden rounded-[3px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors',
        expanded && 'border-primary/50',
        !isCurrent && 'opacity-95',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-foreground/[0.03]"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[12.5px] font-semibold text-foreground">{item.workflowName}</h2>
            <StatusPill status={item.status} />
            {isCurrent ? (
              <Badge className="bg-primary text-[10px] font-semibold text-primary-foreground hover:bg-primary/90">
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
              className="border-foreground/30 bg-foreground/5 text-[10px] font-normal capitalize text-foreground dark:text-foreground"
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
        <div className="space-y-3 border-t border-border bg-muted/20 px-3 py-3">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={onCopyEndpoint}>
              <Copy className="h-3.5 w-3.5" />
              Copy endpoint
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onBackToCanvas}>
              <PenLine className="h-3.5 w-3.5" />
              Open canvas
            </Button>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
              <a href={item.endpointUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open endpoint
              </a>
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-[3px] border border-border bg-card px-3 py-2.5">
              <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

            <section className="rounded-[3px] border border-border bg-card px-3 py-2.5">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Credits & spend
                  </h3>
                  <p className="mt-2 text-[30px] font-light leading-none tabular-nums">
                    {formatNumber(item.metrics.totalCredits)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Est. {formatCurrency(estSpend)}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-[3px] text-primary">
                  <Coins className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <CreditBar
                  label="LLM"
                  value={item.metrics.creditBreakdown.llm}
                  total={item.metrics.totalCredits}
                  className="bg-primary"
                />
                <CreditBar
                  label="Tools"
                  value={item.metrics.creditBreakdown.tools}
                  total={item.metrics.totalCredits}
                  className="bg-primary"
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

          <section className="rounded-[3px] border border-border bg-card px-3 py-2.5">
            <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

          <section className="rounded-[3px] border border-border bg-card px-3 py-2.5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
