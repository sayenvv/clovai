import { useCallback, useEffect, useState } from 'react'
import {
  fetchMonitoredWorkflows,
  fetchUsageReport,
  type DailyUsage,
  type MonitoredWorkflow,
} from '@/services/activity-api'

export const ACTIVITY_DAYS = 7

/** The workflow's runs and agents over the last week, and the account's model calls per day. */
export function useWorkflowActivity(workflowId: string) {
  const [workflow, setWorkflow] = useState<MonitoredWorkflow | undefined>()
  const [daily, setDaily] = useState<DailyUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([fetchMonitoredWorkflows(ACTIVITY_DAYS), fetchUsageReport(ACTIVITY_DAYS)]).then(
      ([workflows, usage]) => {
        if (cancelled) return
        setWorkflow(
          workflows.status === 'fulfilled'
            ? workflows.value.find((item) => item.workflowId === workflowId)
            : undefined,
        )
        setDaily(usage.status === 'fulfilled' ? usage.value.daily : [])
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [workflowId, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  return { workflow, daily, loading, reload }
}
