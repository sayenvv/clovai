import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Coins, ListTree, Timer } from 'lucide-react'
import { ReportState, Section } from '@/components/agent-workflow/dashboard/activity-ui'
import {
  formatCompact,
  formatLatency,
  formatNumber,
  formatWhen,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import { PageIntro, StatCard } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { useActivityReport } from '@/components/agent-workflow/dashboard/use-activity-report'
import { TraceStatusBadge } from '@/components/agent-workflow/dashboard/trace-ui'
import { Input } from '@/components/ui/input'
import { ROUTES } from '@/constants'
import { fetchTraces } from '@/services/traces-api'

export default function TracesPage() {
  const [workflowId, setWorkflowId] = useState('')
  const filter = workflowId.trim()
  // useActivityReport reloads when its loader changes, so the filter goes into the loader
  const load = useCallback(() => fetchTraces({ workflowId: filter || undefined, limit: 100 }), [filter])
  const { data, error, isLoading } = useActivityReport(load, 0)
  const runs = data ?? []
  const failed = runs.filter((run) => run.status === 'ERROR').length
  const tokens = runs.reduce((sum, run) => sum + run.total_tokens, 0)
  const avgDuration = runs.length ? runs.reduce((sum, run) => sum + run.duration_ms, 0) / runs.length : 0

  return (
    <div>
      <PageIntro
        eyebrow="Traces"
        title="Every run, span by span"
        description="OpenTelemetry traces of your workflow runs: each agent, model call and tool call, with timings, tokens and errors."
        actions={
          <Input
            value={workflowId}
            onChange={(event) => setWorkflowId(event.target.value)}
            placeholder="Filter by workflow id"
            className="h-9 w-64 font-mono text-[12px]"
            aria-label="Filter by workflow id"
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={isLoading && !data} label="Runs" value={formatNumber(runs.length)} hint="Latest 100" icon={ListTree} />
        <StatCard
          loading={isLoading && !data}
          label="Failed"
          value={formatNumber(failed)}
          hint={runs.length ? `${Math.round((failed / runs.length) * 100)}% of runs` : '—'}
          icon={AlertTriangle}
        />
        <StatCard loading={isLoading && !data} label="Avg duration" value={runs.length ? formatLatency(avgDuration) : '—'} hint="Per run" icon={Timer} />
        <StatCard loading={isLoading && !data} label="Tokens" value={formatCompact(tokens)} hint="Input + output" icon={Coins} />
      </div>

      <div className="mt-4">
        <ReportState
          isLoading={isLoading && !data}
          error={error}
          empty={Boolean(data) && runs.length === 0}
          icon={ListTree}
          emptyTitle="No traces yet"
          emptyHint="Run a workflow through the execute API; its trace appears here as soon as the run ends."
        />
      </div>

      {runs.length > 0 ? (
        <Section title="Runs" className="mt-0">
          <div className="space-y-2">
            {runs.map((run) => (
              <Link
                key={run.trace_id}
                to={`${ROUTES.agentWorkflowDashboardTraces}/${run.trace_id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 transition-colors hover:border-foreground/30 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TraceStatusBadge status={run.status} />
                    <p className="truncate text-[13px] font-semibold text-foreground">{run.input || 'Workflow run'}</p>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
                    {run.workflow_id || 'no workflow id'}
                    <span className="font-sans"> · {formatWhen(run.start_time)}</span>
                  </p>
                  {run.error ? <p className="mt-0.5 truncate text-[11px] text-red-600 dark:text-red-400">{run.error}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-5 text-right text-[11px]">
                  <Metric value={formatLatency(run.duration_ms)} label="duration" />
                  <Metric value={formatNumber(run.agent_count)} label="agents" />
                  <Metric value={formatNumber(run.span_count)} label="spans" />
                  <Metric value={formatCompact(run.total_tokens)} label="tokens" />
                </div>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  )
}
