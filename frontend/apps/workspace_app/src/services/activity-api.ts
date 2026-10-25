import { authorizedFetch } from '@/services/api-auth'
import { errorMessage } from '@/services/orchestration-api'

export interface UsageCounts {
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface DailyUsage extends UsageCounts {
  /** ISO date, one entry per day in the window, including days without usage. */
  date: string
}

export interface UsageReport {
  days: number
  totals: UsageCounts
  daily: DailyUsage[]
  bySource: Array<{ source: string; workflow: string; calls: number; totalTokens: number; lastUsed: string }>
  byAgent: Array<{ agentId: string; agent: string; calls: number; totalTokens: number }>
}

export interface AgentActivity {
  agentId: string
  agent: string
  calls: number
  totalTokens: number
  lastActive: string | null
  /** Plan steps this agent ran, and how they ended. */
  steps: number
  succeeded: number
  failed: number
  avgAttempts: number | null
}

export interface AgentsReport {
  days: number
  agents: AgentActivity[]
}

async function getJson<T>(path: string): Promise<T> {
  const response = await authorizedFetch(path)
  if (!response.ok) throw new Error(await errorMessage(response))
  return (await response.json()) as T
}

/** Token usage recorded for the signed-in user over the last `days` days. */
export function fetchUsageReport(days: number): Promise<UsageReport> {
  return getJson(`/api/v1/activity/usage?days=${days}`)
}

/** Each agent's calls, tokens, and plan-step outcomes over the last `days` days. */
export function fetchAgentsReport(days: number): Promise<AgentsReport> {
  return getJson(`/api/v1/activity/agents?days=${days}`)
}

export interface RecentCall {
  source: string
  workflow: string
  agentId: string
  agent: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  createdAt: string
}

export interface SavedWorkflowSummary {
  id: string
  workflow_id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

/** The latest model calls, newest first. */
export async function fetchRecentCalls(limit = 50): Promise<RecentCall[]> {
  const body = await getJson<{ calls: RecentCall[] }>(`/api/v1/activity/recent?limit=${limit}`)
  return body.calls
}

/** The signed-in user's saved workflows, newest first. */
export function fetchSavedWorkflows(): Promise<SavedWorkflowSummary[]> {
  return getJson('/api/v1/workflows')
}

export interface TabAgent {
  id: string
  name: string
  role: string
  calls: number
  totalTokens: number
  /** Runs of this workflow the agent took part in. */
  runs: number
  lastActive: string | null
}

export interface MonitoredWorkflow {
  workflowId: string
  name: string
  updatedAt: string
  agents: TabAgent[]
  runs: {
    total: number
    succeeded: number
    failed: number
    avgDurationMs: number | null
    totalTokens: number
    lastRun: string | null
    lastError: string
  }
}

/** Each of the user's saved workflows with its agents and their activity over the last `days` days. */
export async function fetchMonitoredWorkflows(days: number): Promise<MonitoredWorkflow[]> {
  const body = await getJson<{ workflows: MonitoredWorkflow[] }>(`/api/v1/activity/workflows?days=${days}`)
  return body.workflows
}
