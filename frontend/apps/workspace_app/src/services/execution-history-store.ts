import { useSyncExternalStore } from 'react'
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

const STORAGE_KEY = 'eleven-nodes.executions'
const MAX_RECORDS = 100

let records: ExecutionRecord[] = load()
const listeners = new Set<() => void>()

function load(): ExecutionRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as ExecutionRecord[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Storage full or blocked: keep the history for this session only.
  }
  listeners.forEach((listener) => listener())
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

/** All recorded runs, newest first. */
export function useExecutions(): ExecutionRecord[] {
  return useSyncExternalStore(subscribe, () => records, () => records)
}
