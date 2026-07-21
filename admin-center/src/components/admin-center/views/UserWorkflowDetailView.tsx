import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Coins,
  Cpu,
  Gauge,
  HardDrive,
  Hash,
  Loader2,
  MemoryStick,
  Network,
  OctagonAlert,
  PauseCircle,
  Sparkles,
  Timer,
  Wrench,
  XCircle,
} from 'lucide-react'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { FilterChips } from '@/components/admin-center/FilterChips'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatCard } from '@/components/admin-center/StatCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { WorkflowDiagramCanvas } from '@/components/admin-center/WorkflowDiagramCanvas'
import {
  EXECUTION_STATUS_TONE,
  LOG_LEVEL_TONE,
  WORKFLOW_STATUS_TONE,
} from '@/components/admin-center/status-tones'
import {
  formatCurrency,
  formatNumber,
  getUser,
  getUserWorkflow,
  getWorkflowDiagram,
  getWorkflowExecutions,
  getWorkflowTrackingStats,
  type ExecutionCredits,
  type ExecutionResources,
  type WorkflowExecution,
  type WorkflowExecutionStatus,
} from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'
import { formatCompute, formatDuration } from '@/utils/format'
import { cn } from '@/utils/cn'

const STATUS_FILTERS: Array<'all' | WorkflowExecutionStatus> = [
  'all',
  'succeeded',
  'failed',
  'waiting_approval',
  'running',
  'cancelled',
]

export function UserWorkflowDetailView() {
  const { userId = '', workflowId = '' } = useParams()
  const user = getUser(userId)
  const workflow = getUserWorkflow(userId, workflowId)
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const diagram = useMemo(
    () => (workflow ? getWorkflowDiagram(workflow.id) : null),
    [workflow],
  )

  const tracking = useMemo(() => {
    if (!user || !workflow) return null
    return getWorkflowTrackingStats(user.id, workflow.id)
  }, [user, workflow])

  const executions = useMemo(() => {
    if (!user || !workflow) return []
    return getWorkflowExecutions(user.id, workflow.id).filter((execution) => {
      if (statusFilter !== 'all' && execution.status !== statusFilter) return false
      if (
        selectedNodeId &&
        !execution.steps.some((step) => step.nodeId === selectedNodeId)
      ) {
        return false
      }
      return true
    })
  }, [user, workflow, statusFilter, selectedNodeId])

  if (!user || !workflow || !diagram || !tracking) {
    return <Navigate to={user ? ROUTES.user(user.id) : ROUTES.users} replace />
  }

  const creditTotal =
    tracking.creditBreakdown.llm +
    tracking.creditBreakdown.tools +
    tracking.creditBreakdown.compute +
    tracking.creditBreakdown.approval
  const avgCredits =
    tracking.executionCount === 0
      ? 0
      : Number((tracking.totalCredits / tracking.executionCount).toFixed(2))

  return (
    <>
      <PageHeader
        title={workflow.name}
        description={`${user.name} · execution tracking, resources & credits`}
        actions={
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]">
            <Link to={ROUTES.user(user.id)}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to user
            </Link>
          </Button>
        }
      />
      <PageBody className="space-y-5">
        <PremiumCard className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={workflow.status} tone={WORKFLOW_STATUS_TONE[workflow.status]} />
              <StatusBadge label={workflow.model} tone="violet" />
              <span className="text-[11.5px] text-muted-foreground">
                {formatNumber(workflow.agents)} agents · {formatNumber(tracking.executionCount)}{' '}
                tracked runs
                {tracking.failed ? ` · ${tracking.failed} failed` : ''}
                {tracking.waiting ? ` · ${tracking.waiting} waiting` : ''}
              </span>
            </div>
            <div className="text-[12px] font-semibold tabular-nums text-foreground">
              Est. {formatCurrency(workflow.estimatedMonthlyUsd)}
              <span className="ml-1 font-normal text-muted-foreground">/ month</span>
            </div>
          </div>
          <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">
            {workflow.description}
          </p>
        </PremiumCard>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Executions"
            value={formatNumber(tracking.executionCount)}
            hint={`${tracking.succeeded} ok · ${tracking.failed} failed · ${tracking.running} live`}
            icon={Activity}
            tone="primary"
          />
          <StatCard
            label="Success rate"
            value={`${tracking.successRate}%`}
            hint={
              tracking.waiting
                ? `${tracking.waiting} awaiting approval`
                : 'completed vs total runs'
            }
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            label="Credits used"
            value={formatNumber(tracking.totalCredits)}
            hint={`avg ${formatNumber(avgCredits)} / run`}
            icon={Sparkles}
            tone="violet"
          />
          <StatCard
            label="Est. spend"
            value={formatCurrency(tracking.totalCostUsd)}
            hint={`${formatNumber(tracking.totalTokens)} tokens total`}
            icon={Coins}
            tone="warning"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <PremiumCard className="p-5 xl:col-span-3">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Resource utilization</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Aggregate load across all tracked executions for this workflow
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/0 text-primary ring-1 ring-border/60">
                <Gauge className="h-4 w-4" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UtilizationMeter
                label="Avg peak CPU"
                valueLabel={`${tracking.avgCpuPct}%`}
                pct={tracking.avgCpuPct}
                icon={Cpu}
              />
              <UtilizationMeter
                label="Avg peak memory"
                valueLabel={`${formatNumber(tracking.avgMemoryMb)} MB`}
                pct={Math.min(100, (tracking.avgMemoryMb / 1024) * 100)}
                icon={MemoryStick}
                hint="of 1024 MB worker limit"
              />
              <UtilizationMeter
                label="Token throughput"
                valueLabel={formatNumber(tracking.totalTokens)}
                pct={Math.min(100, tracking.totalTokens / 80)}
                icon={Hash}
                hint="prompt + completion across runs"
              />
              <UtilizationMeter
                label="Compute time"
                valueLabel={formatCompute(tracking.totalComputeSeconds)}
                pct={Math.min(100, tracking.totalComputeSeconds / 2.4)}
                icon={Timer}
                hint={`${formatNumber(tracking.totalToolCalls)} tool calls`}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniMetric
                label="Tool calls"
                value={formatNumber(tracking.totalToolCalls)}
                icon={Wrench}
              />
              <MiniMetric
                label="Avg CPU"
                value={`${tracking.avgCpuPct}%`}
                icon={Cpu}
              />
              <MiniMetric
                label="Avg memory"
                value={`${formatNumber(tracking.avgMemoryMb)} MB`}
                icon={HardDrive}
              />
              <MiniMetric
                label="Compute"
                value={formatCompute(tracking.totalComputeSeconds)}
                icon={Timer}
              />
            </div>
          </PremiumCard>

          <PremiumCard className="p-5 xl:col-span-2">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Credit breakdown</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Where platform credits were spent
              </p>
            </div>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total utilized
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                  {formatNumber(tracking.totalCredits)}
                </p>
              </div>
              <p className="pb-1 text-[11px] text-muted-foreground">
                {formatCurrency(tracking.totalCostUsd)} est. USD
              </p>
            </div>
            <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="flex h-full w-full">
                <CreditSegment
                  pct={creditShare(tracking.creditBreakdown.llm, creditTotal)}
                  className="bg-violet-500"
                />
                <CreditSegment
                  pct={creditShare(tracking.creditBreakdown.tools, creditTotal)}
                  className="bg-sky-500"
                />
                <CreditSegment
                  pct={creditShare(tracking.creditBreakdown.compute, creditTotal)}
                  className="bg-amber-500"
                />
                <CreditSegment
                  pct={creditShare(tracking.creditBreakdown.approval, creditTotal)}
                  className="bg-emerald-500"
                />
              </div>
            </div>
            <div className="space-y-2.5">
              <CreditRow
                label="LLM / tokens"
                value={tracking.creditBreakdown.llm}
                total={creditTotal}
                swatch="bg-violet-500"
              />
              <CreditRow
                label="Tools & network"
                value={tracking.creditBreakdown.tools}
                total={creditTotal}
                swatch="bg-sky-500"
              />
              <CreditRow
                label="Compute"
                value={tracking.creditBreakdown.compute}
                total={creditTotal}
                swatch="bg-amber-500"
              />
              <CreditRow
                label="Approvals"
                value={tracking.creditBreakdown.approval}
                total={creditTotal}
                swatch="bg-emerald-500"
              />
            </div>
          </PremiumCard>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Workflow diagram</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Read-only user view · click a node to filter executions that touched it
              </p>
            </div>
            {selectedNodeId && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => setSelectedNodeId(null)}
              >
                Clear node filter
              </Button>
            )}
          </div>
          <WorkflowDiagramCanvas
            diagram={diagram}
            highlightedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            className="min-h-[260px] max-h-[420px]"
          />
        </div>

        <PremiumCard className="p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Execution runs</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Expand a run for credits, resource meters, and step-by-step logs
              </p>
            </div>
            <FilterChips
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={setStatusFilter}
              size="sm"
              label={(value) => (value === 'waiting_approval' ? 'waiting' : value)}
            />
          </div>

          {executions.length === 0 ? (
            <EmptyHint
              title="No executions match"
              hint="Try another status filter or clear the diagram node filter."
            />
          ) : (
            <div className="space-y-2">
              {executions.map((execution) => (
                <ExecutionRow
                  key={execution.id}
                  execution={execution}
                  expanded={expandedId === execution.id}
                  selectedNodeId={selectedNodeId}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === execution.id ? null : execution.id,
                    )
                  }
                  onSelectNode={setSelectedNodeId}
                />
              ))}
            </div>
          )}
        </PremiumCard>
      </PageBody>
    </>
  )
}

function ExecutionRow({
  execution,
  expanded,
  selectedNodeId,
  onToggle,
  onSelectNode,
}: {
  execution: WorkflowExecution
  expanded: boolean
  selectedNodeId: string | null
  onToggle: () => void
  onSelectNode: (nodeId: string | null) => void
}) {
  const StatusIcon = EXEC_ICON[execution.status]
  const errorSteps = execution.steps.filter((step) => step.level === 'error').length
  const warnSteps = execution.steps.filter((step) => step.level === 'warn').length
  const memPct = Math.min(
    100,
    (execution.resources.memoryMb / execution.resources.memoryLimitMb) * 100,
  )

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/70 bg-background/50 transition-colors',
        expanded && 'border-primary/30 bg-card/80 shadow-sm',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left hover:bg-accent/25"
        aria-expanded={expanded}
      >
        <StatusIcon className={cn('mt-0.5 h-4 w-4 shrink-0', EXEC_ICON_COLOR[execution.status])} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-semibold text-foreground">
              {execution.runId}
            </span>
            <StatusBadge
              label={execution.status.replace('_', ' ')}
              tone={EXECUTION_STATUS_TONE[execution.status]}
            />
            <span className="text-[10.5px] text-muted-foreground">{execution.startedAt}</span>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {execution.durationLabel}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] font-medium leading-snug text-foreground">
            {execution.summary}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Trigger · {execution.trigger}
            {(errorSteps > 0 || warnSteps > 0) && (
              <span className="ml-2">
                {errorSteps > 0 ? `${errorSteps} error${errorSteps === 1 ? '' : 's'}` : ''}
                {errorSteps > 0 && warnSteps > 0 ? ' · ' : ''}
                {warnSteps > 0 ? `${warnSteps} warning${warnSteps === 1 ? '' : 's'}` : ''}
              </span>
            )}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <RunChip
              icon={Sparkles}
              label={`${formatNumber(execution.credits.total)} credits`}
              emphasis
            />
            <RunChip icon={Coins} label={formatCurrency(execution.estimatedCostUsd)} />
            <RunChip icon={Hash} label={`${formatNumber(execution.tokens)} tokens`} />
            <RunChip icon={Cpu} label={`${execution.resources.cpuPct}% CPU`} />
            <RunChip
              icon={MemoryStick}
              label={`${formatNumber(execution.resources.memoryMb)} MB`}
            />
            <RunChip icon={Wrench} label={`${execution.resources.toolCalls} tools`} />
          </div>
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border/60 bg-muted/20 px-3.5 py-3.5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card/80 p-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Credits this run
                </p>
                <span className="text-[13px] font-semibold tabular-nums text-foreground">
                  {formatNumber(execution.credits.total)}
                </span>
              </div>
              <RunCreditBars credits={execution.credits} />
            </div>
            <div className="rounded-xl border border-border/60 bg-card/80 p-3.5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Resources this run
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {formatCompute(execution.resources.computeSeconds)} compute
                </span>
              </div>
              <RunResourceMeters resources={execution.resources} memPct={memPct} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Detailed logs
              </p>
              {execution.finishedAt && (
                <p className="text-[10.5px] text-muted-foreground">
                  Finished {execution.finishedAt}
                </p>
              )}
            </div>
            <ol className="relative space-y-0 border-l border-border/70 pl-4">
              {execution.steps.map((step, index) => {
                const active = selectedNodeId != null && step.nodeId === selectedNodeId
                return (
                  <li key={step.id} className="relative pb-4 last:pb-0">
                    <span
                      className={cn(
                        'absolute -left-[1.28rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                        step.level === 'error' && 'bg-destructive',
                        step.level === 'warn' && 'bg-amber-500',
                        step.level === 'success' && 'bg-emerald-500',
                        step.level === 'info' && 'bg-sky-500',
                      )}
                    />
                    <button
                      type="button"
                      className={cn(
                        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'border-primary/40 bg-primary/[0.06] ring-1 ring-primary/15'
                          : 'border-border/60 bg-card/70 hover:bg-accent/30',
                      )}
                      onClick={() =>
                        onSelectNode(
                          step.nodeId
                            ? selectedNodeId === step.nodeId
                              ? null
                              : step.nodeId
                            : null,
                        )
                      }
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Step {index + 1}
                        </span>
                        <StatusBadge label={step.level} tone={LOG_LEVEL_TONE[step.level]} />
                        {step.nodeLabel && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                            {step.nodeLabel}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {step.at}
                        </span>
                        {typeof step.durationMs === 'number' && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDuration(step.durationMs)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-foreground">
                        {step.message}
                      </p>
                      {step.detail && (
                        <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                          {step.detail}
                        </p>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

function UtilizationMeter({
  label,
  valueLabel,
  pct,
  icon: Icon,
  hint,
}: {
  label: string
  valueLabel: string
  pct: number
  icon: typeof Cpu
  hint?: string
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">
            {valueLabel}
          </p>
        </div>
        <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-[width]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {hint && <p className="mt-2 text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Cpu
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-1 text-[12.5px] font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function CreditSegment({ pct, className }: { pct: number; className: string }) {
  if (pct <= 0) return null
  return <div className={cn('h-full', className)} style={{ width: `${pct}%` }} />
}

function CreditRow({
  label,
  value,
  total,
  swatch,
}: {
  label: string
  value: number
  total: number
  swatch: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', swatch)} />
        <span className="truncate text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2 tabular-nums">
        <span className="font-semibold text-foreground">{formatNumber(value)}</span>
        <span className="w-10 text-right text-[10.5px] text-muted-foreground">
          {creditShare(value, total).toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

function RunChip({
  icon: Icon,
  label,
  emphasis,
}: {
  icon: typeof Sparkles
  label: string
  emphasis?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px]',
        emphasis
          ? 'border-primary/25 bg-primary/[0.07] font-semibold text-foreground'
          : 'border-border/60 bg-muted/40 text-muted-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function RunCreditBars({ credits }: { credits: ExecutionCredits }) {
  const rows: Array<{ label: string; value: number; className: string }> = [
    { label: 'LLM', value: credits.llm, className: 'bg-violet-500' },
    { label: 'Tools', value: credits.tools, className: 'bg-sky-500' },
    { label: 'Compute', value: credits.compute, className: 'bg-amber-500' },
    { label: 'Approval', value: credits.approval, className: 'bg-emerald-500' },
  ]
  const max = Math.max(...rows.map((row) => row.value), 0.01)

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatNumber(row.value)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', row.className)}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function RunResourceMeters({
  resources,
  memPct,
}: {
  resources: ExecutionResources
  memPct: number
}) {
  return (
    <div className="space-y-2.5">
      <ResourceLine
        icon={Cpu}
        label="CPU peak"
        value={`${resources.cpuPct}%`}
        pct={resources.cpuPct}
      />
      <ResourceLine
        icon={MemoryStick}
        label="Memory"
        value={`${formatNumber(resources.memoryMb)} / ${formatNumber(resources.memoryLimitMb)} MB`}
        pct={memPct}
      />
      <ResourceLine
        icon={Hash}
        label="Tokens"
        value={`${formatNumber(resources.promptTokens)} + ${formatNumber(resources.completionTokens)}`}
        pct={Math.min(100, (resources.promptTokens + resources.completionTokens) / 40)}
      />
      <ResourceLine
        icon={Network}
        label="Network"
        value={`${formatNumber(resources.networkKb)} KB · ${resources.toolCalls} tools`}
        pct={Math.min(100, resources.networkKb / 12)}
      />
    </div>
  )
}

function ResourceLine({
  icon: Icon,
  label,
  value,
  pct,
}: {
  icon: typeof Cpu
  label: string
  value: string
  pct: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="font-medium tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/80"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  )
}

const EXEC_ICON = {
  succeeded: CheckCircle2,
  failed: XCircle,
  running: Loader2,
  waiting_approval: PauseCircle,
  cancelled: OctagonAlert,
} as const

const EXEC_ICON_COLOR = {
  succeeded: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-destructive',
  running: 'text-sky-600 dark:text-sky-400',
  waiting_approval: 'text-amber-600 dark:text-amber-400',
  cancelled: 'text-muted-foreground',
} as const

function creditShare(value: number, total: number): number {
  if (total <= 0) return 0
  return (value / total) * 100
}
