import { Link, Navigate, useParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Bot,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  GitBranch,
  Globe,
  Mail,
  Phone,
  Play,
  UserRound,
} from 'lucide-react'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { UserAvatar } from '@/components/admin-center/UserAvatar'
import {
  USER_STATUS_TONE,
  WORKFLOW_STATUS_TONE,
} from '@/components/admin-center/status-tones'
import {
  formatCurrency,
  formatNumber,
  getUser,
  getWorkflowsForUser,
  userMonthlyEstimate,
} from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'

export function UserDetailView() {
  const { userId = '' } = useParams()
  const user = getUser(userId)

  if (!user) {
    return <Navigate to={ROUTES.users} replace />
  }

  const workflows = getWorkflowsForUser(user.id)
  const monthlyTotal = userMonthlyEstimate(user.id)
  const totalRuns = workflows.reduce((sum, workflow) => sum + workflow.runs30d, 0)
  const publishedCount = workflows.filter((workflow) => workflow.status === 'published').length

  return (
    <>
      <PageHeader
        title={user.name}
        description={`${user.email} · ${user.company}`}
        actions={
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]">
            <Link to={ROUTES.users}>
              <ArrowLeft className="h-3.5 w-3.5" />
              All users
            </Link>
          </Button>
        }
      />
      <PageBody className="space-y-5">
        <PremiumCard className="p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            <UserAvatar
              name={user.name}
              size="lg"
              variant="brand"
              className="h-16 w-16 rounded-2xl text-lg shadow-md ring-1 ring-border/40"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">{user.name}</h2>
                <StatusBadge label={user.status} tone={USER_STATUS_TONE[user.status]} />
                <StatusBadge label={user.plan} tone="violet" />
                <StatusBadge label={user.role} tone="info" />
              </div>
              {user.title && (
                <p className="mt-1 text-[12px] text-muted-foreground">{user.title}</p>
              )}
              <div className="mt-3 grid grid-cols-1 gap-2.5 text-[11.5px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {user.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {user.company}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  {user.country}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {user.timezone}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  Joined {user.joinedAt}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 shrink-0" />
                  Active {user.lastActive}
                </span>
                {user.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {user.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 shrink-0" />
                  Role · {user.role}
                </span>
              </div>
            </div>
          </div>
        </PremiumCard>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Est. monthly"
            value={formatCurrency(monthlyTotal)}
            hint="Sum of workflow estimates"
            icon={DollarSign}
          />
          <MetricCard
            label="Workflows"
            value={formatNumber(workflows.length)}
            hint={`${publishedCount} published`}
            icon={Bot}
          />
          <MetricCard
            label="Runs (30d)"
            value={formatNumber(totalRuns)}
            hint="Across this user’s flows"
            icon={Play}
          />
          <MetricCard
            label="Lifetime spend"
            value={formatCurrency(user.totalSpendUsd)}
            hint={`~${formatCurrency(user.avgMonthlyUsd)} / mo avg`}
            icon={Activity}
          />
        </div>

        <PremiumCard className="p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Workflows & estimated monthly price</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Per-workflow cost estimate based on recent run volume and model mix (mock data).
              </p>
            </div>
            <p className="text-[12px] font-semibold tabular-nums text-foreground">
              Total {formatCurrency(monthlyTotal)}
              <span className="ml-1 font-normal text-muted-foreground">/ month</span>
            </p>
          </div>

          {workflows.length === 0 ? (
            <EmptyHint
              title="No workflows yet"
              hint="This member has not created or been assigned any workflows."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="bg-muted/40 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Workflow</th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    <th className="px-3 py-2.5 text-left font-medium">Model</th>
                    <th className="px-3 py-2.5 text-right font-medium">Agents</th>
                    <th className="px-3 py-2.5 text-right font-medium">Runs (30d)</th>
                    <th className="px-3 py-2.5 text-right font-medium">$/run</th>
                    <th className="px-3 py-2.5 text-right font-medium">Est. monthly</th>
                    <th className="px-3 py-2.5 text-right font-medium">View</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((workflow) => (
                    <tr
                      key={workflow.id}
                      className="border-t border-border/60 transition-colors hover:bg-accent/30"
                    >
                      <td className="px-3 py-3">
                        <Link
                          to={ROUTES.userWorkflow(user.id, workflow.id)}
                          className="font-medium text-foreground hover:underline"
                        >
                          {workflow.name}
                        </Link>
                        <p className="mt-0.5 max-w-xs text-[10.5px] leading-snug text-muted-foreground">
                          {workflow.description}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Updated {workflow.updatedAt}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          label={workflow.status}
                          tone={WORKFLOW_STATUS_TONE[workflow.status]}
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-[10.5px] text-muted-foreground">
                        {workflow.model}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {workflow.agents}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {formatNumber(workflow.runs30d)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
                        {formatCurrency(workflow.costPerRunUsd)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] font-semibold tabular-nums text-foreground">
                        {formatCurrency(workflow.estimatedMonthlyUsd)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-[10.5px]">
                          <Link to={ROUTES.userWorkflow(user.id, workflow.id)}>
                            <GitBranch className="h-3 w-3" />
                            Diagram
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/80 bg-muted/30">
                    <td colSpan={7} className="px-3 py-3 text-right text-[11px] font-medium text-muted-foreground">
                      Estimated monthly for {user.name}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(monthlyTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </PremiumCard>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((workflow) => (
            <PremiumCard key={`${workflow.id}-card`} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-[13px] font-semibold text-foreground">
                    {workflow.name}
                  </h4>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">{workflow.model}</p>
                </div>
                <StatusBadge label={workflow.status} tone={WORKFLOW_STATUS_TONE[workflow.status]} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {workflow.description}
              </p>
              <div className="mt-4 flex items-end justify-between border-t border-border/60 pt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Est. monthly
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                    {formatCurrency(workflow.estimatedMonthlyUsd)}
                  </p>
                </div>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {formatNumber(workflow.runs30d)} runs · {formatCurrency(workflow.costPerRunUsd)}/run
                </p>
              </div>
              <Button asChild size="sm" className="mt-3 h-8 w-full gap-1.5 text-[11px]">
                <Link to={ROUTES.userWorkflow(user.id, workflow.id)}>
                  <GitBranch className="h-3.5 w-3.5" />
                  Open diagram & logs
                </Link>
              </Button>
            </PremiumCard>
          ))}
        </div>
      </PageBody>
    </>
  )
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: typeof DollarSign
}) {
  return (
    <PremiumCard className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </PremiumCard>
  )
}
