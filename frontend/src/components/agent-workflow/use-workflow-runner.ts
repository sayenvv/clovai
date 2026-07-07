import { useCallback, useRef, useState } from 'react'
import {
  WorkflowExecutionApprovalRequiredError,
  executeWorkflowFromApi,
  type WorkflowRunResponse,
} from '@/services/workflow-build-api'
import type {
  ExecutionPlanStep,
  ExecutionTraceStep,
  WorkflowExecutionEvent,
  WorkflowRunState,
} from '@/types/agent-workflow'

interface BackendExecutionTarget {
  workspaceId: string
  pageId: string
}

interface PendingExecution {
  plan: ExecutionPlanStep[]
  input: string
  target: BackendExecutionTarget
  approvedEdgeIds: string[]
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
  const trimmed = input.trim()
  if (!trimmed) return {}
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return { prompt: parsed }
  } catch {
    return { prompt: input }
  }
}

function stringifyOutput(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function durationMs(startedAt: string | null, completedAt: string | null): number | undefined {
  if (!startedAt || !completedAt) return undefined
  const duration = Date.parse(completedAt) - Date.parse(startedAt)
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined
}

function backendStatusToTraceStatus(
  status: string,
): ExecutionTraceStep['status'] {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'failed':
      return 'error'
    case 'skipped':
      return 'skipped'
    case 'running':
      return 'running'
    default:
      return 'pending'
  }
}

function findApprovalStep(plan: ExecutionPlanStep[], edgeIds: string[]): ExecutionPlanStep | null {
  const required = new Set(edgeIds)
  return plan.find((step) => step.outgoingEdgeId && required.has(step.outgoingEdgeId)) ?? null
}

function resolveActiveEdgeId(plan: ExecutionPlanStep[], stepIndex: number): string | null {
  if (stepIndex <= 0) return null
  const prevStep = plan[stepIndex - 1]
  if (prevStep?.outgoingEdgeId) return prevStep.outgoingEdgeId
  const currentStep = plan[stepIndex]
  if (prevStep && currentStep) {
    return `inferred-${prevStep.nodeId}-${currentStep.nodeId}`
  }
  return null
}

function buildVisualProgressState(
  plan: ExecutionPlanStep[],
  stepIndex: number,
  trace: ExecutionTraceStep[],
): Pick<
  WorkflowRunState,
  'currentStepIndex' | 'activeEdgeId' | 'activeNodeId' | 'completedNodeIds' | 'trace'
> {
  const clampedIndex = Math.max(0, Math.min(stepIndex, plan.length - 1))
  const step = plan[clampedIndex]
  const completedNodeIds = plan.slice(0, clampedIndex).map((candidate) => candidate.nodeId)
  const nextTrace = trace.map((entry, index) => {
    if (index < clampedIndex) {
      return {
        ...entry,
        status: 'completed' as const,
        message: 'Agent step completed.',
        timestamp: new Date().toISOString(),
      }
    }
    if (index === clampedIndex) {
      return {
        ...entry,
        status: 'running' as const,
        message: 'Executing agent…',
        timestamp: new Date().toISOString(),
      }
    }
    return {
      ...entry,
      status: 'pending' as const,
      message: 'Waiting for upstream agents…',
    }
  })

  return {
    currentStepIndex: clampedIndex,
    activeNodeId: step?.nodeId ?? null,
    activeEdgeId: resolveActiveEdgeId(plan, clampedIndex),
    completedNodeIds,
    trace: nextTrace,
  }
}

function responseToStatePatch(
  plan: ExecutionPlanStep[],
  response: WorkflowRunResponse,
): Pick<
  WorkflowRunState,
  | 'runId'
  | 'status'
  | 'currentStepIndex'
  | 'activeEdgeId'
  | 'activeNodeId'
  | 'completedNodeIds'
  | 'trace'
  | 'finalResponse'
  | 'stepOutputs'
> {
  const completedNodeIds: string[] = []
  const stepOutputs: Record<string, string> = {}
  const trace = plan.map((step) => {
    const node = response.nodes[step.nodeId]
    if (!node) {
      return {
        id: `trace-${step.nodeId}`,
        nodeId: step.nodeId,
        agentName: step.agentName,
        status: 'skipped' as const,
        message: 'Backend did not return a node result.',
        timestamp: new Date().toISOString(),
      }
    }

    const output = node.output == null ? undefined : stringifyOutput(node.output)
    if (node.status === 'completed') completedNodeIds.push(step.nodeId)
    if (output) stepOutputs[step.nodeId] = output

    return {
      id: `trace-${step.nodeId}`,
      nodeId: step.nodeId,
      agentName: step.agentName,
      status: backendStatusToTraceStatus(node.status),
      message: node.error ?? (node.status === 'completed' ? 'LLM step completed.' : node.status),
      timestamp: node.completedAt ?? node.startedAt ?? new Date().toISOString(),
      durationMs: durationMs(node.startedAt, node.completedAt),
      output,
    }
  })

  const failed = response.status === 'failed' || Object.keys(response.failures).length > 0
  return {
    runId: response.runId,
    status: failed ? 'failed' : 'completed',
    currentStepIndex: plan.length - 1,
    activeEdgeId: null,
    activeNodeId: null,
    completedNodeIds,
    trace,
    finalResponse: stringifyOutput({
      runId: response.runId,
      workflowId: response.workflowId,
      status: response.status,
      outputs: response.outputs,
      failures: response.failures,
    }),
    stepOutputs,
  }
}

const VISUAL_PROGRESS_INTERVAL_MS = 1100

export function useWorkflowRunner() {
  const [state, setState] = useState<WorkflowRunState>(initialRunState)
  const cancelRef = useRef(false)
  const pendingExecutionRef = useRef<PendingExecution | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visualStepRef = useRef(0)
  const lastTraversedEdgeRef = useRef<string | null>(null)

  const clearVisualProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const startVisualProgress = useCallback(
    (plan: ExecutionPlanStep[]) => {
      clearVisualProgress()
      visualStepRef.current = 0
      lastTraversedEdgeRef.current = null

      if (plan.length === 0) return

      setState((previous) => ({
        ...previous,
        ...buildVisualProgressState(plan, 0, previous.trace),
      }))

      progressTimerRef.current = setInterval(() => {
        if (cancelRef.current) {
          clearVisualProgress()
          return
        }

        setState((previous) => {
          if (previous.status !== 'running') return previous

          const maxIndex = plan.length - 1
          if (visualStepRef.current >= maxIndex) return previous

          visualStepRef.current = Math.min(visualStepRef.current + 1, maxIndex)
          const patch = buildVisualProgressState(plan, visualStepRef.current, previous.trace)
          const traversedEdge = patch.activeEdgeId

          if (traversedEdge && traversedEdge !== lastTraversedEdgeRef.current) {
            lastTraversedEdgeRef.current = traversedEdge
            const fromStep = plan[visualStepRef.current - 1]
            const toStep = plan[visualStepRef.current]
            return {
              ...previous,
              ...patch,
              events: [
                ...previous.events,
                {
                  id: createEventId(),
                  kind: 'edge-traverse',
                  level: 'info',
                  message: `Flow moved to ${toStep?.agentName ?? 'next agent'}`,
                  timestamp: new Date().toISOString(),
                  edgeId: traversedEdge,
                  agentName: fromStep?.agentName,
                },
              ],
            }
          }

          return { ...previous, ...patch }
        })
      }, VISUAL_PROGRESS_INTERVAL_MS)
    },
    [clearVisualProgress],
  )

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
      const { plan, input, target, approvedEdgeIds } = execution
      startVisualProgress(plan)
      try {
        const response = await executeWorkflowFromApi(target.workspaceId, target.pageId, {
          inputs: parseWorkflowInput(input),
          metadata: {
            source: 'workflow-editor',
          },
          approvedEdgeIds,
          raiseOnError: false,
        })
        clearVisualProgress()
        if (cancelRef.current) return

        const patch = responseToStatePatch(plan, response)
        setState((previous) => ({
          ...previous,
          ...patch,
          approvalPrompt: null,
        }))

        appendEvent({
          kind: patch.status === 'failed' ? 'error' : 'workflow-complete',
          level: patch.status === 'failed' ? 'error' : 'success',
          message:
            patch.status === 'failed'
              ? 'Workflow execution finished with failures.'
              : 'Workflow execution finished through backend Microsoft Agent Framework.',
          detail: `Run ${response.runId}`,
        })
      } catch (error) {
        clearVisualProgress()
        if (cancelRef.current) return

        if (error instanceof WorkflowExecutionApprovalRequiredError) {
          const approvalStep = findApprovalStep(plan, error.requiredEdgeIds)
          const edgeId = error.requiredEdgeIds[0] ?? approvalStep?.outgoingEdgeId ?? null
          const nextAgentName = approvalStep?.nextAgentName ?? 'next agent'
          pendingExecutionRef.current = {
            ...execution,
            approvedEdgeIds: Array.from(
              new Set([...execution.approvedEdgeIds, ...error.requiredEdgeIds]),
            ),
          }
          setState((previous) => ({
            ...previous,
            status: 'waiting-approval',
            activeEdgeId: edgeId,
            activeNodeId: approvalStep?.nodeId ?? null,
            approvalPrompt: edgeId
              ? {
                  edgeId,
                  message: approvalStep?.approvalMessage ?? error.message,
                  role: approvalStep?.approvalRole ?? 'reviewer',
                  nextAgentName,
                }
              : null,
            trace: previous.trace.map((step) =>
              step.nodeId === approvalStep?.nodeId
                ? {
                    ...step,
                    status: 'waiting-approval',
                    message: `Waiting for ${approvalStep?.approvalRole ?? 'reviewer'} approval`,
                    timestamp: new Date().toISOString(),
                  }
                : step,
            ),
          }))
          appendEvent({
            kind: 'approval-wait',
            level: 'warning',
            message: 'Backend requires approval before real LLM execution.',
            edgeId: edgeId ?? undefined,
            agentName: nextAgentName,
          })
          return
        }

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
    [appendEvent, clearVisualProgress, startVisualProgress],
  )

  const submitApproval = useCallback(
    (response: string) => {
      const trimmed = response.trim()
      if (!trimmed) return
      const pending = pendingExecutionRef.current
      if (!pending) return

      appendEvent({
        kind: 'approval-received',
        level: 'success',
        message: `Approval submitted: ${trimmed.slice(0, 80)}`,
      })
      setState((previous) => ({
        ...previous,
        status: 'running',
        approvalPrompt: null,
      }))
      pendingExecutionRef.current = null
      void runBackendExecution(pending)
    },
    [appendEvent, runBackendExecution],
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
    clearVisualProgress()
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
  }, [appendEvent, clearVisualProgress])

  const reset = useCallback(() => {
    cancelRef.current = false
    clearVisualProgress()
    pendingExecutionRef.current = null
    setState(initialRunState())
  }, [clearVisualProgress])

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
        activeNodeId: plan[0]?.nodeId ?? null,
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
        message: 'Calling backend /execute via Microsoft Agent Framework.',
        detail: `${target.workspaceId}/${target.pageId} · ${plan.length} agent step(s)`,
      })

      await runBackendExecution({
        plan,
        input,
        target,
        approvedEdgeIds: [],
      })
    },
    [appendEvent, runBackendExecution],
  )

  return {
    state,
    start,
    submitApproval,
    cancel,
    reset,
  }
}
