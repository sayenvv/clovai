import { useCallback, useRef, useState } from 'react'
import { addTokenUsage, refreshTokenUsage } from '@/services/token-usage-store'
import type { ExecutionLogEvent, ExecutionStepDetail } from '@/services/orchestration-api'
import {
  answerWorkflowRun,
  runOutputText,
  startWorkflowRun,
  type WorkflowRunRequest,
  type WorkflowRunV4,
} from '@/services/workflow-run-v4-api'
import type {
  ExecutionPlanStep,
  ExecutionTraceStep,
  WorkflowChatMessage,
  WorkflowExecutionEvent,
  WorkflowRunState,
} from '@/types/agent-workflow'

interface BackendExecutionTarget {
  /** The saved workflow to run. */
  workflowId: string
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
    messages: [],
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
  const message = input.trim()
  if (!message) return {}
  if (message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        if (typeof record.message === 'string' && record.message.trim()) return record
        if (typeof record.prompt === 'string' && record.prompt.trim()) {
          return { ...record, message: record.prompt }
        }
      }
    } catch {
      // The box contains plain text, not JSON.
    }
  }
  return { message }
}

function outputText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(outputText).filter(Boolean).join('\n\n')
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.text === 'string') return record.text.trim()
    if ('outputs' in record) return outputText(record.outputs)
  }
  return ''
}

function matchPlanStep(
  plan: ExecutionPlanStep[],
  agentId: string,
  agentName: string,
): ExecutionPlanStep | undefined {
  const name = agentName.trim().toLowerCase()
  return (
    plan.find((step) => agentId && step.nodeId === agentId) ??
    plan.find((step) => name && step.agentName.trim().toLowerCase() === name)
  )
}

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function closeTurns(messages: WorkflowChatMessage[], keep?: string): WorkflowChatMessage[] {
  return messages
    .filter((message) => message.status !== 'streaming' || message.nodeId === keep || message.content.trim())
    .map((message) =>
      message.status === 'streaming' && message.nodeId !== keep ? { ...message, status: 'done' as const } : message,
    )
}

/** Fold one streamed agent row into the chat turns: deltas extend the open turn, whole messages start one. */
export function applyChatMessage(
  messages: WorkflowChatMessage[],
  key: string,
  agentName: string,
  event: ExecutionLogEvent,
): WorkflowChatMessage[] {
  const text = event.message ?? ''
  const kind: WorkflowChatMessage['kind'] = event.kind === 'reasoning' ? 'reasoning' : 'response'
  const list = closeTurns(messages, key)
  const openIndex = list.findIndex((message) => message.status === 'streaming' && message.nodeId === key)
  const open = openIndex >= 0 ? list[openIndex] : undefined
  const empty = !open?.content.trim()
  const replace = (next: WorkflowChatMessage | null) =>
    next ? list.map((message, index) => (index === openIndex ? next : message)) : list.filter((_, index) => index !== openIndex)
  const close = () => (open ? replace(empty ? null : { ...open, status: 'done' }) : list)
  const turn = (content: string, status: WorkflowChatMessage['status']): WorkflowChatMessage => ({
    id: createEventId(),
    nodeId: key,
    agentName,
    content,
    kind,
    title: event.title,
    status,
  })

  if (event.status === 'failed') {
    return open ? replace(empty ? null : { ...open, status: 'failed' }) : list
  }
  if (event.delta) {
    if (open?.kind === kind) return replace({ ...open, agentName, content: open.content + text })
    if (open && empty) return replace(turn(text, 'streaming'))
    return [...close(), turn(text, 'streaming')]
  }
  if (event.status !== 'completed') {
    if (!text.trim()) return open ? list : [...list, turn('', 'streaming')]
    return [...close(), turn(text, 'done')]
  }
  if (!text.trim()) return close()
  if (open && empty) return replace(turn(text, 'done'))
  if (open?.kind === kind) {
    const streamed = squash(open.content)
    const whole = squash(text)
    if (whole.startsWith(streamed) || streamed.startsWith(whole)) {
      return replace({ ...open, agentName, content: text, title: event.title ?? open.title, status: 'done' })
    }
  }
  const closed = close()
  const last = closed[closed.length - 1]
  if (last && last.nodeId === key && last.kind === kind && squash(last.content) === squash(text)) return closed
  return [...closed, turn(text, 'done')]
}

function applyAgentUpdate(
  previous: WorkflowRunState,
  plan: ExecutionPlanStep[],
  event: ExecutionLogEvent,
): WorkflowRunState {
  const matched = matchPlanStep(plan, event.agentId ?? '', event.agent?.trim() || '')
  // The stream names agents by node id; the plan step carries the node's label
  const agentName = matched?.agentName || event.agent?.trim() || 'Agent'
  const nodeId = matched?.nodeId || event.agentId || ''
  const reasoning = event.message ?? ''
  const phase = event.status
  const timestamp = new Date().toISOString()
  previous = { ...previous, messages: applyChatMessage(previous.messages, nodeId || agentName, agentName, event) }
  const trace = previous.trace.some((entry) => nodeId && entry.nodeId === nodeId)
    ? previous.trace
    : [
        ...previous.trace,
        {
          id: `trace-${nodeId || agentName}`,
          nodeId,
          agentName,
          status: 'pending' as const,
          message: '',
          timestamp,
        },
      ]
  const settled = trace.map((entry) =>
    entry.status === 'running' && entry.nodeId !== nodeId
      ? { ...entry, status: 'completed' as const, message: 'Completed' }
      : entry,
  )
  const current = settled.find((entry) => entry.nodeId === nodeId)
  const base = current?.status === 'running' ? current.output ?? '' : ''
  const piece = event.kind === 'reasoning' ? '' : reasoning
  const streamed = phase === 'running' ? base + piece : base

  if (phase === 'running') {
    const index = plan.findIndex((candidate) => candidate.nodeId === nodeId)
    return {
      ...previous,
      currentStepIndex: index >= 0 ? index : previous.currentStepIndex,
      activeNodeId: nodeId || previous.activeNodeId,
      completedNodeIds: previous.completedNodeIds.filter((id) => id !== nodeId),
      stepOutputs: nodeId ? { ...previous.stepOutputs, [nodeId]: streamed } : previous.stepOutputs,
      trace: settled.map((entry) =>
        entry.nodeId === nodeId
          ? {
              ...entry,
              status: 'running',
              agentName,
              message: streamed ? 'Streaming' : `${agentName} is running`,
              output: streamed || entry.output,
              timestamp,
            }
          : entry,
      ),
    }
  }
  if (phase === 'completed' || phase === 'failed') {
    const output = phase === 'failed' ? current?.output : reasoning.trim() || current?.output
    return {
      ...previous,
      activeNodeId: previous.activeNodeId === nodeId ? null : previous.activeNodeId,
      completedNodeIds:
        phase === 'completed' && nodeId
          ? Array.from(new Set([...previous.completedNodeIds, nodeId]))
          : previous.completedNodeIds,
      stepOutputs: nodeId && output ? { ...previous.stepOutputs, [nodeId]: output } : previous.stepOutputs,
      trace: settled.map((entry) =>
        entry.nodeId === nodeId
          ? {
              ...entry,
              status: phase === 'completed' ? 'completed' : 'error',
              agentName,
              message: phase === 'completed' ? 'Completed' : 'Failed',
              output,
              timestamp,
            }
          : entry,
      ),
    }
  }
  return previous
}

function stepLog(step: ExecutionStepDetail): string {
  const message = step.message?.trim() || step.id || 'Step'
  return step.detail?.trim() ? `${message}. ${step.detail.trim()}` : message
}

export function useWorkflowRunner() {
  const [state, setState] = useState<WorkflowRunState>(initialRunState)
  const cancelRef = useRef(false)
  const pendingExecutionRef = useRef<PendingExecution | null>(null)
  const loggedStepsRef = useRef(new Map<string, string>())
  /** The 4.0 run waiting on a person, and how to continue it with their answer. */
  const pendingRunRef = useRef<{
    request: WorkflowRunRequest
    resume: (response: Record<string, unknown>) => Promise<void>
  } | null>(null)

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
        const recordLog = (
          message: string,
          level: WorkflowExecutionEvent['level'],
          kind: WorkflowExecutionEvent['kind'],
          agentName?: string,
          nodeId?: string,
        ) => {
          const full: WorkflowExecutionEvent = {
            id: createEventId(),
            kind,
            level,
            message,
            timestamp: new Date().toISOString(),
            agentName,
            nodeId,
          }
          if (level === 'error') console.error(`[execute] ${message}`)
          else console.info(`[execute] ${message}`)
          setState((previous) => ({
            ...previous,
            events: [...previous.events, full],
            errors: level === 'error' ? [...previous.errors, full] : previous.errors,
            warnings: level === 'warning' ? [...previous.warnings, full] : previous.warnings,
          }))
        }
        const onEvent = (event: ExecutionLogEvent) => {
          if (cancelRef.current) return
          if (event.event === 'usage') {
            // Count each model call as it happens; the server records the same usage in the database.
            addTokenUsage(event.totalTokens ?? 0)
            return
          }
          if (event.event === 'agent') {
            const matched = matchPlanStep(plan, event.agentId ?? '', event.agent?.trim() || '')
            const agentName = matched?.agentName || event.agent?.trim() || 'Agent'
            const reasoning = event.message ?? ''
            const phase = event.status === 'failed' ? 'failed' : event.status === 'completed' ? 'completed' : 'running'
            const nodeId = matched?.nodeId || event.agentId
            const logMessage = `${agentName} ${phase}`
            const logKey = `agent:${nodeId || agentName}`
            const signature = phase === 'running' ? phase : `${phase}|${reasoning}`
            const alreadyLogged = loggedStepsRef.current.get(logKey) === signature
            if (!alreadyLogged) {
              loggedStepsRef.current.set(logKey, signature)
              if (phase === 'failed') console.error(`[execute] ${logMessage}`)
              else console.info(`[execute] ${logMessage}`)
            }
            const level: WorkflowExecutionEvent['level'] =
              phase === 'failed' ? 'error' : phase === 'completed' ? 'success' : 'info'
            const kind: WorkflowExecutionEvent['kind'] =
              phase === 'completed' || phase === 'failed' ? 'agent-complete' : 'agent-start'
            setState((previous) => {
              const next = applyAgentUpdate(previous, plan, event)
              if (alreadyLogged) return next
              const full: WorkflowExecutionEvent = {
                id: createEventId(),
                kind,
                level,
                message: logMessage,
                timestamp: new Date().toISOString(),
                agentName,
                nodeId,
              }
              return {
                ...next,
                events: [...next.events, full],
                errors: level === 'error' ? [...next.errors, full] : next.errors,
              }
            })
            if (phase === 'failed') failed = true
            return
          }
          if (event.event !== 'progress') return
          for (const step of event.steps ?? []) {
            if (!step.status || step.status === 'pending') continue
            const key = step.id || step.message || 'step'
            const signature = `${step.status}|${stepLog(step)}`
            if (loggedStepsRef.current.get(key) === signature) continue
            loggedStepsRef.current.set(key, signature)
            recordLog(
              stepLog(step),
              step.status === 'failed' ? 'error' : step.status === 'completed' ? 'success' : 'info',
              step.status === 'failed' ? 'error' : step.status === 'completed' ? 'workflow-complete' : 'workflow-start',
            )
          }
          if (event.status === 'failed') {
            failed = true
            const message = event.message?.trim() || 'Workflow execution failed.'
            recordLog(message, 'error', 'error')
          }
          if (event.status === 'completed') {
            const text = outputText(event.result?.execution?.outputs)
            if (text) reply = text
            recordLog(event.message?.trim() || 'Workflow completed', 'success', 'workflow-complete')
          }
        }
        const complete = () => {
          void refreshTokenUsage()
          setState((previous) => {
            const last = plan[plan.length - 1]
            const trace = previous.trace.map((step) =>
              step.status === 'running'
                ? { ...step, status: 'completed' as const, message: 'Completed' }
                : step,
            )
            const streamed = last
              ? trace.find((step) => step.nodeId === last.nodeId)?.output || previous.stepOutputs[last.nodeId] || ''
              : ''
            const finalText = streamed || reply
            const closed = closeTurns(previous.messages)
            const answered = !reply || closed.some((message) => squash(message.content) === squash(reply))
            const messages = answered
              ? closed
              : [
                  ...closed,
                  {
                    id: createEventId(),
                    nodeId: 'final',
                    agentName: 'Final answer',
                    content: reply,
                    kind: 'response' as const,
                    status: 'done' as const,
                  },
                ]
            return {
              ...previous,
              messages,
              status: failed ? 'failed' : 'completed',
              activeNodeId: null,
              activeEdgeId: null,
              approvalPrompt: null,
              completedNodeIds: previous.completedNodeIds,
              finalResponse: finalText || previous.finalResponse,
              trace:
                finalText && last
                  ? trace.map((step) =>
                      step.nodeId === last.nodeId
                        ? { ...step, status: 'completed' as const, output: finalText, message: 'Completed' }
                        : step,
                    )
                  : trace,
              stepOutputs:
                finalText && last ? { ...previous.stepOutputs, [last.nodeId]: finalText } : previous.stepOutputs,
            }
          })
        }
        /** A run that finished completes the view; one that waits shows its request until it is answered. */
        const settle = async (run: WorkflowRunV4): Promise<void> => {
          if (cancelRef.current) return
          const request = run.status === 'waiting' ? run.requests[0] : undefined
          if (request) {
            pendingRunRef.current = {
              request,
              resume: async (response) => settle(await answerWorkflowRun(run, request, response, onEvent)),
            }
            setState((previous) => ({
              ...previous,
              status: 'waiting-approval',
              activeNodeId: request.nodeId,
              approvalPrompt: {
                edgeId: request.id,
                message: request.payload.message ?? request.payload.question ?? '',
                role: request.payload.approvers?.roles?.[0] ?? 'reviewer',
                nextAgentName: request.nodeName,
                agentName: request.nodeName,
                feedbackRevisionsEnabled: request.kind !== 'wait_event',
              },
            }))
            appendEvent({ kind: 'approval-wait', level: 'warning', message: `Waiting: ${request.nodeName}`, nodeId: request.nodeId })
            return
          }
          pendingRunRef.current = null
          if (run.status === 'succeeded') reply = runOutputText(run.output)
          else {
            failed = true
            recordLog(run.error || run.issues?.map((issue) => issue.message).join('; ') || `The run ${run.status}.`, 'error', 'error')
          }
          complete()
        }
        const run = await startWorkflowRun({ workflowId: target.workflowId, inputs: parseWorkflowInput(input), onEvent })
        setState((previous) => ({ ...previous, runId: run.id }))
        await settle(run)
      } catch (error) {
        if (cancelRef.current) return
        const message = error instanceof Error ? error.message : 'Workflow execution failed.'
        setState((previous) => ({
          ...previous,
          messages: closeTurns(previous.messages),
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

  /** Answer the waiting run; a failure to continue it fails the run view. */
  const answerPending = useCallback(
    (response: Record<string, unknown>, message: string, level: WorkflowExecutionEvent['level']) => {
      const pending = pendingRunRef.current
      if (!pending) return
      pendingRunRef.current = null
      appendEvent({ kind: 'approval-received', level, message })
      setState((previous) => ({ ...previous, status: 'running', approvalPrompt: null }))
      pending.resume(response).catch((error: unknown) => {
        const text = error instanceof Error ? error.message : 'The run could not continue.'
        setState((previous) => ({ ...previous, status: 'failed', activeNodeId: null, approvalPrompt: null }))
        appendEvent({ kind: 'error', level: 'error', message: text })
      })
    },
    [appendEvent],
  )

  const submitApproval = useCallback(
    (response: string) => {
      const note = response.trim()
      const kind = pendingRunRef.current?.request.kind
      answerPending(
        kind === 'approval' ? { approved: true, ...(note ? { comment: note } : {}) } : { text: note || 'Approved' },
        note ? `Approved: ${note.slice(0, 80)}` : 'Approved — continuing workflow.',
        'success',
      )
    },
    [answerPending],
  )

  const submitFeedback = useCallback(
    (feedback: string) => {
      const trimmed = feedback.trim()
      if (!trimmed) return
      const kind = pendingRunRef.current?.request.kind
      answerPending(
        kind === 'approval' ? { approved: false, comment: trimmed } : { text: trimmed },
        `${kind === 'approval' ? 'Rejected' : 'Answered'}: ${trimmed.slice(0, 80)}`,
        'warning',
      )
    },
    [answerPending],
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
    pendingExecutionRef.current = null
    pendingRunRef.current = null
    setState((previous) => ({
      ...previous,
      messages: closeTurns(previous.messages),
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
    pendingRunRef.current = null
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
      loggedStepsRef.current = new Map()
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
        messages: [],
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
