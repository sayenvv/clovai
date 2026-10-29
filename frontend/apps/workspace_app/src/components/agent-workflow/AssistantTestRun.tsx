import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SchemaForm, type FormSchema } from '@/components/agent-workflow/SchemaForm'
import { CARD, RUN_STATUS, asText } from '@/components/agent-workflow/AssistantCards'
import { fetchDraftPreview, type CanvasTestRequest } from '@/services/workflow-assistant-api'
import { answerWorkflowRun, startWorkflowRun, type WorkflowRunRequest, type WorkflowRunV4 } from '@/services/workflow-run-v4-api'
import type { ExecutionLogEvent } from '@/services/orchestration-api'
import { addTokenUsage } from '@/services/token-usage-store'
import { cn } from '@/utils/cn'

type StepState = 'running' | 'done' | 'failed'

interface Step {
  id: string
  name: string
  state: StepState
  note: string
}

// Tests started in this page session: a chat reloaded later shows the finished run, it never starts one again
const started = new Set<string>()

/**
 * The assistant's test of its draft, run here in the chat with the same run API as the Test button: each step
 * as it runs, approvals and questions to answer in the card, and the output. The canvas is left alone.
 */
export function AssistantTestRun({
  testKey,
  test,
  onFinished,
}: {
  /** The chat message the test belongs to. */
  testKey: string
  test: CanvasTestRequest
  /** The run settled (finished or failed): the chat keeps its id, to show it later without running again. */
  onFinished: (runId: string) => void
}) {
  const [steps, setSteps] = useState<Step[]>([])
  const [run, setRun] = useState<WorkflowRunV4 | null>(null)
  const [error, setError] = useState('')
  const [answering, setAnswering] = useState(false)
  const [tokens, setTokens] = useState(0)
  const [interrupted] = useState(() => started.has(testKey))
  const hidden = useRef(new Set<string>())

  const onEvent = (event: ExecutionLogEvent) => {
    if (event.event === 'usage') {
      addTokenUsage(event.totalTokens ?? 0)
      setTokens((total) => total + (event.totalTokens ?? 0))
      return
    }
    if (event.event !== 'agent' || !event.agentId || hidden.current.has(event.agentId)) return
    const id = event.agentId
    const state: StepState = event.status === 'failed' ? 'failed' : event.status === 'completed' ? 'done' : 'running'
    setSteps((previous) => {
      const index = previous.findIndex((step) => step.id === id)
      const step = { id, name: event.agent || 'Step', state, note: event.message ?? '' }
      if (index < 0) return [...previous, step]
      const next = [...previous]
      next[index] = { ...next[index], state, note: event.message || next[index].note }
      return next
    })
  }

  const settle = (next: WorkflowRunV4) => {
    setRun(next)
    if (next.status !== 'waiting') onFinished(next.id)
  }

  useEffect(() => {
    if (started.has(testKey)) return
    started.add(testKey)
    void (async () => {
      try {
        const { document } = await fetchDraftPreview(test.draftId)
        // Start and End are not steps the user needs to follow
        for (const node of document.graph.nodes) if (node.type === 'start' || node.type === 'end') hidden.current.add(node.id)
        settle(await startWorkflowRun({ document: document as unknown as Record<string, unknown>, inputs: test.inputs, onEvent }))
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'The test could not run.')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once per test
  }, [testKey])

  const answer = async (request: WorkflowRunRequest, response: Record<string, unknown>) => {
    if (!run) return
    setAnswering(true)
    try {
      settle(await answerWorkflowRun(run, request, response, onEvent))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The test could not continue.')
    } finally {
      setAnswering(false)
    }
  }

  if (interrupted) {
    return <p className="mt-2 text-[12px] text-muted-foreground">This test stopped when the page was left. Ask the assistant to test again.</p>
  }

  const request = run?.status === 'waiting' ? run.requests[0] : undefined
  const status = error ? RUN_STATUS.failed : run ? (RUN_STATUS[run.status] ?? RUN_STATUS.cancelled) : RUN_STATUS.running
  const output = run?.status === 'succeeded' ? asText(run.output) : ''
  const message = asText(test.inputs.message ?? test.inputs)

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">Test run</p>
        <span className="flex items-center gap-2">
          {tokens ? <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{tokens.toLocaleString()} tokens</span> : null}
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', status.className)}>{status.label}</span>
        </span>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Input</p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-foreground">{message}</p>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Steps</p>
        <ol className="mt-1 space-y-1">
          {steps.map((step) => {
            const waiting = request?.nodeId === step.id
            return (
            <li key={step.id} className="flex gap-2">
              <span className="mt-[3px] flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden>
                {waiting ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                ) : step.state === 'running' ? (
                  <span className="relative flex h-[7px] w-[7px]">
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#EB6115] opacity-60 motion-reduce:animate-none" />
                    <span className="relative h-[7px] w-[7px] rounded-full bg-[#EB6115]" />
                  </span>
                ) : (
                  <span className={cn('h-1.5 w-1.5 rounded-full', step.state === 'failed' ? 'bg-red-500' : 'bg-emerald-500')} />
                )}
              </span>
              <span className="min-w-0">
                <span className={cn('font-medium', step.state === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{step.name}</span>
                <span className="text-muted-foreground">
                  {waiting ? ' · waiting' : step.state === 'running' ? ' · running…' : step.note ? ` · ${step.note.slice(0, 200)}` : ''}
                </span>
              </span>
            </li>
            )
          })}
          {!run && !error ? (
            <li className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {steps.length ? 'Working…' : 'Starting the test…'}
            </li>
          ) : null}
        </ol>
      </div>

      {request ? (
        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-2.5">
          <p className="font-medium text-foreground">{request.nodeName}</p>
          <p className="text-muted-foreground">
            {request.payload.message || request.payload.question || (request.kind === 'wait_event' ? 'Waiting for an outside event.' : 'Waiting for you.')}
          </p>
          {request.kind === 'approval' ? (
            <div className="flex gap-2">
              <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={answering} onClick={() => void answer(request, { approved: true })}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={answering} onClick={() => void answer(request, { approved: false })}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          ) : request.kind === 'ask_user' ? (
            <SchemaForm
              key={request.id}
              schema={(request.payload as { responseSchema?: FormSchema | null }).responseSchema}
              busy={answering}
              onSubmit={(response) => void answer(request, response)}
            />
          ) : request.kind === 'wait_event' ? (
            <TestEventForm
              key={request.id}
              eventName={(request.payload as { source?: { event?: string } }).source?.event ?? ''}
              inputs={test.inputs}
              busy={answering}
              onSend={(event, payload) => void answer(request, { event, payload })}
            />
          ) : null}
        </div>
      ) : null}

      {error || run?.error ? <p className="text-red-600 dark:text-red-400">{error || run?.error}</p> : null}
      {output ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Output</p>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border bg-background px-2 py-1.5 text-[12px] text-foreground">
            {output}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

/** A test of a step that waits for an outside event: send the event it waits for, with a payload to try. */
function TestEventForm({
  eventName,
  inputs,
  busy,
  onSend,
}: {
  eventName: string
  inputs: Record<string, unknown>
  busy: boolean
  onSend: (event: string, payload: Record<string, unknown>) => void
}) {
  const [event, setEvent] = useState(eventName)
  const [payload, setPayload] = useState(() => JSON.stringify(inputs, null, 2))
  let parsed: Record<string, unknown> | null = null
  try {
    const value = JSON.parse(payload || '{}') as unknown
    parsed = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    parsed = null
  }
  const field = 'w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-[11.5px] outline-none focus:border-foreground/30'
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">In a test, send the event yourself to see what happens next.</p>
      <label className="block space-y-1">
        <span className="text-[11.5px] font-medium text-foreground">Event</span>
        <input className={field} value={event} onChange={(change) => setEvent(change.target.value)} placeholder="deployment.completed" disabled={busy} />
      </label>
      <label className="block space-y-1">
        <span className="text-[11.5px] font-medium text-foreground">Payload (JSON)</span>
        <textarea className={cn(field, 'resize-none')} rows={4} value={payload} onChange={(change) => setPayload(change.target.value)} disabled={busy} />
      </label>
      {parsed === null ? <p className="text-[11px] text-red-600 dark:text-red-400">The payload must be a JSON object.</p> : null}
      <Button size="sm" className="h-7 text-[11.5px]" disabled={busy || !event.trim() || parsed === null} onClick={() => parsed && onSend(event.trim(), parsed)}>
        Send test event
      </Button>
    </div>
  )
}
