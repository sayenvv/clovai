import { useCallback, useRef, useState } from 'react'
import type {
  ExecutionPlanStep,
  ExecutionTraceStep,
  WorkflowExecutionEvent,
  WorkflowRunState,
} from '@/types/agent-workflow'

const STEP_DELAY_MS = 1400
const APPROVAL_SIM_DELAY_MS = 600

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
    message: 'Waiting to start…',
    timestamp: new Date().toISOString(),
  }))
}

function simulateAgentOutput(step: ExecutionPlanStep, input: string): string {
  const snippet = input.replace(/\s+/g, ' ').slice(0, 60)
  return JSON.stringify(
    {
      agent: step.agentName,
      type: step.agentType,
      toolsUsed: step.tools,
      summary: `Processed "${snippet || 'workflow input'}" successfully.`,
      tokens: Math.floor(120 + Math.random() * 280),
    },
    null,
    2,
  )
}

export function useWorkflowRunner() {
  const [state, setState] = useState<WorkflowRunState>(initialRunState)
  const cancelRef = useRef(false)
  const approvalResolverRef = useRef<((value: string) => void) | null>(null)
  const inputRef = useRef('')

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

  const updateTrace = useCallback(
    (nodeId: string, patch: Partial<ExecutionTraceStep>) => {
      setState((previous) => ({
        ...previous,
        trace: previous.trace.map((step) =>
          step.nodeId === nodeId ? { ...step, ...patch, timestamp: new Date().toISOString() } : step,
        ),
      }))
    },
    [],
  )

  const wait = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms)
    })
  }, [])

  const waitForApproval = useCallback(() => {
    return new Promise<string>((resolve) => {
      approvalResolverRef.current = resolve
    })
  }, [])

  const submitApproval = useCallback(
    (response: string) => {
      const trimmed = response.trim()
      if (!trimmed) return
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
      approvalResolverRef.current?.(trimmed)
      approvalResolverRef.current = null
    },
    [appendEvent],
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
    approvalResolverRef.current?.('')
    approvalResolverRef.current = null
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
    approvalResolverRef.current = null
    setState(initialRunState())
  }, [])

  const start = useCallback(
    async (plan: ExecutionPlanStep[], input: string) => {
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
      inputRef.current = input
      const runId = `run-${Date.now().toString(36)}`
      const trace = buildInitialTrace(plan)

      setState({
        runId,
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
        message: 'workflow_event.started',
        detail: `Run ${runId} · ${plan.length} agent step(s)`,
      })

      let lastOutput = input
      const outputs: string[] = []

      for (let index = 0; index < plan.length; index += 1) {
        if (cancelRef.current) return

        const step = plan[index]
        setState((previous) => ({
          ...previous,
          currentStepIndex: index,
          activeNodeId: step.nodeId,
          activeEdgeId: null,
        }))

        updateTrace(step.nodeId, {
          status: 'running',
          message: step.tools.length
            ? `Running with tools: ${step.tools.join(', ')}`
            : 'Agent executing…',
        })

        appendEvent({
          kind: 'agent-start',
          level: 'info',
          message: 'output_item.added',
          nodeId: step.nodeId,
          agentName: step.agentName,
          detail: step.agentName,
        })

        for (const tool of step.tools) {
          if (cancelRef.current) return
          appendEvent({
            kind: 'tool-invoke',
            level: 'info',
            message: `Invoked tool "${tool}" under ${step.agentName}`,
            nodeId: step.nodeId,
            agentName: step.agentName,
          })
          await wait(320)
        }

        await wait(STEP_DELAY_MS)
        if (cancelRef.current) return

        const output = simulateAgentOutput(step, lastOutput)
        outputs.push(output)
        lastOutput = output

        updateTrace(step.nodeId, {
          status: 'completed',
          message: 'Step completed successfully',
          durationMs: STEP_DELAY_MS + step.tools.length * 320,
          output,
        })

        appendEvent({
          kind: 'agent-complete',
          level: 'success',
          message: 'workflow_event.completed',
          nodeId: step.nodeId,
          agentName: step.agentName,
          detail: `Response complete (${Math.floor(80 + Math.random() * 120)} tokens)`,
        })

        setState((previous) => ({
          ...previous,
          completedNodeIds: [...previous.completedNodeIds, step.nodeId],
          activeNodeId: null,
          stepOutputs: { ...previous.stepOutputs, [step.nodeId]: output },
        }))

        const nextStep = plan[index + 1]
        if (nextStep && step.humanApproval && step.outgoingEdgeId) {
          setState((previous) => ({
            ...previous,
            status: 'waiting-approval',
            activeEdgeId: step.outgoingEdgeId ?? null,
            approvalPrompt: {
              edgeId: step.outgoingEdgeId!,
              message: step.approvalMessage ?? 'Human approval required to continue.',
              role: step.approvalRole ?? 'reviewer',
              nextAgentName: step.nextAgentName ?? nextStep.agentName,
            },
          }))

          updateTrace(nextStep.nodeId, {
            status: 'waiting-approval',
            message: `Waiting for ${step.approvalRole ?? 'reviewer'} approval`,
          })

          appendEvent({
            kind: 'approval-wait',
            level: 'warning',
            message: `Approval required before ${nextStep.agentName}`,
            edgeId: step.outgoingEdgeId,
            agentName: step.nextAgentName,
          })

          const approvalInput = await waitForApproval()
          if (cancelRef.current || !approvalInput.trim()) return

          await wait(APPROVAL_SIM_DELAY_MS)

          updateTrace(nextStep.nodeId, {
            status: 'pending',
            message: 'Approved — ready to execute',
          })

          appendEvent({
            kind: 'edge-traverse',
            level: 'info',
            message: `Proceeding to ${nextStep.agentName} after approval`,
            edgeId: step.outgoingEdgeId,
            agentName: nextStep.agentName,
          })

          setState((previous) => ({
            ...previous,
            status: 'running',
            activeEdgeId: step.outgoingEdgeId ?? null,
          }))

          await wait(500)
          setState((previous) => ({ ...previous, activeEdgeId: null }))
        } else if (nextStep && step.outgoingEdgeId) {
          setState((previous) => ({ ...previous, activeEdgeId: step.outgoingEdgeId ?? null }))
          appendEvent({
            kind: 'edge-traverse',
            level: 'info',
            message: `Flow → ${nextStep.agentName}`,
            edgeId: step.outgoingEdgeId,
            agentName: nextStep.agentName,
          })
          await wait(450)
          setState((previous) => ({ ...previous, activeEdgeId: null }))
        }
      }

      const finalResponse = JSON.stringify(
        {
          runId,
          status: 'completed',
          steps: plan.length,
          output: outputs[outputs.length - 1] ?? lastOutput,
        },
        null,
        2,
      )

      setState((previous) => ({
        ...previous,
        status: 'completed',
        activeNodeId: null,
        activeEdgeId: null,
        finalResponse,
      }))

      appendEvent({
        kind: 'workflow-complete',
        level: 'success',
        message: 'Workflow execution finished successfully.',
      })
    },
    [appendEvent, updateTrace, wait, waitForApproval],
  )

  return {
    state,
    start,
    submitApproval,
    cancel,
    reset,
  }
}
