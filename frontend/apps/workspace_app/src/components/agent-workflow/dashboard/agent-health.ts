import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from 'lucide-react'
import type { AgentActivity } from '@/services/activity-api'

export type Health = 'healthy' | 'degraded' | 'failing' | 'calls-only'

export const HEALTH: Record<Health, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  healthy: {
    label: 'Healthy',
    tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  failing: {
    label: 'Failing',
    tone: 'border-foreground/40 bg-foreground/10 text-foreground dark:text-foreground',
    icon: XCircle,
  },
  'calls-only': {
    label: 'No plan steps',
    tone: 'border-border bg-muted text-muted-foreground',
    icon: CircleDashed,
  },
}

/** Health from plan-step outcomes. Agents that only answer (router, planner) have no steps to judge. */
export function healthOf(agent: AgentActivity): Health {
  if (agent.steps === 0) return 'calls-only'
  const rate = agent.succeeded / agent.steps
  if (rate >= 0.9) return 'healthy'
  if (rate >= 0.7) return 'degraded'
  return 'failing'
}

export function successRate(agent: AgentActivity): string {
  return agent.steps ? `${Math.round((agent.succeeded / agent.steps) * 100)}%` : '—'
}
