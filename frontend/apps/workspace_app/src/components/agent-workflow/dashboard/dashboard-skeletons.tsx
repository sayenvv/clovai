import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ListSkeleton } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { cn } from '@/utils/cn'

/**
 * Loading placeholders shaped like each dashboard page, so the content lands where the shimmer was.
 * Card surfaces match Section / StatCard / SettingsCard exactly.
 */

const CARD = 'rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

// Fixed heights so the chart doesn't jump between renders.
const BARS = [34, 52, 41, 63, 48, 72, 58, 44, 66, 81, 55, 62, 47, 70, 59, 76, 50, 64, 85, 57, 68, 46, 73, 61, 54, 78, 49, 67, 88, 60]

/** Matches Section: title on the left, optional action on the right. */
function SectionShell({
  title = 'w-28',
  action,
  className,
  children,
}: {
  title?: string
  action?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn(CARD, 'p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Skeleton className={cn('h-3.5', title)} />
        {action ? <Skeleton className={cn('h-7 rounded-lg', action)} /> : null}
      </div>
      {children}
    </div>
  )
}

/** Matches DailyUsageChart: scale labels, 30 day bars on a baseline, day labels. */
function ChartBody() {
  return (
    <div>
      <div className="flex h-44 items-end gap-[2px] border-b border-border pt-4">
        {BARS.map((height, index) => (
          <Skeleton key={index} className="min-w-0 flex-1 rounded-b-none rounded-t-[3px]" style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-2.5 w-9" />
        ))}
      </div>
    </div>
  )
}

/** Name and detail on the left, a value or badge on the right. */
function Rows({ count, trailing = 'w-14', divided = false }: { count: number; trailing?: string; divided?: boolean }) {
  return (
    <div className={divided ? 'divide-y divide-border/60' : 'space-y-3'}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn('flex items-center justify-between gap-3', divided && 'py-2.5')}>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3" style={{ width: `${46 - (index % 3) * 9}%` }} />
            <Skeleton className="h-2.5" style={{ width: `${62 - (index % 4) * 7}%` }} />
          </div>
          <Skeleton className={cn('h-5 shrink-0 rounded-full', trailing)} />
        </div>
      ))}
    </div>
  )
}

/** Matches UsagePage's ShareRow: label, detail and a share bar. */
function ShareRows({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-1.5">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-3" style={{ width: `${40 - index * 6}%` }} />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-2.5" style={{ width: `${55 - index * 5}%` }} />
        </div>
      ))}
    </div>
  )
}

function TableBody({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="space-y-0">
      <div className="flex gap-4 border-b border-border/70 px-2 pb-2">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className={cn('h-2.5', index < 3 ? 'flex-1' : 'w-12')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4 border-b border-border/40 px-2 py-2.5 last:border-0">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className={cn('h-3', index < 3 ? 'flex-1' : 'w-12')} style={index === 1 ? { maxWidth: `${60 + (row % 3) * 12}%` } : undefined} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── Report bodies (shown by ReportState while a page's data loads) ── */

export function OverviewBodySkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionShell title="w-28" action="w-16" className="lg:col-span-2">
        <ChartBody />
      </SectionShell>
      <SectionShell title="w-14" action="w-20">
        <Rows count={5} trailing="w-16" />
      </SectionShell>
      <SectionShell title="w-24" action="w-20" className="lg:col-span-2">
        <Rows count={5} trailing="w-16" divided />
      </SectionShell>
      <SectionShell title="w-20" action="w-24">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-7 w-10 rounded-lg" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="mt-4 space-y-2.5">
          {[70, 58, 64, 50].map((width, index) => (
            <div key={index} className="flex justify-between gap-2">
              <Skeleton className="h-3" style={{ width: `${width}%` }} />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </SectionShell>
    </div>
  )
}

export function UsageBodySkeleton() {
  return (
    <>
      <SectionShell title="w-28">
        <ChartBody />
      </SectionShell>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionShell title="w-24">
          <ShareRows count={4} />
        </SectionShell>
        <SectionShell title="w-20">
          <ShareRows count={4} />
        </SectionShell>
      </div>
    </>
  )
}

export function AgentsBodySkeleton() {
  return (
    <SectionShell title="w-40">
      <TableBody columns={6} rows={6} />
    </SectionShell>
  )
}

/** Matches WorkspaceAgentMonitor: a section of collapsible workflow tab rows. */
export function AgentMonitorSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Skeleton className="size-3.5 rounded" />
            <Skeleton className="h-3.5" style={{ width: `${32 - index * 5}%` }} />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  )
}

export function ActivityBodySkeleton() {
  return (
    <SectionShell title="w-20">
      <TableBody columns={6} rows={10} />
    </SectionShell>
  )
}

/** Matches WorkflowsTab: bordered rows with an icon tile and two figures. */
export function WorkflowsBodySkeleton() {
  return (
    <SectionShell title="w-20">
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="size-7 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5" style={{ width: `${36 - index * 4}%` }} />
                <Skeleton className="h-2.5" style={{ width: `${52 - index * 4}%` }} />
              </div>
            </div>
            <div className="flex gap-5">
              {[0, 1].map((cell) => (
                <div key={cell} className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="h-2.5 w-14" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

/* ── Whole pages (shown while a tab's code loads) ── */

function IntroSkeleton({ title = 'w-64', action }: { title?: string; action?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className={cn('h-6 rounded-lg', title)} />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      {action ? <Skeleton className={cn('h-8 rounded-lg', action)} /> : null}
    </div>
  )
}

function StatsSkeleton({ count }: { count: 3 | 4 }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', count === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn(CARD, 'p-4')}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-[26px] w-24 rounded-lg" />
          <Skeleton className="mt-2.5 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

/** Matches SettingsCard: label column on the left, fields on the right, footer below. */
function SettingsCardSkeleton({ fields = 2, footer = true }: { fields?: number; footer?: boolean }) {
  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8 md:p-6">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: fields }, (_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
      {footer ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/40 px-5 py-3 md:px-6">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      ) : null}
    </div>
  )
}

export type DashboardSkeletonTab =
  | 'overview'
  | 'agents'
  | 'usage'
  | 'workflows'
  | 'models'
  | 'variables'
  | 'activity'
  | 'profile'
  | 'workspace'
  | 'appearance'
  | 'security'

/** The page for `tab`, in shimmer. */
export function DashboardPageSkeleton({ tab }: { tab: DashboardSkeletonTab }) {
  const body = (() => {
    switch (tab) {
      case 'overview':
        return (
          <>
            <IntroSkeleton />
            <StatsSkeleton count={4} />
            <div className="mt-6">
              <OverviewBodySkeleton />
            </div>
          </>
        )
      case 'usage':
        return (
          <>
            <IntroSkeleton title="w-56" action="w-32" />
            <StatsSkeleton count={4} />
            <div className="mt-6">
              <UsageBodySkeleton />
            </div>
          </>
        )
      case 'agents':
        return (
          <>
            <IntroSkeleton title="w-60" action="w-32" />
            <StatsSkeleton count={4} />
            <div className="mt-6">
              <SectionShell title="w-28" action="w-56">
                <AgentMonitorSkeleton />
              </SectionShell>
            </div>
            <div className="mt-4">
              <AgentsBodySkeleton />
            </div>
          </>
        )
      case 'workflows':
        return (
          <>
            <IntroSkeleton title="w-44" />
            <StatsSkeleton count={3} />
            <div className="mt-6">
              <WorkflowsBodySkeleton />
            </div>
          </>
        )
      case 'activity':
        return (
          <>
            <IntroSkeleton title="w-52" action="w-40" />
            <ActivityBodySkeleton />
          </>
        )
      case 'models':
      case 'variables':
        return (
          <>
            <IntroSkeleton title="w-52" action="w-28" />
            <ListSkeleton rows={4} />
          </>
        )
      case 'security':
        return (
          <>
            <IntroSkeleton title="w-28" />
            <div className="space-y-5">
              <SettingsCardSkeleton />
              <SettingsCardSkeleton fields={0} />
              <SettingsCardSkeleton fields={1} />
            </div>
          </>
        )
      case 'appearance':
        return (
          <>
            <IntroSkeleton title="w-36" />
            <SettingsCardSkeleton footer={false} />
          </>
        )
      default:
        return (
          <>
            <IntroSkeleton title="w-32" />
            <div className="space-y-5">
              <SettingsCardSkeleton />
              <SettingsCardSkeleton fields={1} footer={false} />
            </div>
          </>
        )
    }
  })()

  return (
    <div role="status" aria-label="Loading">
      {body}
    </div>
  )
}
