import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PenLine, Rocket, type LucideIcon } from 'lucide-react'
import {
  DASHBOARD_NAV,
  type DashboardNavItem,
} from '@/components/agent-workflow/dashboard/dashboard-nav'
import {
  formatLatency,
  formatNumber,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import {
  getInstanceHealth,
  HEALTH_LABEL,
  HEALTH_TONE,
} from '@/components/agent-workflow/dashboard/instance-health'
import { usePublishedInstances } from '@/components/agent-workflow/dashboard/use-published-instances'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

const FLYOUT_MIN_WIDTH = 220
const FLYOUT_MAX_WIDTH = 360
const FLYOUT_DEFAULT_WIDTH = 260
const FLYOUT_WIDTH_KEY = 'agent-workflow.console.sidebar-flyout-width'
const FLYOUT_OPEN_KEY = 'agent-workflow.console.sidebar-flyout-open'

function readFlyoutWidth(): number {
  try {
    const raw = window.localStorage.getItem(FLYOUT_WIDTH_KEY)
    const parsed = raw ? Number.parseInt(raw, 10) : FLYOUT_DEFAULT_WIDTH
    if (Number.isNaN(parsed)) return FLYOUT_DEFAULT_WIDTH
    return Math.min(FLYOUT_MAX_WIDTH, Math.max(FLYOUT_MIN_WIDTH, parsed))
  } catch {
    return FLYOUT_DEFAULT_WIDTH
  }
}

function readFlyoutOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(FLYOUT_OPEN_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

function navItemForPath(pathname: string): DashboardNavItem {
  return (
    DASHBOARD_NAV.find((item) =>
      item.to === ROUTES.agentWorkflowDashboard
        ? pathname === item.to
        : pathname === item.to || pathname.startsWith(`${item.to}/`),
    ) ?? DASHBOARD_NAV[0]
  )
}

export function DashboardSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, instances, overview } = usePublishedInstances()
  const activeItem = useMemo(
    () => navItemForPath(location.pathname),
    [location.pathname],
  )

  const [flyoutOpen, setFlyoutOpen] = useState(readFlyoutOpen)
  const [flyoutWidth, setFlyoutWidth] = useState(readFlyoutWidth)
  const resizeStart = useRef<{ x: number; width: number } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(FLYOUT_OPEN_KEY, flyoutOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [flyoutOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(FLYOUT_WIDTH_KEY, String(flyoutWidth))
    } catch {
      /* ignore */
    }
  }, [flyoutWidth])

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = flyoutWidth
      resizeStart.current = { x: startX, width: startWidth }

      const onMove = (moveEvent: PointerEvent) => {
        if (!resizeStart.current) return
        const delta = moveEvent.clientX - resizeStart.current.x
        const next = Math.min(
          FLYOUT_MAX_WIDTH,
          Math.max(FLYOUT_MIN_WIDTH, resizeStart.current.width + delta),
        )
        setFlyoutWidth(next)
      }
      const onUp = () => {
        resizeStart.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [flyoutWidth],
  )

  const openNav = useCallback(
    (item: DashboardNavItem) => {
      const alreadyHere =
        item.to === ROUTES.agentWorkflowDashboard
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to)

      if (alreadyHere && flyoutOpen) {
        setFlyoutOpen(false)
        return
      }

      if (!alreadyHere) navigate(item.to)
      setFlyoutOpen(true)
    },
    [flyoutOpen, location.pathname, navigate],
  )

  const totalWidth =
    SIDE_PANEL_COLLAPSED_WIDTH + (flyoutOpen ? flyoutWidth : 0)

  const userInitials = (session?.displayName || session?.email || 'U')
    .slice(0, 1)
    .toUpperCase()
  const userLabel = session
    ? [session.displayName, session.email].filter(Boolean).join(' · ')
    : undefined

  const recentRuns = useMemo(
    () =>
      instances
        .flatMap((item) =>
          item.recentRuns.slice(0, 2).map((run) => ({
            ...run,
            workflowName: item.workflowName,
          })),
        )
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 6),
    [instances],
  )

  return (
    <aside
      className={cn(
        'relative flex h-full shrink-0 border-r border-border/70 bg-background',
      )}
      style={{ width: totalWidth }}
    >
      {flyoutOpen ? (
        <DesignerResizeHandle
          side="right"
          onPointerDown={onResizePointerDown}
          ariaLabel="Resize console panel"
        />
      ) : null}

      {/* Same icon rail as AgentLibrarySidebar */}
      <div
        className={cn(
          'relative flex h-full shrink-0 flex-col',
          'bg-gradient-to-b from-muted/40 via-background to-muted/30',
          flyoutOpen ? 'border-r border-border/60' : '',
        )}
        style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border/80 to-transparent"
          aria-hidden
        />

        <TooltipProvider delayDuration={180}>
          <div className="flex flex-1 flex-col items-center px-2 py-3">
            <div className="flex w-full flex-col items-center gap-1">
              {DASHBOARD_NAV.map((item) => {
                const active =
                  item.to === ROUTES.agentWorkflowDashboard
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to)
                return (
                  <RailIconButton
                    key={item.to}
                    label={item.label}
                    icon={item.icon}
                    active={active && flyoutOpen}
                    accent={active}
                    onClick={() => openNav(item)}
                  />
                )
              })}
            </div>

            <div className="mt-auto flex w-full flex-col items-center gap-1.5 pt-3">
              <div
                className="h-px w-6 bg-gradient-to-r from-transparent via-border to-transparent"
                aria-hidden
              />
              <RailIconButton
                label="Open designer"
                icon={PenLine}
                onClick={() => navigate(ROUTES.agentWorkflow)}
              />
              <div
                className="rounded-full p-0.5 shadow-[0_0_0_1px_hsl(var(--border)/0.7)] transition-shadow duration-200 hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.22)]"
                title="Profile"
              >
                <ProfileMenu
                  showSignOut={Boolean(session)}
                  userInitials={userInitials}
                  userLabel={userLabel}
                  side="right"
                  align="end"
                  avatarSize="sm"
                  triggerClassName="h-9 w-9 rounded-full hover:bg-transparent"
                />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>

      {flyoutOpen ? (
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col bg-background',
            'animate-in fade-in-0 slide-in-from-left-1 duration-200',
          )}
          style={{ width: flyoutWidth }}
        >
          <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {activeItem.label}
            </h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {activeItem.description}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {activeItem.to === ROUTES.agentWorkflowDashboard && (
              <div className="space-y-2">
                <FlyoutStat label="Live instances" value={String(overview.liveCount)} />
                <FlyoutStat label="Total runs" value={formatNumber(overview.totalRuns)} />
                <FlyoutStat label="Success rate" value={`${overview.successRate}%`} />
                <FlyoutStat
                  label="Credits used"
                  value={formatNumber(overview.totalCredits)}
                />
              </div>
            )}

            {activeItem.to === ROUTES.agentWorkflowDashboardInstances && (
              <div className="space-y-2">
                {instances.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No published instances yet.
                  </p>
                ) : (
                  instances.map((item) => {
                    const health = getInstanceHealth(item)
                    return (
                      <Link
                        key={item.id}
                        to={ROUTES.agentWorkflowDashboardInstances}
                        className={cn(
                          'flex items-start gap-2.5 rounded-lg border border-border/70 bg-background p-2.5 text-left transition-colors',
                          'hover:border-red-400/50 hover:bg-red-500/5',
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-300">
                          <Rocket className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {item.workflowName}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn('text-[9px]', HEALTH_TONE[health])}
                            >
                              {HEALTH_LABEL[health]}
                            </Badge>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                            {item.metrics.successRate}% ·{' '}
                            {formatLatency(item.metrics.avgLatencyMs)} ·{' '}
                            {formatNumber(item.metrics.totalRuns)} runs
                          </p>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            )}

            {activeItem.to === ROUTES.agentWorkflowDashboardPerformance && (
              <div className="space-y-2">
                <FlyoutStat label="Success rate" value={`${overview.successRate}%`} />
                <FlyoutStat
                  label="Failed runs"
                  value={formatNumber(overview.failed)}
                />
                <FlyoutStat
                  label="Credits"
                  value={formatNumber(overview.totalCredits)}
                />
                <FlyoutStat
                  label="Tokens"
                  value={formatNumber(overview.totalTokens)}
                />
              </div>
            )}

            {activeItem.to === ROUTES.agentWorkflowDashboardRuns && (
              <div className="space-y-1.5">
                {recentRuns.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No recent activity.
                  </p>
                ) : (
                  recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="rounded-lg border border-border/70 bg-background p-2.5"
                    >
                      <p className="truncate font-mono text-[11px] font-semibold">
                        {run.runId}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {run.workflowName} · {run.status.replace('_', ' ')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function FlyoutStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function RailIconButton({
  label,
  icon: Icon,
  onClick,
  active,
  accent,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  active?: boolean
  accent?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'group/rail relative flex h-10 w-10 items-center justify-center rounded-[11px]',
            'text-muted-foreground transition-all duration-200 ease-out',
            'hover:bg-foreground/[0.06] hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            active &&
              'bg-foreground/[0.08] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]',
            accent && !active && 'text-foreground hover:bg-foreground/[0.08]',
            accent &&
              active &&
              'bg-foreground/[0.1] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]',
          )}
        >
          {active ? (
            <span
              className="absolute top-1/2 left-[-11px] h-4 w-[3px] -translate-y-1/2 rounded-full bg-foreground/80"
              aria-hidden
            />
          ) : null}
          <Icon
            className={cn(
              'h-[18px] w-[18px] transition-transform duration-200',
              'group-hover/rail:scale-105',
              accent && 'text-red-600 dark:text-red-400',
            )}
            strokeWidth={accent ? 2.1 : 1.75}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={12}
        className="border-border/80 bg-popover/95 px-2.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
