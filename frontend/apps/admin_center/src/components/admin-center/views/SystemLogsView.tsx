import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Fingerprint,
  RefreshCw,
  ScrollText,
  X,
  XCircle,
} from 'lucide-react'
import { errorMessage } from '@/api/config'
import {
  getSystemLog,
  getSystemLogSummary,
  listSystemLogs,
  type LogLevel,
  type SystemLog,
  type SystemLogDetail,
  type SystemLogSummary,
} from '@/api/system-logs'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { FilterChips } from '@/components/admin-center/FilterChips'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { SearchInput } from '@/components/admin-center/SearchInput'
import { StatCard } from '@/components/admin-center/StatCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { Button } from '@/components/ui/button'
import { AGENT_WORKFLOW_URL } from '@/constants'
import { cn } from '@/utils/cn'

const RANGES = ['1h', '24h', '7d', '30d'] as const
type Range = (typeof RANGES)[number]
const RANGE_HOURS: Record<Range, number> = { '1h': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }

const LEVEL_FILTERS = ['all', 'errors', 'critical'] as const
type LevelFilter = (typeof LEVEL_FILTERS)[number]
const LEVEL_FILTER_MIN: Record<LevelFilter, LogLevel> = { all: 'WARNING', errors: 'ERROR', critical: 'CRITICAL' }
const LEVEL_FILTER_LABEL: Record<LevelFilter, string> = { all: 'Warnings & up', errors: 'Errors & up', critical: 'Critical' }

/** Status colours: warning amber, error red, critical deep red; each also has its own icon. */
const LEVEL_META: Record<LogLevel, { tone: 'warning' | 'danger'; bar: string; icon: typeof AlertTriangle; label: string }> = {
  WARNING: { tone: 'warning', bar: 'bg-amber-500', icon: AlertTriangle, label: 'Warning' },
  ERROR: { tone: 'danger', bar: 'bg-red-500', icon: XCircle, label: 'Error' },
  CRITICAL: { tone: 'danger', bar: 'bg-red-800 dark:bg-red-400', icon: AlertOctagon, label: 'Critical' },
}

const traceUrl = (traceId: string) => `${AGENT_WORKFLOW_URL}/dashboard/traces/${encodeURIComponent(traceId)}`

function when(iso: string): string {
  const date = new Date(iso)
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function LevelBadge({ level }: { level: LogLevel }) {
  const meta = LEVEL_META[level] ?? LEVEL_META.WARNING
  return (
    <span className="inline-flex items-center gap-1">
      <meta.icon className={cn('h-3 w-3', meta.tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-destructive')} />
      <StatusBadge label={meta.label} tone={meta.tone} />
    </span>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true)
          window.setTimeout(() => setDone(false), 1200)
        })
      }}
      className="inline-flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      aria-label={`Copy ${label}`}
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

/** Stacked columns of warnings, errors and critical records over the chosen range. */
function Timeline({ summary }: { summary: SystemLogSummary }) {
  const [hover, setHover] = useState<number | null>(null)
  const points = summary.timeline
  const max = Math.max(1, ...points.map((point) => point.WARNING + point.ERROR + point.CRITICAL))
  const daily = summary.hours > 72
  const label = (iso: string) =>
    daily
      ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const active = hover !== null ? points[hover] : null

  return (
    <PremiumCard className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[12.5px] font-semibold">Over time</h2>
          <p className="text-[11px] text-muted-foreground">
            {active
              ? `${label(active.time)} · ${active.CRITICAL} critical · ${active.ERROR} errors · ${active.WARNING} warnings`
              : `Records per ${daily ? 'day' : 'hour'}. Hover a column for its counts.`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
          {(['CRITICAL', 'ERROR', 'WARNING'] as LogLevel[]).map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-sm', LEVEL_META[level].bar)} aria-hidden />
              {LEVEL_META[level].label}
            </span>
          ))}
        </div>
      </div>
      {points.length === 0 ? (
        <p className="py-8 text-center text-[11.5px] text-muted-foreground">Nothing recorded in this range.</p>
      ) : (
        <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
          <div className="relative h-28 text-right text-[9.5px] tabular-nums text-muted-foreground">
            <span className="absolute right-0 top-0 -translate-y-1/2">{max}</span>
            <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
          </div>
          <div>
            <div className="relative flex h-28 items-end gap-[2px] border-b border-border" onMouseLeave={() => setHover(null)}>
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border/60" aria-hidden />
              <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border/50" aria-hidden />
              {points.map((point, index) => {
                const total = point.WARNING + point.ERROR + point.CRITICAL
                return (
                  <div
                    key={point.time}
                    className="flex h-full min-w-[4px] flex-1 flex-col justify-end"
                    onMouseEnter={() => setHover(index)}
                  >
                    <div
                      className={cn('flex flex-col-reverse gap-[1px] overflow-hidden rounded-t-[3px]', hover === index && 'opacity-80')}
                      style={{ height: `${(total / max) * 100}%` }}
                    >
                      {(['WARNING', 'ERROR', 'CRITICAL'] as LogLevel[]).map((level) =>
                        point[level] > 0 ? (
                          <span key={level} className={cn('w-full', LEVEL_META[level].bar)} style={{ flexGrow: point[level], flexBasis: 0 }} />
                        ) : null,
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-1 flex justify-between text-[9.5px] text-muted-foreground">
              <span>{label(points[0].time)}</span>
              <span>{label(points[points.length - 1].time)}</span>
            </div>
          </div>
        </div>
      )}
    </PremiumCard>
  )
}

/** The failures that repeat most, each a filter for the list below. */
function TopFailures({
  summary,
  active,
  onPick,
}: {
  summary: SystemLogSummary
  active: string | null
  onPick: (fingerprint: string | null) => void
}) {
  if (summary.top_errors.length === 0) return null
  const max = Math.max(1, ...summary.top_errors.map((group) => group.count))
  return (
    <PremiumCard className="p-4">
      <h2 className="text-[12.5px] font-semibold">Most frequent failures</h2>
      <p className="mb-3 text-[11px] text-muted-foreground">The same error from the same place, counted together. Pick one to see only it.</p>
      <ul className="divide-y divide-border/60">
        {summary.top_errors.map((group) => {
          const sample = group.sample
          const picked = active === group.fingerprint
          return (
            <li key={group.fingerprint}>
              <button
                type="button"
                onClick={() => onPick(picked ? null : group.fingerprint)}
                className={cn(
                  'grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[2px] px-2 py-2 text-left transition-colors',
                  picked ? 'bg-accent' : 'hover:bg-accent/50',
                )}
              >
                <span className="grid gap-1">
                  <span className="text-[13px] font-semibold tabular-nums">{group.count}×</span>
                  <span className="h-1 rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-red-500" style={{ width: `${(group.count / max) * 100}%` }} />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium">
                    {sample?.exception_type ? `${sample.exception_type}: ` : ''}
                    {sample?.message.replace(/^\w+: /, '') || 'Unknown error'}
                  </span>
                  <span className="block truncate font-mono text-[10.5px] text-muted-foreground">{sample?.source}</span>
                </span>
                <span className="text-right text-[10.5px] text-muted-foreground">
                  last {when(group.last_seen)}
                  <br />
                  first {when(group.first_seen)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </PremiumCard>
  )
}

function Field({ label, value, mono, copy, href }: { label: string; value: string; mono?: boolean; copy?: boolean; href?: string }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn('flex min-w-0 items-center gap-1 text-[12px]', mono && 'font-mono text-[11.5px]')}>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline">
            <span className="truncate">{value}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <span className="truncate">{value}</span>
        )}
        {copy ? <CopyButton text={value} label={label} /> : null}
      </dd>
    </div>
  )
}

/** One record in full: the error, where it was raised, the request it came from, and its traceback. */
function LogDetail({ id, onClose, onShowSimilar }: { id: number; onClose: () => void; onShowSimilar: (fingerprint: string) => void }) {
  const [detail, setDetail] = useState<SystemLogDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setDetail(null)
    setError('')
    getSystemLog(id)
      .then((row) => live && setDetail(row))
      .catch((reason: unknown) => live && setError(errorMessage(reason, 'Could not load the record.')))
    return () => {
      live = false
    }
  }, [id])

  return (
    <PremiumCard className="flex max-h-[calc(100vh-7rem)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
        <h2 className="text-[12.5px] font-semibold">Log record #{id}</h2>
        <button type="button" onClick={onClose} className="rounded-[2px] p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {error ? <p className="text-[11.5px] text-destructive">{error}</p> : null}
        {!detail && !error ? <p className="text-[11.5px] text-muted-foreground">Loading…</p> : null}
        {detail ? (
          <>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <LevelBadge level={detail.level} />
                <span className="text-[11px] text-muted-foreground">{new Date(detail.time).toLocaleString()}</span>
                {detail.occurrences > 1 ? (
                  <button
                    type="button"
                    onClick={() => onShowSimilar(detail.fingerprint)}
                    className="inline-flex items-center gap-1 rounded-[2px] border border-border/70 px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  >
                    <Fingerprint className="h-3 w-3" />
                    Happened {detail.occurrences}× — show all
                  </button>
                ) : null}
              </div>
              <p className="break-words text-[13px] font-medium leading-snug">{detail.message}</p>
            </div>

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Raised at" value={detail.source} mono copy />
              <Field label="Logger" value={detail.logger} mono />
              <Field label="Request" value={detail.path ? `${detail.method} ${detail.path}${detail.status_code ? ` → ${detail.status_code}` : ''}` : ''} mono />
              <Field label="Request id" value={detail.request_id} mono copy />
              <Field label="User" value={detail.user_id} />
              <Field label="Workflow" value={detail.workflow_id} mono copy />
              <Field label="Trace" value={detail.trace_id} mono href={detail.trace_id ? traceUrl(detail.trace_id) : undefined} />
            </dl>

            {detail.traceback ? (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Traceback</h3>
                  <CopyButton text={detail.traceback} label="traceback" />
                </div>
                <pre className="max-h-[28rem] overflow-auto rounded-[2px] border border-border/70 bg-muted/40 p-3 font-mono text-[10.5px] leading-relaxed text-foreground/90">
                  {detail.traceback}
                </pre>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">No traceback: this was logged without an exception.</p>
            )}
          </>
        ) : null}
      </div>
    </PremiumCard>
  )
}

/**
 * System → System logs: the backend's warnings and errors (failed requests, workflow builds,
 * background work) with their tracebacks and the request they came from.
 */
export function SystemLogsView() {
  const [range, setRange] = useState<Range>('24h')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [summary, setSummary] = useState<SystemLogSummary | null>(null)
  const [items, setItems] = useState<SystemLog[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Search as you type, without a request per key
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const hours = RANGE_HOURS[range]
  const filters = useMemo(
    () => ({ hours, level: LEVEL_FILTER_MIN[levelFilter], q: query, fingerprint: fingerprint ?? undefined }),
    [hours, levelFilter, query, fingerprint],
  )

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    Promise.all([getSystemLogSummary(hours), listSystemLogs(filters)])
      .then(([nextSummary, page]) => {
        if (!live) return
        setSummary(nextSummary)
        setItems(page.items)
        setNextBefore(page.next_before_id)
      })
      .catch((reason: unknown) => live && setError(errorMessage(reason, 'Could not load the system logs.')))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [filters, hours, reloadKey])

  const loadMore = useCallback(async () => {
    if (!nextBefore) return
    try {
      const page = await listSystemLogs({ ...filters, beforeId: nextBefore })
      setItems((current) => [...current, ...page.items])
      setNextBefore(page.next_before_id)
    } catch (reason) {
      setError(errorMessage(reason, 'Could not load older records.'))
    }
  }, [filters, nextBefore])

  const counts = summary?.counts ?? { WARNING: 0, ERROR: 0, CRITICAL: 0 }

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="System logs"
        description="Warnings and errors from the backend: failed requests, workflow builds and background work, with the traceback and the request each came from. Secrets in messages are masked."
        actions={
          <>
            <FilterChips options={RANGES} value={range} onChange={setRange} size="sm" label={(value) => value} />
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11.5px]" onClick={() => setReloadKey((key) => key + 1)}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        {error ? (
          <p className="rounded-[2px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">{error}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Errors" value={String(counts.ERROR)} hint={`in the last ${range}`} icon={XCircle} tone="warning" />
          <StatCard label="Critical" value={String(counts.CRITICAL)} hint={`in the last ${range}`} icon={AlertOctagon} tone="warning" />
          <StatCard label="Warnings" value={String(counts.WARNING)} hint={`in the last ${range}`} icon={AlertTriangle} tone="primary" />
          <StatCard
            label="Distinct failures"
            value={String(summary?.top_errors.length ?? 0)}
            hint={summary && summary.top_errors.length >= 8 ? 'top 8 shown below' : 'errors grouped by cause'}
            icon={Fingerprint}
            tone="violet"
          />
        </div>

        {summary ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Timeline summary={summary} />
            <TopFailures summary={summary} active={fingerprint} onPick={setFingerprint} />
          </div>
        ) : null}

        <div className={cn('grid gap-4', selected !== null && 'xl:grid-cols-[minmax(0,1fr)_26rem]')}>
          <PremiumCard>
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
              <FilterChips options={LEVEL_FILTERS} value={levelFilter} onChange={setLevelFilter} size="sm" label={(value) => LEVEL_FILTER_LABEL[value]} />
              {fingerprint ? (
                <button
                  type="button"
                  onClick={() => setFingerprint(null)}
                  className="inline-flex items-center gap-1 rounded-[3px] border border-border/70 px-2 py-1 text-[10.5px] text-muted-foreground hover:bg-accent/50"
                >
                  <Fingerprint className="h-3 w-3" />
                  One failure only
                  <X className="h-3 w-3" />
                </button>
              ) : null}
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search message, path, request, trace, user or workflow"
                className="ml-auto w-full sm:w-80"
              />
            </div>

            {loading && items.length === 0 ? (
              <EmptyHint title="Loading…" hint="Fetching log records." className="m-3" />
            ) : items.length === 0 ? (
              <EmptyHint
                title="No records"
                hint={query || fingerprint || levelFilter !== 'all' ? 'Nothing matches these filters in this range.' : 'No warnings or errors were recorded in this range.'}
                className="m-3"
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(selected === item.id ? null : item.id)}
                      className={cn(
                        'grid w-full grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-3 py-2.5 text-left transition-colors sm:grid-cols-[5.5rem_6.5rem_minmax(0,1fr)]',
                        selected === item.id ? 'bg-accent' : 'hover:bg-accent/40',
                      )}
                    >
                      <span className="text-[11px] tabular-nums text-muted-foreground" title={new Date(item.time).toLocaleString()}>
                        {new Date(item.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <span className="block text-[10px]">{when(item.time)}</span>
                      </span>
                      <span className="hidden sm:block">
                        <LevelBadge level={item.level} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-medium">{item.message}</span>
                        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
                          <span className="truncate font-mono">{item.source}</span>
                          {item.path ? (
                            <span className="truncate font-mono">
                              {item.method} {item.path}
                              {item.status_code ? ` → ${item.status_code}` : ''}
                            </span>
                          ) : null}
                          {item.trace_id ? <span>· in a workflow run</span> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {nextBefore ? (
              <div className="border-t border-border/70 p-2 text-center">
                <Button variant="ghost" size="sm" className="h-8 text-[11.5px]" onClick={() => void loadMore()}>
                  Load older
                </Button>
              </div>
            ) : null}
          </PremiumCard>

          {selected !== null ? (
            <div className="xl:sticky xl:top-4 xl:self-start">
              <LogDetail
                id={selected}
                onClose={() => setSelected(null)}
                onShowSimilar={(value) => {
                  setFingerprint(value)
                  setSelected(null)
                }}
              />
            </div>
          ) : null}
        </div>

        {!loading && summary && summary.total === 0 && !error ? (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ScrollText className="h-3 w-3" />
            The backend keeps warnings and errors here for the telemetry retention period (TELEMETRY_RETENTION_DAYS).
          </p>
        ) : null}
      </PageBody>
    </>
  )
}
