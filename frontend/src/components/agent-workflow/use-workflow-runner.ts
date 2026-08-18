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

function buildApprovalPrompt(
  plan: ExecutionPlanStep[],
  edgeIds: string[],
  revisionCount: number,
): WorkflowRunState['approvalPrompt'] {
  const required = new Set(edgeIds)
  const step =
    plan.find((candidate) => candidate.outgoingEdgeId && required.has(candidate.outgoingEdgeId)) ??
    plan.find((candidate) => candidate.humanApproval) ??
    null
  const edgeId = edgeIds[0] ?? step?.outgoingEdgeId
  if (!edgeId) return null
  return {
    edgeId,
    message: step?.approvalMessage ?? 'Please review this agent output before continuing.',
    role: step?.approvalRole ?? 'reviewer',
    nextAgentName: step?.nextAgentName ?? 'next agent',
    agentName: step?.agentName,
    feedbackRevisionsEnabled: Boolean(step?.feedbackRevisionsEnabled),
    maxFeedbackRevisions: step?.maxFeedbackRevisions ?? 5,
    revisionCount,
  }
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

const OUTPUT_LOG_DETAIL_LIMIT = 4000

function truncateLogDetail(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.length <= OUTPUT_LOG_DETAIL_LIMIT) return value
  return `${value.slice(0, OUTPUT_LOG_DETAIL_LIMIT)}…`
}

function buildStepRuntimeEvents(
  step: ExecutionPlanStep,
  response: WorkflowRunResponse,
  options?: { includeStart?: boolean },
): {
  events: WorkflowExecutionEvent[]
  errors: WorkflowExecutionEvent[]
  warnings: WorkflowExecutionEvent[]
  failed: boolean
} {
  const includeStart = options?.includeStart ?? true
  const events: WorkflowExecutionEvent[] = []
  const errors: WorkflowExecutionEvent[] = []
  const warnings: WorkflowExecutionEvent[] = []
  const node = response.nodes[step.nodeId]
  const failureMessage = response.failures[step.nodeId]

  if (includeStart && (node?.startedAt || node || failureMessage)) {
    events.push({
      id: createEventId(),
      kind: 'agent-start',
      level: 'info',
      message: `${step.agentName} started execution`,
      timestamp: node?.startedAt ?? new Date().toISOString(),
      nodeId: step.nodeId,
      agentName: step.agentName,
    })
  }

  if (failureMessage || node?.error || node?.status === 'failed') {
    const errorMessage = failureMessage ?? node?.error ?? 'Agent step failed'
    const errorEvent: WorkflowExecutionEvent = {
      id: createEventId(),
      kind: 'error',
      level: 'error',
      message: errorMessage,
      timestamp: node?.completedAt ?? node?.startedAt ?? new Date().toISOString(),
      nodeId: step.nodeId,
      agentName: step.agentName,
      detail:
        node?.metadata && Object.keys(node.metadata).length > 0
          ? JSON.stringify(node.metadata, null, 2)
          : undefined,
    }
    errors.push(errorEvent)
    events.push(errorEvent)
    return { events, errors, warnings, failed: true }
  }

  if (node?.status === 'completed') {
    const outputPreview = node.output == null ? undefined : stringifyOutput(node.output)
    events.push({
      id: createEventId(),
      kind: 'agent-complete',
      level: 'success',
      message: `${step.agentName} completed successfully`,
      timestamp: node.completedAt ?? new Date().toISOString(),
      nodeId: step.nodeId,
      agentName: step.agentName,
      detail: truncateLogDetail(outputPreview),
    })
    return { events, errors, warnings, failed: false }
  }

  if (node?.status === 'skipped') {
    const warnEvent: WorkflowExecutionEvent = {
      id: createEventId(),
      kind: 'warning',
      level: 'warning',
      message: `${step.agentName} was skipped`,
      timestamp: node.completedAt ?? new Date().toISOString(),
      nodeId: step.nodeId,
      agentName: step.agentName,
    }
    warnings.push(warnEvent)
    events.push(warnEvent)
    return { events, errors, warnings, failed: false }
  }

  if (!node) {
    const warnEvent: WorkflowExecutionEvent = {
      id: createEventId(),
      kind: 'warning',
      level: 'warning',
      message: `${step.agentName}: no result returned from runtime`,
      timestamp: new Date().toISOString(),
      nodeId: step.nodeId,
      agentName: step.agentName,
    }
    warnings.push(warnEvent)
    events.push(warnEvent)
  }

  return { events, errors, warnings, failed: false }
}

function buildOrphanFailureEvents(
  plan: ExecutionPlanStep[],
  response: WorkflowRunResponse,
  processedFailureNodes: Set<string>,
): {
  events: WorkflowExecutionEvent[]
  errors: WorkflowExecutionEvent[]
} {
  const events: WorkflowExecutionEvent[] = []
  const errors: WorkflowExecutionEvent[] = []

  for (const [nodeId, message] of Object.entries(response.failures)) {
    if (processedFailureNodes.has(nodeId)) continue
    const step = plan.find((candidate) => candidate.nodeId === nodeId)
    const errorEvent: WorkflowExecutionEvent = {
      id: createEventId(),
      kind: 'error',
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      nodeId,
      agentName: step?.agentName,
    }
    errors.push(errorEvent)
    events.push(errorEvent)
  }

  return { events, errors }
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
    const failureMessage = response.failures[step.nodeId]
    if (node.status === 'completed') completedNodeIds.push(step.nodeId)
    if (output) stepOutputs[step.nodeId] = output

    return {
      id: `trace-${step.nodeId}`,
      nodeId: step.nodeId,
      agentName: step.agentName,
      status: backendStatusToTraceStatus(node.status),
      message:
        failureMessage ??
        node.error ??
        (node.status === 'completed' ? 'LLM step completed.' : node.status),
      timestamp: node.completedAt ?? node.startedAt ?? new Date().toISOString(),
      durationMs: durationMs(node.startedAt, node.completedAt),
      output,
    }
  })

  const failed = response.status === 'failed' || Object.keys(response.failures).length > 0
  const waiting = response.status === 'waiting_approval' || (response.requiredEdgeIds?.length ?? 0) > 0
  return {
    runId: response.runId,
    status: failed ? 'failed' : waiting ? 'waiting-approval' : 'completed',
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
const EXECUTION_REPLAY_STEP_MS = 900

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function replayExecutionProgress(
  plan: ExecutionPlanStep[],
  response: WorkflowRunResponse,
  cancelRef: { current: boolean },
  applyState: (updater: (previous: WorkflowRunState) => WorkflowRunState) => void,
): Promise<Set<string>> {
  const processedFailureNodes = new Set<string>()

  for (let index = 0; index < plan.length; index++) {
    if (cancelRef.current) return processedFailureNodes

    const step = plan[index]
    const node = response.nodes[step.nodeId]
    const failed = node?.status === 'failed' || Boolean(response.failures[step.nodeId])
    if (failed) processedFailureNodes.add(step.nodeId)

    applyState((previous) => {
      // Progress lines already logged "Executing…" during the API wait.
      const hasProgressStart = previous.events.some(
        (event) => event.kind === 'agent-start' && event.nodeId === step.nodeId,
      )
      const runtime = buildStepRuntimeEvents(step, response, {
        includeStart: !hasProgressStart,
      })

      return {
        ...previous,
        status: 'running',
        ...buildVisualProgressState(plan, index, previous.trace),
        events: [...previous.events, ...runtime.events],
        errors: [...previous.errors, ...runtime.errors],
        warnings: [...previous.warnings, ...runtime.warnings],
      }
    })

    await sleep(EXECUTION_REPLAY_STEP_MS)
    if (cancelRef.current) return processedFailureNodes
    if (failed) break
  }

  return processedFailureNodes
}

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

      const firstStep = plan[0]
      setState((previous) => ({
        ...previous,
        ...buildVisualProgressState(plan, 0, previous.trace),
        events: [
          ...previous.events,
          {
            id: createEventId(),
            kind: 'agent-start',
            level: 'info',
            message: `Executing ${firstStep.agentName}…`,
            timestamp: new Date().toISOString(),
            nodeId: firstStep.nodeId,
            agentName: firstStep.agentName,
          },
        ],
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
          const fromStep = plan[visualStepRef.current - 1]
          const toStep = plan[visualStepRef.current]
          const nextEvents: WorkflowExecutionEvent[] = []

          if (traversedEdge && traversedEdge !== lastTraversedEdgeRef.current) {
            lastTraversedEdgeRef.current = traversedEdge
            nextEvents.push({
              id: createEventId(),
              kind: 'edge-traverse',
              level: 'info',
              message: `Flow moved to ${toStep?.agentName ?? 'next agent'}`,
              timestamp: new Date().toISOString(),
              edgeId: traversedEdge,
              agentName: fromStep?.agentName,
            })
          }

          if (toStep) {
            nextEvents.push({
              id: createEventId(),
              kind: 'agent-start',
              level: 'info',
              message: `Executing ${toStep.agentName}…`,
              timestamp: new Date().toISOString(),
              nodeId: toStep.nodeId,
              agentName: toStep.agentName,
            })
          }

          if (nextEvents.length === 0) {
            return { ...previous, ...patch }
          }

          return {
            ...previous,
            ...patch,
            events: [...previous.events, ...nextEvents],
          }
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
          reviewerFeedback: execution.reviewerFeedback || undefined,
          previousOutput: execution.previousOutput ?? undefined,
          revisionCount: execution.revisionCount,
          raiseOnError: false,
        })
        clearVisualProgress()
        if (cancelRef.current) return

        const processedFailureNodes = await replayExecutionProgress(
          plan,
          response,
          cancelRef,
          (updater) => {
            setState((previous) => updater(previous))
          },
        )
        if (cancelRef.current) return

        const patch = responseToStatePatch(plan, response)
        const orphanFailures = buildOrphanFailureEvents(plan, response, processedFailureNodes)
        const requiredEdgeIds = response.requiredEdgeIds ?? []

        if (patch.status === 'waiting-approval' && requiredEdgeIds.length > 0) {
          const prompt = buildApprovalPrompt(plan, requiredEdgeIds, execution.revisionCount)
          const sourceOutput =
            prompt?.agentName
              ? plan.find((step) => step.agentName === prompt.agentName)?.nodeId
              : undefined
          const previousOutput = sourceOutput ? response.nodes[sourceOutput]?.output : undefined
          const waitingStep = plan.find(
            (candidate) =>
              candidate.outgoingEdgeId && requiredEdgeIds.includes(candidate.outgoingEdgeId),
          )
          pendingExecutionRef.current = {
            ...execution,
            pendingEdgeIds: requiredEdgeIds,
            previousOutput: previousOutput ?? execution.previousOutput,
            reviewerFeedback: '',
          }
          setState((previous) => ({
            ...previous,
            ...patch,
            approvalPrompt: prompt,
            activeEdgeId: prompt?.edgeId ?? requiredEdgeIds[0] ?? null,
            activeNodeId: waitingStep?.nodeId ?? previous.activeNodeId,
            trace: patch.trace.map((step) =>
              step.nodeId === waitingStep?.nodeId
                ? {
                    ...step,
                    status: 'waiting-approval' as const,
                    message: `Waiting for ${prompt?.role ?? 'reviewer'} approval`,
                  }
                : step,
            ),
            events: [...previous.events, ...orphanFailures.events],
            errors: [...previous.errors, ...orphanFailures.errors],
          }))
          appendEvent({
            kind: 'approval-wait',
            level: 'warning',
            message: execution.reviewerFeedback
              ? 'Revised output is ready for review.'
              : 'Review the agent output, then approve or request changes.',
            edgeId: prompt?.edgeId,
            agentName: prompt?.agentName,
          })
          return
        }

        const errorCount =
          Object.keys(response.failures).length ||
          Object.values(response.nodes).filter((node) => node.status === 'failed').length
        const workflowEndEvent: WorkflowExecutionEvent = {
          id: createEventId(),
          kind: patch.status === 'failed' ? 'error' : 'workflow-complete',
          level: patch.status === 'failed' ? 'error' : 'success',
          message:
            patch.status === 'failed'
              ? errorCount > 0
                ? `Workflow finished with ${errorCount} agent error(s).`
                : 'Workflow execution finished with failures.'
              : 'Workflow execution finished through the Eleven Nodes runtime.',
          timestamp: new Date().toISOString(),
          detail: `Run ${response.runId}`,
        }
        const runtimeErrors =
          patch.status === 'failed' && orphanFailures.errors.length === 0
            ? [...orphanFailures.errors, workflowEndEvent]
            : orphanFailures.errors

        pendingExecutionRef.current = null
        setState((previous) => ({
          ...previous,
          ...patch,
          approvalPrompt: null,
          events: [...previous.events, ...orphanFailures.events, workflowEndEvent],
          errors: [...previous.errors, ...runtimeErrors],
        }))
      } catch (error) {
        clearVisualProgress()
        if (cancelRef.current) return

        if (error instanceof WorkflowExecutionApprovalRequiredError) {
          const prompt = buildApprovalPrompt(plan, error.requiredEdgeIds, execution.revisionCount)
          pendingExecutionRef.current = {
            ...execution,
            pendingEdgeIds: error.requiredEdgeIds,
          }
          setState((previous) => ({
            ...previous,
            status: 'waiting-approval',
            activeEdgeId: prompt?.edgeId ?? error.requiredEdgeIds[0] ?? null,
            activeNodeId:
              plan.find((step) => step.outgoingEdgeId && error.requiredEdgeIds.includes(step.outgoingEdgeId))
                ?.nodeId ?? null,
            approvalPrompt: prompt,
            trace: previous.trace.map((step) =>
              step.nodeId ===
              plan.find((candidate) => candidate.outgoingEdgeId && error.requiredEdgeIds.includes(candidate.outgoingEdgeId))
                ?.nodeId
                ? {
                    ...step,
                    status: 'waiting-approval',
                    message: `Waiting for ${prompt?.role ?? 'reviewer'} approval`,
                    timestamp: new Date().toISOString(),
                  }
                : step,
            ),
          }))
          appendEvent({
            kind: 'approval-wait',
            level: 'warning',
            message: 'Backend requires approval before continuing.',
            edgeId: prompt?.edgeId,
            agentName: prompt?.nextAgentName,
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
        message: 'Calling backend /execute via Eleven Nodes runtime.',
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
