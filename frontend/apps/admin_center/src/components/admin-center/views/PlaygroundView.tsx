import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Bot, Download, ListTree, Loader2, RotateCcw, Save, Send, Square, User, Workflow } from 'lucide-react'
import { createDefinition, listDefinitions, type DefinitionDetail } from '@/api/definitions'
import { runPlayground, type PlaygroundStep } from '@/api/playground'
import { ApplicationGate } from '@/components/admin-center/ApplicationGate'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { Button } from '@/components/ui/button'
import { useApplication } from '@/hooks/use-application'
import { WorkflowCanvasView } from '@/components/admin-center/WorkflowCanvasView'

const SELECT =
  'h-8 w-full rounded-md border border-input bg-transparent px-2 text-[12px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface Turn {
  id: string
  message: string
  steps: PlaygroundStep[]
  answer: string
  error: string
  traceId: string
  running: boolean
  /** The workflow JSON the run built, if it built one. */
  workflow?: Record<string, unknown>
}

const newConversationId = () => `playground-${crypto.randomUUID()}`

/** A 3.0 workflow, the only kind /execute can run. */
const runnable = (row: DefinitionDetail) => Boolean((row.definition as { meta?: { orchestrationPattern?: string } }).meta?.orchestrationPattern)

/** The workflow's agent names by id, so steps read "Requirements Analyst" rather than an id. */
function agentNames(row: DefinitionDetail | undefined): Record<string, string> {
  const agents = ((row?.definition as { agents?: Array<{ id?: string; displayName?: string; name?: string }> })?.agents ?? [])
  return Object.fromEntries(agents.filter((agent) => agent.id).map((agent) => [agent.id!, agent.displayName || agent.name || agent.id!]))
}

/**
 * Overview → Playground: run an admin workflow the way users' chats do (the execute API, live), with
 * an optional context workflow, and see each agent's steps and the final answer.
 */
export function PlaygroundView() {
  const { current } = useApplication()
  const [workflows, setWorkflows] = useState<DefinitionDetail[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [workflowId, setWorkflowId] = useState('')
  const [contextId, setContextId] = useState('')
  const [conversationId, setConversationId] = useState(newConversationId)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [showSteps, setShowSteps] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    listDefinitions('workflows', 'system_generated')
      .then((rows) => {
        if (!live) return
        const usable = rows.filter(runnable).sort((a, b) => Number(b.purpose === 'ai_assistant') - Number(a.purpose === 'ai_assistant'))
        setWorkflows(usable)
        setWorkflowId((chosen) => chosen || usable[0]?.id || '')
      })
      .catch((reason: unknown) => live && setLoadError(reason instanceof Error ? reason.message : String(reason)))
    return () => {
      live = false
    }
  }, [])

  // A block body: newer browsers return a Promise from scrollIntoView, and React would treat a
  // returned value as the effect's cleanup and crash calling it
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [turns])

  const selected = workflows?.find((row) => row.id === workflowId)
  const names = useMemo(() => agentNames(selected), [selected])
  const running = turns.some((turn) => turn.running)

  const update = (id: string, patch: Partial<Turn> | ((turn: Turn) => Partial<Turn>)) =>
    setTurns((previous) => previous.map((turn) => (turn.id === id ? { ...turn, ...(typeof patch === 'function' ? patch(turn) : patch) } : turn)))

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    const message = draft.trim()
    if (!message || !workflowId || !current || running) return
    const id = crypto.randomUUID()
    setTurns((previous) => [...previous, { id, message, steps: [], answer: '', error: '', traceId: '', running: true }])
    setDraft('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const outcome = await runPlayground(
        {
          workflowId,
          message,
          aiIntegrationId: current.ai_integration_id,
          workflowContextId: contextId || undefined,
          conversationId,
          signal: controller.signal,
        },
        (step) => update(id, (turn) => ({ steps: [...turn.steps, step] })),
      )
      update(id, { answer: outcome.output, error: outcome.error ?? '', traceId: outcome.traceId, running: false, workflow: outcome.workflow })
    } catch (reason) {
      const stopped = controller.signal.aborted
      update(id, { error: stopped ? 'Stopped.' : reason instanceof Error ? reason.message : String(reason), running: false })
    } finally {
      abortRef.current = null
    }
  }

  const restart = () => {
    abortRef.current?.abort()
    setTurns([])
    setConversationId(newConversationId())
  }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Playground"
        description="Test a workflow the way users' chats run it: the execute API, live, with an optional context workflow. Each conversation keeps its own history."
        actions={
          <>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]" onClick={() => setShowSteps((value) => !value)}>
              <ListTree className="h-3.5 w-3.5" />
              {showSteps ? 'Hide steps' : 'Show steps'}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]" onClick={restart} disabled={turns.length === 0 && !running}>
              <RotateCcw className="h-3.5 w-3.5" />
              New conversation
            </Button>
          </>
        }
      />
      <PageBody className="space-y-3">
        <ApplicationGate>
          <PremiumCard className="grid gap-3 p-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              Workflow to run
              <select
                className={SELECT}
                value={workflowId}
                onChange={(event) => {
                  setWorkflowId(event.target.value)
                  restart()
                }}
                disabled={running || !workflows?.length}
              >
                {workflows?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name || 'Untitled'}
                    {row.purpose === 'ai_assistant' ? ' · AI assistant' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
              Context workflow (optional, sent as workflow_context_id)
              <select className={SELECT} value={contextId} onChange={(event) => setContextId(event.target.value)} disabled={running}>
                <option value="">None</option>
                {workflows?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name || 'Untitled'}
                  </option>
                ))}
              </select>
            </label>
          </PremiumCard>

          {loadError ? (
            <EmptyHint title="Couldn't load workflows" hint={loadError} />
          ) : workflows !== null && workflows.length === 0 ? (
            <EmptyHint title="No runnable workflows" hint="Create or upload a schemaVersion 3.0 workflow under Workflows first." />
          ) : null}

          <PremiumCard className="flex min-h-[420px] flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {turns.length === 0 ? (
                <EmptyHint title="Start a conversation" hint="Type a message below. Messages in one conversation share its history." className="border-0 bg-transparent" />
              ) : (
                turns.map((turn) => (
                  <div key={turn.id} className="space-y-2.5">
                    <div className="flex justify-end">
                      <div className="flex max-w-[80%] items-start gap-2 rounded-lg bg-foreground/5 px-3 py-2 text-[12.5px]">
                        <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="whitespace-pre-wrap">{turn.message}</span>
                      </div>
                    </div>
                    {showSteps && turn.steps.length > 0 && (
                      <ol className="ml-1 space-y-1.5 border-l border-border/70 pl-3">
                        {turn.steps
                          .filter((step) => step.kind !== 'started' || turn.running)
                          .map((step) => (
                            <li key={step.id} className="text-[11.5px]">
                              <span className="font-medium text-foreground">{names[step.agentId] || step.agentId || 'Workflow'}</span>{' '}
                              <span className="text-muted-foreground">
                                {step.kind === 'started' ? 'is working…' : step.kind === 'plan' ? '· plan' : step.kind === 'error' ? '· error' : '· reply'}
                              </span>
                              {step.text ? (
                                <p className={`mt-0.5 line-clamp-6 whitespace-pre-wrap ${step.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{step.text}</p>
                              ) : null}
                            </li>
                          ))}
                      </ol>
                    )}
                    <div className="flex items-start gap-2">
                      <Bot className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {turn.running ? (
                          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…
                          </p>
                        ) : turn.error ? (
                          <p className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {turn.error}
                          </p>
                        ) : (
                          <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed">{turn.answer || 'The run finished without an answer.'}</pre>
                        )}
                        {turn.workflow ? <BuiltWorkflow workflow={turn.workflow} /> : null}
                        {turn.traceId ? <StatusBadge label={`trace ${turn.traceId.slice(0, 12)}…`} tone="neutral" className="normal-case" /> : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>
            <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-border/60 p-3">
              <textarea
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder={selected ? `Message ${selected.name || 'the workflow'}… (Enter to send, Shift+Enter for a new line)` : 'Pick a workflow first'}
                className="min-h-[44px] flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-[12.5px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={!workflowId}
              />
              {running ? (
                <Button type="button" size="sm" variant="outline" className="h-auto gap-1.5 self-stretch text-[11.5px]" onClick={() => abortRef.current?.abort()}>
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              ) : (
                <Button type="submit" size="sm" className="h-auto gap-1.5 self-stretch text-[11.5px] font-semibold" disabled={!draft.trim() || !workflowId}>
                  <Send className="h-3.5 w-3.5" />
                  Send
                </Button>
              )}
            </form>
          </PremiumCard>
        </ApplicationGate>
      </PageBody>
    </>
  )
}

/** The workflow a run built: what it is, and ways to keep it. */
function BuiltWorkflow({ workflow }: { workflow: Record<string, unknown> }) {
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const [error, setError] = useState('')
  const meta = (workflow.meta ?? {}) as { workflowName?: string; orchestrationPattern?: string }
  const agents = (workflow.agents as Array<{ displayName?: string }> | undefined) ?? []
  const name = meta.workflowName || 'Built workflow'

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'workflow'}.json` })
    link.click()
    URL.revokeObjectURL(url)
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      setSaved((await createDefinition('workflows', workflow)).id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-md border border-border/70 bg-foreground/[0.03] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Workflow className="h-4 w-4 text-muted-foreground" />
        <span className="text-[12.5px] font-semibold">{name}</span>
        <StatusBadge label={meta.orchestrationPattern || 'workflow'} tone="info" />
        <span className="text-[11px] text-muted-foreground">
          {agents.length} agent{agents.length === 1 ? '' : 's'}: {agents.map((agent) => agent.displayName).filter(Boolean).join(', ')}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => setShowCanvas((value) => !value)}>
          <Workflow className="h-3.5 w-3.5" />
          {showCanvas ? 'Hide canvas' : 'View canvas'}
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={download}>
          <Download className="h-3.5 w-3.5" />
          Download JSON
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={() => void save()} disabled={busy || saved !== null}>
          <Save className="h-3.5 w-3.5" />
          {saved ? 'Saved as admin workflow' : 'Save as admin workflow'}
        </Button>
        {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
      </div>
      {showCanvas ? <WorkflowCanvasView workflow={workflow} className="mt-3" /> : null}
    </div>
  )
}
