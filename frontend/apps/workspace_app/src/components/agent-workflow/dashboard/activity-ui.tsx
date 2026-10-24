import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  formatCompact,
  formatNumber,
  RANGES,
  type RangeDays,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import type { DailyUsage } from '@/services/activity-api'
import { AgentsBodySkeleton } from '@/components/agent-workflow/dashboard/dashboard-skeletons'
import { cn } from '@/utils/cn'

function formatDay(iso: string, style: 'short' | 'long' = 'short'): string {
  const date = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat(undefined, style === 'short' ? { month: 'short', day: 'numeric' } : { dateStyle: 'medium' }).format(date)
}

/** Segmented control for the report window. */
export function RangeSelect({ value, onChange }: { value: RangeDays; onChange: (days: RangeDays) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border/70 bg-card p-0.5 shadow-sm" role="group" aria-label="Time range">
      {RANGES.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          aria-pressed={value === days}
          className={cn(
            'rounded-md px-3 py-1 text-[11.5px] font-medium tabular-nums transition-colors',
            value === days ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {days}d
        </button>
      ))}
    </div>
  )
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Tokens per day as one neutral bar series. Each bar has a hover and focus
 * tooltip with the exact counts, and the same figures are available as a table.
 */
export function DailyUsageChart({ daily }: { daily: DailyUsage[] }) {
  const [active, setActive] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const peak = Math.max(0, ...daily.map((day) => day.totalTokens))
  const labelEvery = Math.max(1, Math.ceil(daily.length / 6))

  if (asTable) {
    return (
      <div>
        <ViewToggle asTable onToggle={() => setAsTable(false)} />
        <div className="max-h-64 overflow-y-auto rounded-md border border-border/70">
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                {['Day', 'Calls', 'Input', 'Output', 'Total'].map((heading) => (
                  <th key={heading} className={cn('px-3 py-1.5 font-medium', heading === 'Day' ? 'text-left' : 'text-right')}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((day) => (
                <tr key={day.date} className="border-t border-border/50">
                  <td className="px-3 py-1.5 text-foreground">{formatDay(day.date, 'long')}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(day.calls)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(day.inputTokens)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(day.outputTokens)}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums text-foreground">{formatNumber(day.totalTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const shown = active !== null ? daily[active] : null
  return (
    <div>
      <ViewToggle asTable={false} onToggle={() => setAsTable(true)} />
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{peak > 0 ? formatCompact(peak) : ''}</span>
        </div>
        <div className="flex h-44 items-end gap-[2px] border-b border-border pt-4" onMouseLeave={() => setActive(null)}>
          {daily.map((day, index) => {
            const height = peak > 0 ? (day.totalTokens / peak) * 100 : 0
            return (
              <button
                key={day.date}
                type="button"
                className="group relative flex h-full min-w-0 flex-1 items-end focus-visible:outline-none"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${formatDay(day.date, 'long')}: ${formatNumber(day.totalTokens)} tokens`}
              >
                <span
                  className={cn(
                    'block w-full rounded-t-[4px] transition-colors',
                    day.totalTokens > 0 ? 'bg-foreground/70' : 'bg-transparent',
                    active === index && day.totalTokens > 0 && 'bg-foreground',
                    'group-focus-visible:ring-2 group-focus-visible:ring-ring',
                  )}
                  style={{ height: day.totalTokens > 0 ? `${Math.max(2, height)}%` : 0 }}
                />
              </button>
            )
          })}
        </div>
        {shown ? (
          <div
            className="pointer-events-none absolute -top-2 z-10 w-44 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-2 text-[11px] shadow-md"
            style={{ left: `${((active! + 0.5) / daily.length) * 100}%` }}
            role="status"
          >
            <p className="font-medium text-foreground">{formatDay(shown.date, 'long')}</p>
            <p className="mt-1 flex justify-between tabular-nums">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold text-foreground">{formatNumber(shown.totalTokens)}</span>
            </p>
            <p className="flex justify-between tabular-nums text-muted-foreground">
              <span>Input · output</span>
              <span>
                {formatCompact(shown.inputTokens)} · {formatCompact(shown.outputTokens)}
              </span>
            </p>
            <p className="flex justify-between tabular-nums text-muted-foreground">
              <span>Model calls</span>
              <span>{formatNumber(shown.calls)}</span>
            </p>
          </div>
        ) : null}
        <div className="mt-1.5 flex text-[10px] text-muted-foreground">
          {daily.map((day, index) => (
            <span key={day.date} className="min-w-0 flex-1 truncate text-center">
              {index % labelEvery === 0 || index === daily.length - 1 ? formatDay(day.date) : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ViewToggle({ asTable, onToggle }: { asTable: boolean; onToggle: () => void }) {
  return (
    <div className="-mt-1 mb-2 flex justify-end">
      <button type="button" onClick={onToggle} className="text-[11px] font-medium text-muted-foreground hover:text-foreground">
        {asTable ? 'Show chart' : 'Show table'}
      </button>
    </div>
  )
}

/** One row of a ranked breakdown: label, value, share of the total as a thin neutral bar. */
export function ShareRow({
  label,
  detail,
  value,
  total,
}: {
  label: string
  detail?: string
  value: number
  total: number
}) {
  const share = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[11.5px]">
        <span className="min-w-0 truncate">
          <span className="font-medium text-foreground">{label}</span>
          {detail ? <span className="ml-1.5 text-muted-foreground">{detail}</span> : null}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{formatCompact(value)}</span> · {share.toFixed(0)}%
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${share > 0 ? Math.max(1, share) : 0}%` }} />
      </div>
    </div>
  )
}

export function ReportState({
  isLoading,
  error,
  empty,
  icon: Icon,
  emptyTitle,
  emptyHint,
  skeleton,
}: {
  /** The page's own shape in shimmer; a generic table when omitted. */
  skeleton?: ReactNode
  isLoading: boolean
  error: string | null
  empty: boolean
  icon: LucideIcon
  emptyTitle: string
  emptyHint: string
}) {
  if (isLoading) {
    return <>{skeleton ?? <AgentsBodySkeleton />}</>
  }
  if (error) {
    return (
      <div className="rounded-lg border border-foreground/30 bg-foreground/5 px-4 py-6 text-[12px] text-foreground dark:text-foreground">
        {error}
      </div>
    )
  }
  if (!empty) return null
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border/80 bg-card px-4 py-12 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-[13px] font-medium text-foreground">{emptyTitle}</p>
      <p className="mt-1 max-w-sm text-[11.5px] text-muted-foreground">{emptyHint}</p>
    </div>
  )
}
