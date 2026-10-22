import { memo, useState } from 'react'
import { ChevronDown, Copy, ExternalLink, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  formatLatency,
  formatNumber,
  formatWhen,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import type { PublishedWorkflowInstance } from '@/services/published-instances-store'
import { cn } from '@/utils/cn'

interface DeploymentListItemProps {
  instance: PublishedWorkflowInstance
  compact?: boolean
  defaultExpanded?: boolean
}

export const DeploymentListItem = memo(function DeploymentListItem({
  instance,
  compact = false,
  defaultExpanded = false,
}: DeploymentListItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const healthy = instance.status === 'deployed'

  function copyEndpoint() {
    void navigator.clipboard.writeText(instance.endpointUrl).then(
      () => toast.success('Endpoint copied'),
      () => toast.error('Could not copy endpoint'),
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border/70 bg-background transition-colors',
        expanded && 'border-red-500/30',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-start gap-2.5 text-left transition-colors hover:bg-foreground/[0.03]',
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
        )}
      >
        <div
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
            healthy
              ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:text-amber-300',
          )}
        >
          <Rocket className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-semibold text-foreground">{instance.workflowName}</p>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              v{instance.version}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {instance.instanceName} · {instance.environment}
          </p>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">
            {Math.round(instance.metrics.successRate)}% success ·{' '}
            {formatLatency(instance.metrics.avgLatencyMs)} · {formatWhen(instance.deployedAt)}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div className="space-y-2.5 border-t border-border/70 bg-muted/20 px-2.5 py-2.5">
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] capitalize',
                healthy
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
              )}
            >
              {instance.status}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {instance.region}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {formatNumber(instance.metrics.totalRuns)} runs
            </Badge>
          </div>

          <p className="break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
            {instance.endpointUrl}
          </p>

          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded-md border border-border/60 bg-background px-2 py-1.5">
              <p className="text-muted-foreground">Credits</p>
              <p className="font-semibold tabular-nums text-foreground">
                {formatNumber(instance.metrics.totalCredits)}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-background px-2 py-1.5">
              <p className="text-muted-foreground">Tokens</p>
              <p className="font-semibold tabular-nums text-foreground">
                {formatNumber(instance.metrics.totalTokens)}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-background px-2 py-1.5">
              <p className="text-muted-foreground">Latency</p>
              <p className="font-semibold tabular-nums text-foreground">
                {formatLatency(instance.metrics.avgLatencyMs)}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-background px-2 py-1.5">
              <p className="text-muted-foreground">Success</p>
              <p className="font-semibold tabular-nums text-foreground">
                {Math.round(instance.metrics.successRate)}%
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 flex-1 px-2 text-[11px]"
              onClick={copyEndpoint}
            >
              <Copy className="h-3 w-3" />
              Copy
            </Button>
            <Button asChild size="sm" className="h-7 flex-1 bg-red-600 px-2 text-[11px] hover:bg-red-700">
              <a href={instance.endpointUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            </Button>
          </div>

          {instance.recentRuns.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent runs
              </p>
              {instance.recentRuns.slice(0, 3).map((run) => (
                <div
                  key={run.id}
                  className="rounded-md border border-border/60 bg-background px-2 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] font-medium capitalize text-foreground">
                      {run.status.replace('_', ' ')}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {run.durationLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                    {run.summary}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})

interface DeploymentsEmptyHintProps {
  compact?: boolean
}

export const DeploymentsEmptyHint = memo(function DeploymentsEmptyHint({
  compact = false,
}: DeploymentsEmptyHintProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border/80 bg-muted/20 text-center',
        compact ? 'px-3 py-6' : 'px-4 py-8',
      )}
    >
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-300">
        <Rocket className="h-4 w-4" />
      </div>
      <p className="mt-3 text-xs font-medium text-foreground">No deployments yet</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Validate and deploy a workflow to see it listed here.
      </p>
    </div>
  )
})

/** Open the library Deployments section from elsewhere in the workspace. */
export const OPEN_LIBRARY_DEPLOYMENTS_EVENT = 'eleven-nodes-open-library-deployments'

export function openLibraryDeployments() {
  window.dispatchEvent(new Event(OPEN_LIBRARY_DEPLOYMENTS_EVENT))
}
