import { useCallback, useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import { ReportState, Section } from '@/components/agent-workflow/dashboard/activity-ui'
import { formatNumber, formatWhen } from '@/components/agent-workflow/dashboard/dashboard-format'
import { PageIntro } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { useActivityReport } from '@/components/agent-workflow/dashboard/use-activity-report'
import { fetchRecentCalls } from '@/services/activity-api'
import { cn } from '@/utils/cn'
import { ActivityBodySkeleton } from '@/components/agent-workflow/dashboard/dashboard-skeletons'

const LIMIT = 100
const SOURCE_LABEL: Record<string, string> = { 'workflow-chat': 'Workflow AI', execute: 'Workflow run' }

/** Every recent model call, newest first, filterable by where it came from. */
export default function ActivityTab() {
  const { data, error, isLoading } = useActivityReport(useCallback(() => fetchRecentCalls(LIMIT), []), LIMIT)
  const [source, setSource] = useState<string>('all')
  const calls = useMemo(() => (data ?? []).filter((call) => source === 'all' || call.source === source), [data, source])
  const sources = Array.from(new Set((data ?? []).map((call) => call.source)))

  return (
    <div>
      <PageIntro
        eyebrow="Activity"
        title="Recent model calls"
        description={`The last ${LIMIT} calls your agents made, with the tokens each one used.`}
        actions={
          sources.length > 1 ? (
            <div className="inline-flex rounded-md border border-border/70 bg-card p-0.5" role="group" aria-label="Source">
              {['all', ...sources].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSource(value)}
                  aria-pressed={source === value}
                  className={cn(
                    'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                    source === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 'all' ? 'All' : SOURCE_LABEL[value] ?? value}
                </button>
              ))}
            </div>
          ) : null
        }
      />

      <ReportState
        isLoading={isLoading && !data}
          skeleton={<ActivityBodySkeleton />}
        error={error}
        empty={Boolean(data) && calls.length === 0}
        icon={Activity}
        emptyTitle="No activity yet"
        emptyHint="Model calls appear here as soon as a workflow runs or the Workflow AI works on a request."
      />

      {calls.length > 0 ? (
        <Section title={`${formatNumber(calls.length)} calls`} className="mt-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[11.5px]">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/70">
                  {['When', 'Workflow', 'Agent', 'Input', 'Output', 'Total'].map((heading, index) => (
                    <th key={heading} className={cn('px-2 py-1.5 font-medium', index < 3 ? 'text-left' : 'text-right')}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calls.map((call, index) => (
                  <tr key={`${call.createdAt}-${index}`} className="border-b border-border/40 last:border-0">
                    <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{formatWhen(call.createdAt)}</td>
                    <td className="px-2 py-1.5">
                      <span className="text-foreground">{call.workflow || '—'}</span>
                      <span className="ml-1.5 text-[10.5px] text-muted-foreground">{SOURCE_LABEL[call.source] ?? call.source}</span>
                    </td>
                    <td className="px-2 py-1.5 font-medium text-foreground">{call.agent}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(call.inputTokens)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(call.outputTokens)}</td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums text-foreground">{formatNumber(call.totalTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </div>
  )
}
