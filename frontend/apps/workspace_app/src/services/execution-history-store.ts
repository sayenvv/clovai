import { useSyncExternalStore } from 'react'
import { getSession } from '@/services/project-auth-store'
import type {
  ExecutionTraceStep,
  WorkflowChatMessage,
  WorkflowExecutionEvent,
  WorkflowRunStatus,
} from '@/types/agent-workflow'

/** One finished workflow run, kept so the Executions view can show its full trace. */
export interface ExecutionRecord {
  id: string
  runId: string | null
  workflowName: string
  pageId: string
  status: Extract<WorkflowRunStatus, 'completed' | 'failed' | 'cancelled'>
  input: string
  startedAt: string
  finishedAt: string
  trace: ExecutionTraceStep[]
  /** Each agent's turns, in the order they spoke. */
  messages: WorkflowChatMessage[]
  stepOutputs: Record<string, string>
  finalResponse: string | null
  errors: WorkflowExecutionEvent[]
  warnings: WorkflowExecutionEvent[]
}

// Runs are kept per account: one browser can be used by several people, and each sees only
// their own runs.
const STORAGE_PREFIX = 'eleven-nodes.executions'
// The list from before runs were per account; nobody can tell whose it was, so it is removed
const UNSCOPED_KEY = STORAGE_PREFIX
const MAX_RECORDS = 100

const storageKey = (accountId: string | undefined) => (accountId ? `${STORAGE_PREFIX}:${accountId}` : null)

let key = storageKey(getSession()?.accountId)
let records: ExecutionRecord[] = load(key)
const listeners = new Set<() => void>()

function load(from: string | null): ExecutionRecord[] {
  if (!from) return []
  try {
    window.localStorage.removeItem(UNSCOPED_KEY)
    const raw = window.localStorage.getItem(from)
    const parsed = raw ? (JSON.parse(raw) as ExecutionRecord[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist() {
  try {
    if (key) window.localStorage.setItem(key, JSON.stringify(records))
  } catch {
    // Storage full or blocked: keep the history for this session only.
  }
  listeners.forEach((listener) => listener())
}

// Signing in as someone else shows their runs, never the previous person's.
if (typeof window !== 'undefined') {
  window.addEventListener('eleven-nodes-project-session', () => {
    const next = storageKey(getSession()?.accountId)
    if (next === key) return
    key = next
    records = load(key)
    listeners.forEach((listener) => listener())
  })
}

/** Record a finished run (newest first). */
export function addExecution(record: ExecutionRecord) {
  records = [record, ...records.filter((item) => item.id !== record.id)].slice(0, MAX_RECORDS)
  persist()
}

export function deleteExecution(id: string) {
  records = records.filter((item) => item.id !== id)
  persist()
}

/** Clear the history of one workflow tab. */
export function clearExecutions(pageId: string) {
  records = records.filter((item) => item.pageId !== pageId)
  persist()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The signed-in account's recorded runs, newest first. */
export function useExecutions(): ExecutionRecord[] {
  return useSyncExternalStore(subscribe, () => records, () => records)
}
