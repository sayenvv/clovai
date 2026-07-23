import { STORAGE_KEYS } from '@/constants'
import type { ProjectAccountType } from '@/services/project-auth-store'

export type PublishedInstanceStatus = 'deployed' | 'failed'

export type PublishedRunStatus =
  | 'succeeded'
  | 'failed'
  | 'running'
  | 'waiting_approval'
  | 'cancelled'

export interface PublishedInstanceMetrics {
  totalRuns: number
  succeeded: number
  failed: number
  waiting: number
  running: number
  successRate: number
  totalCredits: number
  totalTokens: number
  avgLatencyMs: number
  avgCpuPct: number
  avgMemoryMb: number
  totalToolCalls: number
  creditBreakdown: {
    llm: number
    tools: number
    compute: number
    approval: number
  }
}

export interface PublishedInstanceRun {
  id: string
  runId: string
  status: PublishedRunStatus
  startedAt: string
  durationLabel: string
  summary: string
  tokens: number
  credits: number
  costUsd: number
  cpuPct: number
  memoryMb: number
}

export interface PublishedWorkflowInstance {
  id: string
  accountId: string
  workspaceId: string
  workflowId: string
  workflowName: string
  instanceName: string
  accountType: ProjectAccountType
  endpointUrl: string
  triggerMethod: 'POST' | 'GET'
  authType: 'api-key' | 'bearer' | 'none'
  version: number
  status: PublishedInstanceStatus
  deployedAt: string
  region: string
  environment: 'production' | 'staging'
  metrics: PublishedInstanceMetrics
  recentRuns: PublishedInstanceRun[]
}

export interface UpsertPublishedInstanceInput {
  accountId: string
  workspaceId: string
  workflowId: string
  workflowName: string
  instanceName: string
  accountType: ProjectAccountType
  endpointUrl: string
  version: number
  triggerMethod?: 'POST' | 'GET'
  authType?: 'api-key' | 'bearer' | 'none'
  status?: PublishedInstanceStatus
  deployedAt?: string
}

function hashSeed(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash
}

function buildTelemetry(
  seedKey: string,
  deployedAt: string,
): Pick<PublishedWorkflowInstance, 'metrics' | 'recentRuns' | 'region' | 'environment'> {
  const hash = hashSeed(seedKey)
  const totalRuns = 8 + (hash % 42)
  const failed = Math.min(totalRuns, hash % 5)
  const waiting = Math.min(totalRuns - failed, hash % 3)
  const running = Math.min(Math.max(0, totalRuns - failed - waiting), hash % 2)
  const succeeded = Math.max(0, totalRuns - failed - waiting - running)
  const totalTokens = 12_000 + (hash % 80_000)
  const totalCredits = Number((18 + (hash % 220) + totalRuns * 1.35).toFixed(2))
  const llm = Number((totalCredits * 0.52).toFixed(2))
  const tools = Number((totalCredits * 0.22).toFixed(2))
  const compute = Number((totalCredits * 0.18).toFixed(2))
  const approval = Number(Math.max(0, totalCredits - llm - tools - compute).toFixed(2))

  const statuses: PublishedRunStatus[] = [
    'succeeded',
    'succeeded',
    'succeeded',
    'failed',
    'waiting_approval',
    'running',
    'cancelled',
  ]
  const summaries = [
    'Completed end-to-end agent path',
    'Tool call latency within budget',
    'Human approval pending on review node',
    'LLM timeout on secondary agent',
    'Streaming response finalized',
    'Cancelled by operator',
    'Parallel branch merged successfully',
  ]

  const recentRuns: PublishedInstanceRun[] = Array.from({ length: 6 }, (_, index) => {
    const runHash = hashSeed(`${seedKey}:${index}`)
    const status = statuses[(runHash + index) % statuses.length]
    const tokens = 400 + (runHash % 4200)
    const credits = Number((0.8 + (runHash % 40) / 10).toFixed(2))
    const minutesAgo = 12 + index * 37 + (runHash % 20)
    const started = new Date(new Date(deployedAt).getTime() - minutesAgo * 60_000)
    return {
      id: `run_${seedKey.slice(-6)}_${index}`,
      runId: `run_${(runHash % 0xfffff).toString(16)}`,
      status,
      startedAt: started.toISOString(),
      durationLabel:
        status === 'running' ? '—' : `${1 + (runHash % 48)}.${runHash % 9}s`,
      summary: summaries[(runHash + index) % summaries.length],
      tokens,
      credits,
      costUsd: Number((credits * 0.012).toFixed(3)),
      cpuPct: 28 + (runHash % 55),
      memoryMb: 180 + (runHash % 420),
    }
  })

  return {
    region: hash % 2 === 0 ? 'ap-south-1' : 'us-east-1',
    environment: hash % 3 === 0 ? 'staging' : 'production',
    metrics: {
      totalRuns,
      succeeded,
      failed,
      waiting,
      running,
      successRate:
        totalRuns === 0 ? 0 : Number(((succeeded / totalRuns) * 100).toFixed(1)),
      totalCredits,
      totalTokens,
      avgLatencyMs: 900 + (hash % 4200),
      avgCpuPct: Number((32 + (hash % 48) + failed).toFixed(1)),
      avgMemoryMb: 220 + (hash % 380),
      totalToolCalls: totalRuns * (1 + (hash % 3)),
      creditBreakdown: { llm, tools, compute, approval },
    },
    recentRuns,
  }
}

function normalizeInstance(raw: PublishedWorkflowInstance): PublishedWorkflowInstance {
  if (raw.metrics && raw.recentRuns?.length) {
    return {
      ...raw,
      triggerMethod: raw.triggerMethod ?? 'POST',
      authType: raw.authType ?? 'api-key',
      region: raw.region ?? 'ap-south-1',
      environment: raw.environment ?? 'production',
    }
  }
  const telemetry = buildTelemetry(
    `${raw.accountId}:${raw.workspaceId}:${raw.workflowId}`,
    raw.deployedAt,
  )
  return {
    ...raw,
    triggerMethod: raw.triggerMethod ?? 'POST',
    authType: raw.authType ?? 'api-key',
    ...telemetry,
  }
}

function readAll(): PublishedWorkflowInstance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.publishedInstances)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PublishedWorkflowInstance[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeInstance)
  } catch {
    return []
  }
}

function writeAll(items: PublishedWorkflowInstance[]): void {
  localStorage.setItem(STORAGE_KEYS.publishedInstances, JSON.stringify(items))
  window.dispatchEvent(new Event('eleven-nodes-published-instances'))
}

export function listPublishedInstances(accountId?: string): PublishedWorkflowInstance[] {
  const items = readAll()
  const filtered = accountId ? items.filter((item) => item.accountId === accountId) : items
  return filtered.sort(
    (a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime(),
  )
}

export function getPublishedInstance(id: string): PublishedWorkflowInstance | null {
  return readAll().find((item) => item.id === id) ?? null
}

export function getPublishedDashboardStats(accountId?: string) {
  const instances = listPublishedInstances(accountId)
  const metrics = instances.reduce(
    (acc, item) => {
      acc.totalRuns += item.metrics.totalRuns
      acc.succeeded += item.metrics.succeeded
      acc.failed += item.metrics.failed
      acc.totalCredits += item.metrics.totalCredits
      acc.totalTokens += item.metrics.totalTokens
      return acc
    },
    { totalRuns: 0, succeeded: 0, failed: 0, totalCredits: 0, totalTokens: 0 },
  )
  return {
    instanceCount: instances.length,
    liveCount: instances.filter((item) => item.status === 'deployed').length,
    ...metrics,
    totalCredits: Number(metrics.totalCredits.toFixed(2)),
    successRate:
      metrics.totalRuns === 0
        ? 0
        : Number(((metrics.succeeded / metrics.totalRuns) * 100).toFixed(1)),
    latestDeployAt: instances[0]?.deployedAt ?? null,
  }
}

export function upsertPublishedInstance(
  input: UpsertPublishedInstanceInput,
): PublishedWorkflowInstance {
  const items = readAll()
  const deployedAt = input.deployedAt ?? new Date().toISOString()
  const existingIndex = items.findIndex(
    (item) =>
      item.accountId === input.accountId &&
      item.workspaceId === input.workspaceId &&
      item.workflowId === input.workflowId,
  )

  const seedKey = `${input.accountId}:${input.workspaceId}:${input.workflowId}`
  const telemetry = buildTelemetry(seedKey, deployedAt)
  const previous = existingIndex >= 0 ? items[existingIndex] : null

  const next: PublishedWorkflowInstance = {
    id: previous?.id ?? `pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    accountId: input.accountId,
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    workflowName: input.workflowName.trim() || 'Untitled workflow',
    instanceName: input.instanceName,
    accountType: input.accountType,
    endpointUrl: input.endpointUrl,
    triggerMethod: input.triggerMethod ?? previous?.triggerMethod ?? 'POST',
    authType: input.authType ?? previous?.authType ?? 'api-key',
    version: input.version,
    status: input.status ?? 'deployed',
    deployedAt,
    // Keep evolving telemetry on redeploy; bump runs slightly from previous.
    region: previous?.region ?? telemetry.region,
    environment: previous?.environment ?? telemetry.environment,
    metrics: previous
      ? {
          ...telemetry.metrics,
          totalRuns: previous.metrics.totalRuns + 1 + (hashSeed(deployedAt) % 3),
          succeeded: previous.metrics.succeeded + 1,
          successRate: Number(
            (
              ((previous.metrics.succeeded + 1) /
                (previous.metrics.totalRuns + 1 + (hashSeed(deployedAt) % 3))) *
              100
            ).toFixed(1),
          ),
          totalCredits: Number(
            (previous.metrics.totalCredits + telemetry.metrics.totalCredits * 0.08).toFixed(2),
          ),
        }
      : telemetry.metrics,
    recentRuns: telemetry.recentRuns,
  }

  if (existingIndex >= 0) {
    items[existingIndex] = next
  } else {
    items.unshift(next)
  }
  writeAll(items)
  return next
}
