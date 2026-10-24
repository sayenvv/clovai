import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { WorkflowIcon as Workflow } from '@/components/shared/WorkflowIcon'
import { ReportState, Section } from '@/components/agent-workflow/dashboard/activity-ui'
import { formatCompact, formatNumber, formatWhen } from '@/components/agent-workflow/dashboard/dashboard-format'
import { PageIntro, StatCard } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { useActivityReport } from '@/components/agent-workflow/dashboard/use-activity-report'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'
import { fetchSavedWorkflows, fetchUsageReport } from '@/services/activity-api'
import { WorkflowsBodySkeleton } from '@/components/agent-workflow/dashboard/dashboard-skeletons'

const DAYS = 30

/** The workflows saved in this workspace, with the tokens each one's runs used. */
export default function WorkflowsTab({ workspaceId }: { workspaceId: string }) {
  const workflows = useActivityReport(useCallback(() => fetchSavedWorkflows(workspaceId), [workspaceId]), DAYS)
  const usage = useActivityReport(fetchUsageReport, DAYS)
  const saved = workflows.data ?? []
  // Runs are recorded under the workflow's name, so match on it.
  const runUsage = new Map(
    (usage.data?.bySource ?? []).filter((row) => row.source === 'execute').map((row) => [row.workflow, row]),
  )
  const latest = saved.reduce<string | null>((best, row) => (!best || row.updated_at > best ? row.updated_at : best), null)

  return (
    <div>
      <PageIntro
        eyebrow="Workflows"
        title="Saved workflows"
        description={`Every workflow saved in this workspace, with the tokens its runs used in the last ${DAYS} days.`}
        actions={
          <Button asChild size="sm" variant="outline" className="h-8 rounded-lg">
            <Link to={ROUTES.agentWorkflow}>Open designer</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard loading={workflows.isLoading && !workflows.data} label="Saved workflows" value={workflows.data ? formatNumber(saved.length) : '—'} hint="One per designer tab" icon={Workflow} />
        <StatCard loading={workflows.isLoading && !workflows.data}
          label="Run this period"
          value={usage.data ? formatNumber(saved.filter((row) => runUsage.has(row.name)).length) : '—'}
          hint={`Executed in the last ${DAYS} days`}
          icon={Workflow}
        />
        <StatCard loading={workflows.isLoading && !workflows.data} label="Last change" value={latest ? formatWhen(latest) : '—'} hint="Most recent save" icon={Clock} />
      </div>

      <div className="mt-6">
        <ReportState
          isLoading={workflows.isLoading && !workflows.data}
          skeleton={<WorkflowsBodySkeleton />}
          error={workflows.error}
          empty={Boolean(workflows.data) && saved.length === 0}
          icon={Workflow}
          emptyTitle="No saved workflows yet"
          emptyHint="Workflows appear here once you save a tab in the designer."
        />
      </div>

      {saved.length > 0 ? (
        <Section title="Workflows" className="mt-0">
          <div className="space-y-2">
            {[...saved]
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .map((row) => {
                const runs = runUsage.get(row.name)
                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Workflow className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-foreground">{row.name}</p>
                        <p className="truncate text-[10.5px] text-muted-foreground">
                          Updated {formatWhen(row.updated_at)} · created {formatWhen(row.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 text-right text-[11px]">
                      <div>
                        <p className="font-semibold tabular-nums text-foreground">{runs ? formatNumber(runs.calls) : '0'}</p>
                        <p className="text-muted-foreground">model calls</p>
                      </div>
                      <div>
                        <p className="font-semibold tabular-nums text-foreground">{runs ? formatCompact(runs.totalTokens) : '0'}</p>
                        <p className="text-muted-foreground">tokens</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{runs ? formatWhen(runs.lastUsed) : 'Not run'}</p>
                        <p className="text-muted-foreground">last run</p>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </Section>
      ) : null}
    </div>
  )
}
