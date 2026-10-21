import { useEffect, useState } from 'react'

interface ReportState<T> {
  data: T | null
  error: string | null
  isLoading: boolean
}

/** Load a dashboard report for a window of days, reloading when the window changes. */
export function useActivityReport<T>(load: (days: number) => Promise<T>, days: number): ReportState<T> {
  const [state, setState] = useState<ReportState<T>>({ data: null, error: null, isLoading: true })

  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ ...previous, isLoading: true, error: null }))
    load(days)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, isLoading: false })
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setState({ data: null, error: reason instanceof Error ? reason.message : 'Could not load this report.', isLoading: false })
        }
      })
    return () => {
      cancelled = true
    }
  }, [load, days])

  return state
}
