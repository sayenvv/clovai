import { memo, useEffect, useState } from 'react'
import { ChevronDown, GripVertical, Maximize2, Minimize2, RotateCcw } from 'lucide-react'
import type { DailyUsage } from '@/services/activity-api'
import { cn } from '@/utils/cn'

const WIDTH = 1000
const HEIGHT = 44

type Metric = 'calls' | 'totalTokens'

const SLIDE_MS = 280

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(value)
}

function dayLabel(iso: string, style: 'short' | 'long' = 'short'): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(
    undefined,
    style === 'short' ? { weekday: 'short', day: 'numeric' } : { weekday: 'long', month: 'short', day: 'numeric' },
  )
}

/** The line and area for one series, scaled into a width × height box. */
function paths(daily: DailyUsage[], metric: Metric, width: number, height: number, top: number) {
  const peak = Math.max(1, ...daily.map((day) => day[metric]))
  const points = daily.map((day, index) => {
    const x = daily.length === 1 ? width / 2 : (index / (daily.length - 1)) * width
    const y = height - (day[metric] / peak) * (height - top)
    return [x, y] as const
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = points.length ? `${line} L${width},${height} L0,${height} Z` : ''
  return { peak, points, line, area }
}

interface WorkflowTimelineProps {
  days: number
  daily: DailyUsage[]
  onRefresh: () => void
}

/**
 * The strip under the workspace: model calls per day over the window, with the busiest day's level
 * marked by a dashed line. Collapses to its header, or expands over the workspace with the full chart.
 */
export const WorkflowTimeline = memo(function WorkflowTimeline({ days, daily, onRefresh }: WorkflowTimelineProps) {
  // Starts folded to its one-line header; the chart opens on demand
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // Closing slides the panel back down before it unmounts
  const [closing, setClosing] = useState(false)
  const collapse = () => {
    setClosing(true)
    window.setTimeout(() => {
      setExpanded(false)
      setClosing(false)
    }, SLIDE_MS)
  }
  const total = daily.reduce((sum, day) => sum + day.calls, 0)
  const { peak, line, area } = paths(daily, 'calls', WIDTH, HEIGHT - 4, 8)

  useEffect(() => {
    if (!expanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collapse()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  if (expanded) {
    return <ExpandedTimeline days={days} daily={daily} onRefresh={onRefresh} onClose={collapse} closing={closing} />
  }

  return (
    <div className="shrink-0 border-t border-border bg-[hsl(var(--canvas))]">
      <div className="flex h-6 items-center pr-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-6 items-center gap-1.5 px-3 text-[10.5px] text-foreground/80 hover:text-foreground"
          aria-expanded={open}
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', !open && '-rotate-90')} />
          <span>Time:</span>
          <span className="text-primary">Last {days} days</span>
          <span className="ml-2 text-muted-foreground">· {total} model call{total === 1 ? '' : 's'}</span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="ml-auto flex h-5 w-5 items-center justify-center rounded-[2px] text-primary hover:bg-foreground/[0.07]"
          aria-label="Expand activity"
          title="Expand"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>
      {open ? (
        <div className="flex items-stretch gap-2 px-2 pb-1.5">
          <button
            type="button"
            onClick={onRefresh}
            className="flex w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Refresh activity"
            title="Refresh"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="relative min-w-0 flex-1 cursor-zoom-in border-x-2 border-primary/80 bg-primary/[0.07] text-left"
            aria-label="Expand activity"
          >
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="block h-11 w-full" aria-hidden>
              <line x1={0} x2={WIDTH} y1={8} y2={8} stroke="hsl(0 72% 50%)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              {area ? <path d={area} fill="hsl(var(--info) / 0.18)" /> : null}
              {line ? <path d={line} fill="none" stroke="hsl(var(--info))" strokeWidth={1.25} vectorEffect="non-scaling-stroke" /> : null}
            </svg>
            <div className="flex justify-between px-2 pb-0.5 text-[9px] text-muted-foreground">
              {daily.map((day, index) => (
                <span key={day.date} className={cn(index % 2 === 1 && daily.length > 8 && 'invisible')}>
                  {dayLabel(day.date)}
                </span>
              ))}
              {daily.length === 0 ? <span>No activity recorded</span> : null}
            </div>
          </button>
          <span className="flex shrink-0 items-start pt-1 text-[9px] font-semibold text-red-600 dark:text-red-400" title="Busiest day">
            <span className="rounded-sm border border-red-500/50 px-1">▲ {peak}</span>
          </span>
        </div>
      ) : null}
    </div>
  )
})

/** The timeline over the whole workspace: KPIs, a large chart with a day-by-day readout, and the table. */
function ExpandedTimeline({
  days,
  daily,
  onRefresh,
  onClose,
  closing,
}: {
  days: number
  daily: DailyUsage[]
  onRefresh: () => void
  onClose: () => void
  closing: boolean
}) {
  const [metric, setMetric] = useState<Metric>('calls')
  const [active, setActive] = useState<number | null>(null)
  const W = 1000
  const H = 300
  const { peak, points, line, area } = paths(daily, metric, W, H, 16)
  const calls = daily.reduce((sum, day) => sum + day.calls, 0)
  const tokens = daily.reduce((sum, day) => sum + day.totalTokens, 0)
  const busiest = daily.reduce<DailyUsage | null>((best, day) => (!best || day.calls > best.calls ? day : best), null)
  const shown = active !== null ? daily[active] : null

  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex flex-col bg-[hsl(var(--canvas))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] ease-out fill-mode-forwards',
        closing ? 'animate-out slide-out-to-bottom fade-out-0' : 'animate-in slide-in-from-bottom fade-in-0',
      )}
      style={{ animationDuration: `${SLIDE_MS}ms` }}
    >
      <div className="flex shrink-0 items-start gap-4 border-b border-border px-4 pb-2.5 pt-3 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.10)]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-foreground">Activity</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Model calls and tokens per day over the last {days} days, across all your workflows.
          </p>
        </div>
        <div className="flex items-center gap-1 pt-1">
          <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Show:</span>
          {(
            [
              ['calls', 'Calls'],
              ['totalTokens', 'Tokens'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMetric(id)}
              aria-pressed={metric === id}
              className={cn(
                'h-6 rounded-[2px] px-2 text-[11px] font-medium',
                metric === id ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-foreground/[0.07]',
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={onRefresh}
            className="ml-2 flex h-6 w-6 items-center justify-center rounded-[2px] text-primary hover:bg-foreground/[0.07]"
            aria-label="Refresh activity"
            title="Refresh"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-primary hover:bg-foreground/[0.07]"
            aria-label="Collapse activity"
            title="Collapse (Esc)"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Model calls', compact(calls), `Last ${days} days`],
            ['Tokens', compact(tokens), 'Input and output'],
            ['Busiest day', busiest && busiest.calls > 0 ? String(busiest.calls) : '—', busiest && busiest.calls > 0 ? dayLabel(busiest.date, 'long') : 'No calls'],
            ['Average', compact(Math.round(calls / Math.max(daily.length, 1))), 'Calls per day'],
          ].map(([label, value, hint]) => (
            <section key={label} className="rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <h3 className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
                <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
                {label}
              </h3>
              <p className="mt-2 text-[30px] font-light leading-none tabular-nums text-foreground">{value}</p>
              <p className="mt-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{hint}</p>
            </section>
          ))}
        </div>

        <section className="rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-foreground">
            <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
            {metric === 'calls' ? 'Model calls per day' : 'Tokens per day'}
            <span className="ml-auto text-[10px] font-normal tabular-nums text-muted-foreground">peak {compact(peak)}</span>
          </h3>
          <div className="relative" onMouseLeave={() => setActive(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[300px] w-full" aria-hidden>
              {[0.25, 0.5, 0.75].map((fraction) => (
                <line key={fraction} x1={0} x2={W} y1={H * fraction} y2={H * fraction} stroke="hsl(var(--border))" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              <line x1={0} x2={W} y1={16} y2={16} stroke="hsl(0 72% 50%)" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              {area ? <path d={area} fill="hsl(var(--info) / 0.16)" /> : null}
              {line ? <path d={line} fill="none" stroke="hsl(var(--info))" strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
              {active !== null && points[active] ? (
                <line x1={points[active][0]} x2={points[active][0]} y1={0} y2={H} stroke="hsl(var(--primary) / 0.5)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ) : null}
            </svg>
            {/* Hover bands, one per day */}
            <div className="absolute inset-0 flex">
              {daily.map((day, index) => (
                <button
                  key={day.date}
                  type="button"
                  className="h-full flex-1 focus-visible:outline-none"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  aria-label={`${dayLabel(day.date, 'long')}: ${day.calls} calls, ${day.totalTokens} tokens`}
                />
              ))}
            </div>
            {shown ? (
              <div
                className="pointer-events-none absolute top-2 z-10 w-48 -translate-x-1/2 rounded-[3px] border border-border bg-popover px-2.5 py-2 text-[11px] shadow-md"
                style={{ left: `${Math.min(90, Math.max(10, ((active! + 0.5) / daily.length) * 100))}%` }}
              >
                <p className="font-semibold text-foreground">{dayLabel(shown.date, 'long')}</p>
                <p className="mt-1 flex justify-between tabular-nums"><span className="text-muted-foreground">Calls</span><span>{shown.calls}</span></p>
                <p className="flex justify-between tabular-nums"><span className="text-muted-foreground">Tokens</span><span>{shown.totalTokens.toLocaleString()}</span></p>
                <p className="flex justify-between tabular-nums text-muted-foreground"><span>In · out</span><span>{compact(shown.inputTokens)} · {compact(shown.outputTokens)}</span></p>
              </div>
            ) : null}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            {daily.map((day) => (
              <span key={day.date}>{dayLabel(day.date)}</span>
            ))}
          </div>
        </section>

        <section className="rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-foreground">
            <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
            By day
          </h3>
          <table className="w-full text-[11.5px]">
            <thead className="text-muted-foreground">
              <tr>
                {['Day', 'Calls', 'Input', 'Output', 'Total tokens'].map((heading) => (
                  <th key={heading} className={cn('px-2 py-1.5 font-medium', heading === 'Day' ? 'text-left' : 'text-right')}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((day) => (
                <tr key={day.date} className="border-t border-border/60">
                  <td className="px-2 py-1.5 text-foreground">{dayLabel(day.date, 'long')}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{day.calls}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{day.inputTokens.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{day.outputTokens.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums text-foreground">{day.totalTokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
