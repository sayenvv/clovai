import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight } from 'lucide-react'
import { PageIntro, RunRow } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { usePublishedInstances } from '@/components/agent-workflow/dashboard/use-published-instances'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'
import type { PublishedRunStatus } from '@/services/published-instances-store'
import { cn } from '@/utils/cn'

const RUN_FILTERS = [
  'all',
  'succeeded',
  'failed',
  'running',
  'waiting_approval',
  'cancelled',
] as const

export default function RunsPage() {
  const { instances } = usePublishedInstances()
  const [statusFilter, setStatusFilter] =
    useState<(typeof RUN_FILTERS)[number]>('all')

  const runs = useMemo(() => {
    const rows = instances.flatMap((item) =>
      item.recentRuns.map((run) => ({
        run,
        workflowName: item.workflowName,
        instanceName: item.instanceName,
      })),
    )
    rows.sort((a, b) => b.run.startedAt.localeCompare(a.run.startedAt))
    if (statusFilter === 'all') return rows
    return rows.filter((row) => row.run.status === (statusFilter as PublishedRunStatus))
  }, [instances, statusFilter])

  return (
    <div>
      <PageIntro
        eyebrow="Activity"
        title="What your instances ran"
        description="Recent executions across your published instances — status, tokens, credits, and resource usage."
        actions={RUN_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[11px] font-medium capitalize transition-colors',
              statusFilter === value
                ? 'bg-red-600 font-semibold text-white'
                : 'border border-border bg-card text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {value === 'all' ? 'All' : value.replace('_', ' ')}
          </button>
        ))}
      />

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <Activity className="mx-auto h-5 w-5 text-red-600 dark:text-red-400" />
          <p className="mt-4 text-sm font-semibold">
            {instances.length === 0 ? 'No runs yet' : 'No matching runs'}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {instances.length === 0
              ? 'Deploy and execute a workflow to populate this timeline.'
              : 'Try another status filter.'}
          </p>
          {instances.length === 0 && (
            <Button asChild size="sm" className="mt-5 bg-red-600 hover:bg-red-700">
              <Link to={ROUTES.agentWorkflow}>
                Open designer
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(({ run, workflowName }) => (
            <RunRow key={run.id} run={run} workflowName={workflowName} />
          ))}
        </div>
      )}
    </div>
  )
}
