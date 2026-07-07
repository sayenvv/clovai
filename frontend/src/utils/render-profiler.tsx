import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react'

const STORAGE_KEY = 'eleven-nodes:perf'
const THRESHOLD_MS = 4

/** Enable in dev: `localStorage.setItem('eleven-nodes:perf', '1')` then reload. */
export function isRenderProfilingEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const onRenderProfile: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
) => {
  if (!isRenderProfilingEnabled() || actualDuration < THRESHOLD_MS) return
  const baseHint =
    baseDuration > actualDuration + 0.5 ? ` (memo base ${baseDuration.toFixed(1)}ms)` : ''
  console.debug(`[perf] ${id}: ${actualDuration.toFixed(1)}ms ${phase}${baseHint}`)
}

export function DevProfiler({ id, children }: { id: string; children: ReactNode }) {
  if (!isRenderProfilingEnabled()) return children
  return (
    <Profiler id={id} onRender={onRenderProfile}>
      {children}
    </Profiler>
  )
}
