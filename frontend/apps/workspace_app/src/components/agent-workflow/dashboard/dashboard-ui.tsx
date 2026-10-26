import type { ReactNode } from 'react'
import { GripVertical, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  loading = false,
}: {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  /** Shimmer in place of the value and hint while the numbers load. */
  loading?: boolean
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[3px] border border-border bg-card px-3 py-2.5',
        'shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,transform] duration-200',
        
      )}
    >
      {/* As the reference's cards: a grip, the bold title, and the icon on the right */}
      <div className="relative flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
          <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      {loading ? (
        <div className="relative mt-3 space-y-2.5" role="status" aria-label={`Loading ${label}`}>
          <Skeleton className="h-[26px] w-24 rounded-[3px]" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <>
          <p className="relative mt-3 truncate text-[30px] font-light leading-none tracking-[-0.02em] tabular-nums text-foreground">
            {value}
          </p>
          <p className="relative mt-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{hint}</p>
        </>
      )}
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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</span>
        ) : null}
        <h1 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-foreground">{title}</h1>
        <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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
          : 'border-foreground/40 bg-foreground/10 text-foreground dark:text-foreground',
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
    <div className="rounded-[3px] border border-border/70 bg-background/60 px-3 py-2.5">
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
    <div className="rounded-[3px] border border-border bg-background/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  )
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[3px] border border-border bg-muted/40 px-2.5 py-2">
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

/** A settings block: what it is on the left, its fields on the right, and a footer for the action. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  tone = 'default',
}: {
  title: string
  description: ReactNode
  children?: ReactNode
  /** Usually a hint on the left and the save button on the right. */
  footer?: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[3px] border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        tone === 'danger' ? 'border-destructive/35' : 'border-border/70',
      )}
    >
      <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8 md:p-6">
        <div>
          <h2 className={cn('text-[13.5px] font-semibold tracking-tight', tone === 'danger' ? 'text-destructive' : 'text-foreground')}>
            {title}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {children ? <div className="min-w-0 space-y-4">{children}</div> : null}
      </div>
      {footer ? (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 md:px-6',
            tone === 'danger' ? 'border-destructive/25 bg-destructive/[0.04]' : 'border-border/70 bg-muted/40',
          )}
        >
          {footer}
        </div>
      ) : null}
    </section>
  )
}

/** Placeholder rows for a list that is loading (models, variables, workflows). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="divide-y divide-border/70 overflow-hidden rounded-[3px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-5 py-3.5">
          <Skeleton className="size-8 shrink-0 rounded-[3px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5" style={{ width: `${38 - index * 5}%` }} />
            <Skeleton className="h-2.5" style={{ width: `${55 - index * 4}%` }} />
          </div>
          <Skeleton className="hidden h-3 w-20 sm:block" />
          <Skeleton className="size-8 rounded-[3px]" />
        </div>
      ))}
    </div>
  )
}
