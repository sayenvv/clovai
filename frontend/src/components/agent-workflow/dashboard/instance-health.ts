import type { PublishedWorkflowInstance } from '@/services/published-instances-store'

export type InstanceHealth = 'healthy' | 'watch' | 'critical'

export function getInstanceHealth(item: PublishedWorkflowInstance): InstanceHealth {
  if (item.status === 'failed') return 'critical'
  if (item.metrics.successRate < 75 || item.metrics.failed > item.metrics.succeeded) {
    return 'critical'
  }
  if (item.metrics.successRate < 90 || item.metrics.waiting > 0 || item.metrics.running > 0) {
    return 'watch'
  }
  return 'healthy'
}

export const HEALTH_LABEL: Record<InstanceHealth, string> = {
  healthy: 'Healthy',
  watch: 'Needs watch',
  critical: 'Critical',
}

export const HEALTH_TONE: Record<InstanceHealth, string> = {
  healthy:
    'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  watch: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  critical: 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300',
}

export function fleetHealthScore(instances: PublishedWorkflowInstance[]): number {
  if (instances.length === 0) return 0
  const scores = instances.map((item) => {
    const health = getInstanceHealth(item)
    if (health === 'healthy') return 100
    if (health === 'watch') return 70
    return 35
  })
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
