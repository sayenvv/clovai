import { useCallback, useRef, useState } from 'react'
import { executeOrchestration } from '@/services/orchestration-api'
import type {
  ExecutionPlanStep,
  ExecutionTraceStep,
  WorkflowExecutionEvent,
  WorkflowRunState,
} from '@/types/agent-workflow'

interface BackendExecutionTarget {
  workspaceId: string
  pageId: string
  userId: string
}

interface PendingExecution {
  plan: ExecutionPlanStep[]
  input: string
  target: BackendExecutionTarget
  approvedEdgeIds: string[]
  pendingEdgeIds: string[]
  reviewerFeedback: string
  previousOutput: unknown
  revisionCount: number
}

function createEventId(): string {
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function initialRunState(): WorkflowRunState {
  return {
    runId: null,
    status: 'idle',
    currentStepIndex: -1,
    activeEdgeId: null,
    activeNodeId: null,
    completedNodeIds: [],
    events: [],
    trace: [],
    errors: [],
    warnings: [],
    finalResponse: null,
    stepOutputs: {},
    approvalPrompt: null,
  }
}

function buildInitialTrace(plan: ExecutionPlanStep[]): ExecutionTraceStep[] {
  return plan.map((step) => ({
    id: `trace-${step.nodeId}`,
    nodeId: step.nodeId,
    agentName: step.agentName,
    status: 'pending',
    message: 'Waiting for backend execution…',
    timestamp: new Date().toISOString(),
  }))
}

function parseWorkflowInput(input: string): Record<string, unknown> {
  const prompt = input.trim()
  return prompt ? { prompt } : {}
}

function responseText(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return ''
  const record = detail as Record<string, unknown>
  if (typeof record.text === 'string' && record.text.trim()) return record.text.trim()
  const workflow = record.workflow
  if (workflow && typeof workflow === 'object') {
    const output = (workflow as { output?: { text?: unknown } }).output
    if (typeof output?.text === 'string' && output.text.trim()) return output.text.trim()
  }
  return ''
}

function detailRecord(detail: unknown): Record<string, unknown> | null {
  return detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : null
}

function matchPlanStep(
  plan: ExecutionPlanStep[],
  detail: Record<string, unknown> | null,
): ExecutionPlanStep | undefined {
  const nodeId = typeof detail?.nodeId === 'string' ? detail.nodeId : ''
  const agent = typeof detail?.agent === 'string' ? detail.agent.trim().toLowerCase() : ''
  return (
    plan.find((step) => nodeId && step.nodeId === nodeId) ??
    plan.find((step) => agent && step.agentName.trim().toLowerCase() === agent)
  )
}

function withAgentActivity(
  previous: WorkflowRunState,
  plan: ExecutionPlanStep[],
  event: { step?: string; status?: string; message?: string; detail?: unknown },
): WorkflowRunState {
  if (event.step !== 'agent') return previous
  const detail = detailRecord(event.detail)
  const step = matchPlanStep(plan, detail)
  if (!step) return previous
  const phase = event.status
  const timestamp = new Date().toISOString()
  if (phase === 'started') {
    const index = plan.findIndex((candidate) => candidate.nodeId === step.nodeId)
    return {
      ...previous,
      currentStepIndex: index,
      activeNodeId: step.nodeId,
      completedNodeIds: previous.completedNodeIds.filter((id) => id !== step.nodeId),
      trace: previous.trace.map((entry) =>
        entry.nodeId === step.nodeId
          ? { ...entry, status: 'running', message: event.message || `${step.agentName} started`, timestamp }
          : entry,
      ),
    }
  }
  if (phase === 'completed' || phase === 'failed') {
    const completedNodeIds =
      phase === 'completed'
        ? Array.from(new Set([...previous.completedNodeIds, step.nodeId]))
        : previous.completedNodeIds
    return {
      ...previous,
      activeNodeId: previous.activeNodeId === step.nodeId ? null : previous.activeNodeId,
      completedNodeIds,
      trace: previous.trace.map((entry) =>
        entry.nodeId === step.nodeId
          ? {
              ...entry,
              status: phase === 'completed' ? 'completed' : 'error',
              message: event.message || `${step.agentName} finished`,
              timestamp,
            }
          : entry,
      ),
    }
  }
  return previous
}

export function useWorkflowRunner() {
  const [state, setState] = useState<WorkflowRunState>(initialRunState)
  const cancelRef = useRef(false)
  const pendingExecutionRef = useRef<PendingExecution | null>(null)

  const appendEvent = useCallback((event: Omit<WorkflowExecutionEvent, 'id' | 'timestamp'>) => {
    const full: WorkflowExecutionEvent = {
      ...event,
      id: createEventId(),
      timestamp: new Date().toISOString(),
    }
    setState((previous) => ({
      ...previous,
      events: [...previous.events, full],
      errors: event.level === 'error' ? [...previous.errors, full] : previous.errors,
      warnings: event.level === 'warning' ? [...previous.warnings, full] : previous.warnings,
    }))
    return full
  }, [])

  const runBackendExecution = useCallback(
    async (execution: PendingExecution) => {
      const { plan, input, target } = execution
      try {
        let failed = false
        let reply = ''
        await executeOrchestration({
          identity: {
            workspaceId: target.workspaceId,
            tabId: target.pageId,
            userId: target.userId,
          },
          inputs: parseWorkflowInput(input),
          onEvent: (event) => {
            if (cancelRef.current) return
            const message = event.message || event.step || 'Execution update'
            const detail = event.detail === undefined ? undefined : JSON.stringify(event.detail)
            const text = responseText(event.detail)
            if (text) reply = text
            const failedEvent = event.event === 'error' || event.status === 'failed'
            const finished = event.event === 'done' || event.step === 'finished'
            const kind: WorkflowExecutionEvent['kind'] = failedEvent
              ? 'error'
              : finished
                ? 'workflow-complete'
                : event.step === 'agent' && event.status === 'completed'
                  ? 'agent-complete'
                  : event.step === 'agent'
                    ? 'agent-start'
                    : 'workflow-start'
            const level: WorkflowExecutionEvent['level'] = failedEvent
              ? 'error'
              : finished
                ? 'success'
                : 'info'
            if (failedEvent) failed = true
            const matched = matchPlanStep(plan, detailRecord(event.detail))
            const full: WorkflowExecutionEvent = {
              id: createEventId(),
              kind,
              level,
              message,
              detail,
              timestamp: new Date().toISOString(),
              nodeId: matched?.nodeId,
              agentName: matched?.agentName,
            }
            setState((previous) => {
              const withActivity = withAgentActivity(previous, plan, event)
              return {
                ...withActivity,
                events: [...withActivity.events, full],
                errors: level === 'error' ? [...withActivity.errors, full] : withActivity.errors,
                warnings: level === 'warning' ? [...withActivity.warnings, full] : withActivity.warnings,
              }
            })
          },
        })
        if (cancelRef.current) return
        setState((previous) => {
          const last = plan[plan.length - 1]
          const trace = reply
            ? previous.trace.map((step, index, all) =>
                index === all.length - 1
                  ? { ...step, status: 'completed' as const, output: reply, message: 'Completed' }
                  : step,
              )
            : previous.trace
          return {
            ...previous,
            status: failed ? 'failed' : 'completed',
            activeNodeId: null,
            activeEdgeId: null,
            approvalPrompt: null,
            completedNodeIds: previous.completedNodeIds,
            finalResponse: reply || previous.finalResponse,
            trace,
            stepOutputs:
              reply && last ? { ...previous.stepOutputs, [last.nodeId]: reply } : previous.stepOutputs,
          }
        })
      } catch (error) {
        if (cancelRef.current) return
        const message = error instanceof Error ? error.message : 'Workflow execution failed.'
        setState((previous) => ({
          ...previous,
          status: 'failed',
          activeNodeId: null,
          activeEdgeId: null,
          approvalPrompt: null,
        }))
        appendEvent({
          kind: 'error',
          level: 'error',
          message,
        })
      }
    },
    [appendEvent],
  )

  const submitApproval = useCallback(
    (response: string) => {
      const pending = pendingExecutionRef.current
      if (!pending) return
      const note = response.trim()

      appendEvent({
        kind: 'approval-received',
        level: 'success',
        message: note ? `Approved: ${note.slice(0, 80)}` : 'Approved — continuing workflow.',
      })
      setState((previous) => ({
        ...previous,
        status: 'running',
        approvalPrompt: null,
      }))
      const nextExecution: PendingExecution = {
        ...pending,
        approvedEdgeIds: Array.from(new Set([...pending.approvedEdgeIds, ...pending.pendingEdgeIds])),
        pendingEdgeIds: [],
        reviewerFeedback: '',
        revisionCount: 0,
      }
      pendingExecutionRef.current = nextExecution
      void runBackendExecution(nextExecution)
    },
    [appendEvent, runBackendExecution],
  )

  const submitFeedback = useCallback(
    (feedback: string) => {
      const trimmed = feedback.trim()
      if (!trimmed) return
      const pending = pendingExecutionRef.current
      if (!pending) return

      appendEvent({
        kind: 'approval-received',
        level: 'warning',
        message: `Requested changes: ${trimmed.slice(0, 80)}`,
      })
      setState((previous) => ({
        ...previous,
        status: 'running',
        approvalPrompt: null,
      }))
      const nextExecution: PendingExecution = {
        ...pending,
        reviewerFeedback: trimmed,
        revisionCount: pending.revisionCount + 1,
      }
      pendingExecutionRef.current = nextExecution
      void runBackendExecution(nextExecution)
    },
    [appendEvent, runBackendExecution],
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
    pendingExecutionRef.current = null
    setState((previous) => ({
      ...previous,
      status: 'cancelled',
      activeNodeId: null,
      activeEdgeId: null,
      approvalPrompt: null,
    }))
    appendEvent({
      kind: 'error',
      level: 'warning',
      message: 'Execution cancelled by user.',
    })
  }, [appendEvent])

  const reset = useCallback(() => {
    cancelRef.current = false
    pendingExecutionRef.current = null
    setState(initialRunState())
  }, [])

  const start = useCallback(
    async (plan: ExecutionPlanStep[], input: string, target: BackendExecutionTarget) => {
      if (plan.length === 0) {
        appendEvent({
          kind: 'error',
          level: 'error',
          message: 'No agents in this workflow. Add at least one Agent block in the editor.',
        })
        setState((previous) => ({ ...previous, status: 'failed' }))
        return
      }

      cancelRef.current = false
      pendingExecutionRef.current = null
      const trace = buildInitialTrace(plan)

      setState({
        runId: null,
        status: 'running',
        currentStepIndex: -1,
        activeEdgeId: null,
        activeNodeId: null,
        completedNodeIds: [],
        events: [],
        trace,
        errors: [],
        warnings: [],
        finalResponse: null,
        stepOutputs: {},
        approvalPrompt: null,
      })

      appendEvent({
        kind: 'workflow-start',
        level: 'info',
        message: 'Streaming execution logs from the Eleven Nodes runtime.',
        detail: `${target.workspaceId}/${target.pageId} · ${plan.length} agent step(s)`,
      })

      await runBackendExecution({
        plan,
        input,
        target,
        approvedEdgeIds: [],
        pendingEdgeIds: [],
        reviewerFeedback: '',
        previousOutput: null,
        revisionCount: 0,
      })
    },
    [appendEvent, runBackendExecution],
  )

  return {
    state,
    start,
    submitApproval,
    submitFeedback,
    cancel,
    reset,
  }
}
