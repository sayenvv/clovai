import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  formatCurrency,
  formatNumber,
  formatWhen,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import type {
  PublishedInstanceRun,
  PublishedInstanceStatus,
  PublishedRunStatus,
} from '@/services/published-instances-store'
import { cn } from '@/utils/cn'

export const RUN_TONE: Record<PublishedRunStatus, string> = {
  succeeded: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  running: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  waiting_approval: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  cancelled: 'border-border bg-muted text-muted-foreground',
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: LucideIcon
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-300">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-0.5 text-base font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
    </div>
  )
}

export function StatusPill({ status }: { status: PublishedInstanceStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-normal capitalize',
        status === 'deployed'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
      )}
    >
      {status}
    </Badge>
  )
}

export function RunRow({
  run,
  workflowName,
}: {
  run: PublishedInstanceRun
  workflowName?: string
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] font-semibold text-foreground">{run.runId}</span>
        <Badge variant="outline" className={cn('text-[10px] capitalize', RUN_TONE[run.status])}>
          {run.status.replace('_', ' ')}
        </Badge>
        {workflowName ? (
          <span className="text-[10.5px] font-medium text-foreground/80">{workflowName}</span>
        ) : null}
        <span className="text-[10.5px] text-muted-foreground">{formatWhen(run.startedAt)}</span>
        <span className="text-[10.5px] text-muted-foreground">{run.durationLabel}</span>
      </div>
      <p className="mt-1 text-[12px] font-medium text-foreground">{run.summary}</p>
      <div className="mt-1.5 flex flex-wrap gap-3 text-[10.5px] text-muted-foreground">
        <span>{formatNumber(run.tokens)} tokens</span>
        <span>{formatNumber(run.credits)} credits</span>
        <span>{formatCurrency(run.costUsd)}</span>
        <span>{run.cpuPct}% CPU</span>
        <span>{formatNumber(run.memoryMb)} MB</span>
      </div>
    </div>
  )
}

export function CreditBar({
  label,
  value,
  total,
  className,
}: {
  label: string
  value: number
  total: number
  className: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {formatNumber(value)} · {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', className)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function UtilizationMeter({
  label,
  value,
  pct,
  icon: Icon,
}: {
  label: string
  value: string
  pct: number
  icon: LucideIcon
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-red-600"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  )
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[12.5px] font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

export function MetaChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-right font-medium text-foreground break-all',
          mono && 'font-mono text-[11px]',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
