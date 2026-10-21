import { useState, useSyncExternalStore } from 'react'
import { BarChart3, Coins, Hash, Repeat, Wallet } from 'lucide-react'
import {
  DailyUsageChart,
  RangeSelect,
  ReportState,
  Section,
  ShareRow,
} from '@/components/agent-workflow/dashboard/activity-ui'
import {
  formatCompact,
  formatNumber,
  formatWhen,
  type RangeDays,
} from '@/components/agent-workflow/dashboard/dashboard-format'
import { PageIntro, StatCard } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { useActivityReport } from '@/components/agent-workflow/dashboard/use-activity-report'
import { TokenBudgetBar } from '@/components/agent-workflow/TokenBudgetBar'
import { fetchUsageReport } from '@/services/activity-api'
import { readTokenUsage, subscribeTokenUsage } from '@/services/token-usage-store'

const SOURCE_LABEL: Record<string, string> = {
  'workflow-chat': 'Workflow AI chat',
  execute: 'Workflow run',
}

export default function UsagePage() {
  const [days, setDays] = useState<RangeDays>(30)
  const { data, error, isLoading } = useActivityReport(fetchUsageReport, days)
  const allowance = useSyncExternalStore(subscribeTokenUsage, readTokenUsage, () => null)
  const totals = data?.totals
  const empty = Boolean(data) && (totals?.calls ?? 0) === 0

  return (
    <div>
      <PageIntro
        eyebrow="Usage"
        title="Where your tokens go"
        description="Tokens reported by the model provider for every call, by day, by workflow, and by agent."
        actions={<RangeSelect value={days} onChange={setDays} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Tokens · last ${days} days`}
          value={totals ? formatNumber(totals.totalTokens) : '—'}
          hint={totals ? `${formatCompact(totals.inputTokens)} in · ${formatCompact(totals.outputTokens)} out` : 'Loading'}
          icon={Hash}
        />
        <StatCard
          label="Model calls"
          value={totals ? formatNumber(totals.calls) : '—'}
          hint="Each request to the model"
          icon={Repeat}
        />
        <StatCard
          label="Avg tokens per call"
          value={totals && totals.calls ? formatNumber(Math.round(totals.totalTokens / totals.calls)) : '—'}
          hint="Input and output together"
          icon={Coins}
        />
        <StatCard
          label="Allowance remaining"
          value={allowance ? formatCompact(allowance.tokensRemaining) : '—'}
          hint={allowance ? `of ${formatCompact(allowance.tokenLimit)} this period` : 'Loads with your account'}
          icon={Wallet}
        />
      </div>

      <div className="mt-6">
        <ReportState
          isLoading={isLoading && !data}
          error={error}
          empty={empty}
          icon={BarChart3}
          emptyTitle="No usage in this period"
          emptyHint="Tokens appear here after you run a workflow or ask the Workflow AI to build one."
        />
      </div>

      {data && !empty ? (
        <>
          <Section title="Tokens per day" className="mt-0">
            <DailyUsageChart daily={data.daily} />
          </Section>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Section title="By workflow">
              <div className="space-y-3">
                {data.bySource.map((row) => (
                  <ShareRow
                    key={`${row.source}:${row.workflow}`}
                    label={row.workflow || SOURCE_LABEL[row.source] || row.source}
                    detail={`${SOURCE_LABEL[row.source] ?? row.source} · ${formatNumber(row.calls)} calls · ${formatWhen(row.lastUsed)}`}
                    value={row.totalTokens}
                    total={data.totals.totalTokens}
                  />
                ))}
              </div>
            </Section>
            <Section title="By agent">
              <div className="space-y-3">
                {data.byAgent.map((row) => (
                  <ShareRow
                    key={row.agentId}
                    label={row.agent}
                    detail={`${formatNumber(row.calls)} calls`}
                    value={row.totalTokens}
                    total={data.totals.totalTokens}
                  />
                ))}
              </div>
            </Section>
          </div>
        </>
      ) : null}

      <div className="mt-4 max-w-md">
        <TokenBudgetBar />
      </div>
    </div>
  )
}
