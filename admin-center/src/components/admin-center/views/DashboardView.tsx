import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Play,
  Users,
} from 'lucide-react'
import { PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatCard } from '@/components/admin-center/StatCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { UserAvatar } from '@/components/admin-center/UserAvatar'
import {
  ACTIVITY_TONE,
  WORKFLOW_STATUS_TONE,
} from '@/components/admin-center/status-tones'
import {
  ADMIN_ACTIVITY,
  ADMIN_USERS,
  ADMIN_WORKFLOWS,
  DASHBOARD_METRICS,
  formatNumber,
} from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'

export function DashboardView() {
  const m = DASHBOARD_METRICS
  const recentUsers = ADMIN_USERS.slice(0, 5)
  const topWorkflows = ADMIN_WORKFLOWS.filter((w) => w.status !== 'archived').slice(0, 4)
  const events = ADMIN_ACTIVITY.slice(0, 6)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live snapshot of members, workflows, and platform activity."
        actions={
          <Button asChild size="sm" className="h-8 gap-1.5 text-[11.5px] font-semibold">
            <Link to={ROUTES.users}>
              Manage users
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total users"
            value={formatNumber(m.totalUsers)}
            delta={12.4}
            hint="vs. last month"
            icon={Users}
            tone="primary"
          />
          <StatCard
            label="Active workflows"
            value={formatNumber(m.activeWorkflows)}
            delta={8.2}
            hint="published"
            icon={Bot}
            tone="violet"
          />
          <StatCard
            label="Runs (30d)"
            value={formatNumber(m.runs30d)}
            delta={24.6}
            hint="agent executions"
            icon={Play}
            tone="warning"
          />
          <StatCard
            label="Success rate"
            value={`${m.successRate}%`}
            delta={1.3}
            hint="completed runs"
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PremiumCard className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Top workflows</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Highest run volume in the last 30 days.
                </p>
              </div>
              <Link
                to={ROUTES.workflows}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/70">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Workflow</th>
                    <th className="px-3 py-2.5 text-left font-medium">Owner</th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {topWorkflows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-border/60 transition-colors hover:bg-accent/30"
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">{row.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.owner}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          label={row.status}
                          tone={WORKFLOW_STATUS_TONE[row.status]}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground">
                        {formatNumber(row.runs30d)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold text-foreground">Activity</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Latest workspace events</p>
              </div>
            </div>
            <ul className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge label={event.type} tone={ACTIVITY_TONE[event.type]} />
                      <span className="text-[10px] text-muted-foreground">{event.at}</span>
                    </div>
                    <p className="mt-1 text-[11.5px] font-medium leading-snug text-foreground">
                      {event.summary}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">{event.actor}</p>
                  </div>
                </li>
              ))}
            </ul>
          </PremiumCard>
        </div>

        <PremiumCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent members</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">People with access to this workspace.</p>
            </div>
            <Link
              to={ROUTES.users}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              View directory
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {recentUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5"
              >
                <UserAvatar name={user.name} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-foreground">{user.name}</p>
                  <p className="truncate text-[10px] capitalize text-muted-foreground">{user.role}</p>
                </div>
              </div>
            ))}
          </div>
        </PremiumCard>
      </PageBody>
    </>
  )
}
