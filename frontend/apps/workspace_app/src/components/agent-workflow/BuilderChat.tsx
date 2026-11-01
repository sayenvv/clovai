import { useEffect, useRef, useState } from 'react'
import { Boxes, FolderCode, ImageIcon, Rocket, SquarePen } from 'lucide-react'
import {
  ChatComposer,
  ChatEmptyState,
  ChatTurnBody,
  ComposerSendButton,
  ComposerStopButton,
} from '@/components/agent-workflow/ChatComposer'
import { ChatMarkdown } from '@/components/agent-workflow/ChatMarkdown'
import { UserMessage } from '@/components/agent-workflow/ExecutionSidebarPanel'
import { GenerateModelPicker } from '@/components/agent-workflow/GenerateModelPicker'
import { usePersistedChat } from '@/components/agent-workflow/hooks/use-persisted-chat'
import { AssistantRequestCard } from '@/components/agent-workflow/AssistantCards'
import { isOutOfTokens } from '@/components/agent-workflow/OutOfTokensNotice'
import {
  RunSteps,
  ThoughtSteps,
  answerText,
  applyAssistantEvent,
  finishSteps,
  type GenerateChatMessage,
} from '@/components/agent-workflow/GenerateWorkflowChat'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import {
  answerAssistant,
  fetchBuilderProject,
  fetchLatestBuilderProject,
  fetchBuilderScreenshot,
  streamBuilderMessage,
  type AssistantRequest,
  type BuilderProject,
  type BuilderRun,
} from '@/services/workflow-assistant-api'
import { refreshTokenUsage, startTokenMeter, type TokenMeter } from '@/services/token-usage-store'
import { BUY_CREDITS_URL } from '@/constants'
import type { WorkflowChatMessage } from '@/types/agent-workflow'

const EXAMPLES = [
  'Build a workflow that classifies support tickets and drafts replies, and test it.',
  'Build a React app with a landing page and a pricing section, and check how it looks.',
  'Connect my app to my deployed workflow so a form on the page runs it.',
]

interface BuilderChatProps {
  model: GenerateWorkflowModel
  onModelChange: (model: GenerateWorkflowModel) => void
  serverModel: string
  llmConfigured?: boolean
  ollamaBaseUrl: string
  /** Opens on this project (kept by the host, such as the App Builder, per deployment). */
  initialProjectId?: string
  /** The deployment the app is for; the assistant connects the app to it. */
  initialDeploymentId?: string
  onProjectChange?: (projectId: string) => void
  /** Called after each turn, so the host can reload the project's files. */
  onTurnDone?: () => void
  /** Leaves out the project panel when the host shows the files itself. */
  hideProjectPanel?: boolean
  /** Keeps the chat (and its server-side conversation) in this browser under this name, such as one deployment's
   * app; without it the chat ends when the component unmounts. */
  chatScope?: string
}

/** The builder assistant's chat: builds workflows and apps, and connects an app to a deployed workflow. */
export function BuilderChat({
  model,
  onModelChange,
  serverModel,
  llmConfigured,
  ollamaBaseUrl,
  initialProjectId,
  initialDeploymentId,
  onProjectChange,
  onTurnDone,
  hideProjectPanel = false,
  chatScope,
}: BuilderChatProps) {
  const { messages, setMessages, conversationId, reset } = usePersistedChat<GenerateChatMessage>(chatScope)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [liveSteps, setLiveSteps] = useState<WorkflowChatMessage[]>([])
  const [pending, setPending] = useState<{ runId: string; request: AssistantRequest } | null>(null)
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId)
  const [deploymentId, setDeploymentId] = useState<string | undefined>(initialDeploymentId)
  const [project, setProject] = useState<BuilderProject | null>(null)
  const [shots, setShots] = useState<Array<{ name: string; url: string }>>([])
  const projectRef = useRef<string | undefined>(initialProjectId)
  const adoptingRef = useRef(false)
  const stepsRef = useRef<WorkflowChatMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const meterRef = useRef<TokenMeter | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, liveSteps, pending])

  // What the app has now: its files and screenshots, after each turn
  useEffect(() => {
    if (!projectId || busy || hideProjectPanel) return
    let cancelled = false
    const urls: string[] = []
    void (async () => {
      try {
        const loaded = await fetchBuilderProject(projectId)
        const images = await Promise.all(
          loaded.screenshots.slice(-6).map(async (name) => ({ name, url: await fetchBuilderScreenshot(projectId, name) })),
        )
        urls.push(...images.map((image) => image.url))
        if (cancelled) return
        setProject(loaded)
        setShots(images)
      } catch {
        // The panel is a convenience: the chat still works without it
      }
    })()
    return () => {
      cancelled = true
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [projectId, busy, messages.length])

  const push = (message: GenerateChatMessage) => setMessages((previous) => [...previous, message])
  const onEvent = (event: Parameters<typeof applyAssistantEvent>[1]) => {
    if (event.type === 'usage') meterRef.current?.add(event.totalTokens ?? 0)
    // Tool events carry no ids, so a chat that does not know its project yet adopts the user's newest one
    if (event.type === 'tool.completed' && event.tool && /file|scaffold|dependency|project/i.test(event.tool)) {
      if (projectRef.current) onTurnDone?.()
      else if (!adoptingRef.current) {
        adoptingRef.current = true
        void fetchLatestBuilderProject()
          .then((id) => {
            if (!id || projectRef.current) return
            projectRef.current = id
            setProjectId(id)
            onProjectChange?.(id)
          })
          .catch(() => undefined)
          .finally(() => {
            adoptingRef.current = false
          })
      }
    }
    stepsRef.current = applyAssistantEvent(stepsRef.current, event)
    setLiveSteps(stepsRef.current)
  }

  const showRun = (run: BuilderRun, startedAt: number) => {
    const steps = finishSteps(stepsRef.current)
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    const tokens = run.events.reduce((sum, event) => sum + (event.type === 'usage' ? (event.totalTokens ?? 0) : 0), 0) || undefined
    if (run.output?.projectId) {
      projectRef.current = run.output.projectId
      setProjectId(run.output.projectId)
      onProjectChange?.(run.output.projectId)
    }
    if (run.output?.deploymentId) setDeploymentId(run.output.deploymentId)
    if (run.status === 'waiting' && run.requests.length > 0) {
      setPending({ runId: run.id, request: run.requests[0] })
      if (steps.length) push({ id: `assistant-${Date.now()}`, role: 'assistant', content: '', steps, seconds, tokens })
      return
    }
    setPending(null)
    if (run.status !== 'succeeded') {
      const detail = run.error || run.issues?.map((issue) => issue.message).join('; ') || run.status
      push({ id: `assistant-error-${Date.now()}`, role: 'assistant', content: `The assistant couldn't finish: ${detail}`, tone: 'error', steps, seconds, tokens })
      return
    }
    push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: run.output?.reply ?? '',
      ...(steps.length ? { steps, seconds, tokens } : {}),
    })
  }

  const run = async (start: (signal: AbortSignal) => Promise<BuilderRun>) => {
    const startedAt = Date.now()
    const controller = new AbortController()
    abortRef.current = controller
    meterRef.current = startTokenMeter()
    stepsRef.current = []
    setLiveSteps([])
    setBusy(true)
    try {
      showRun(await start(controller.signal), startedAt)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      push(
        controller.signal.aborted
          ? { id: `stopped-${Date.now()}`, role: 'assistant', content: 'Stopped.', tone: 'muted' }
          : {
              id: `error-${Date.now()}`,
              role: 'assistant',
              tone: 'error',
              content: isOutOfTokens(message)
                ? `You have used all your credits. [Buy more credits](${BUY_CREDITS_URL}) to keep working with the assistant.`
                : `The assistant couldn't finish. ${message}`.trim(),
            },
      )
    } finally {
      abortRef.current = null
      stepsRef.current = []
      setLiveSteps([])
      setBusy(false)
      void meterRef.current?.settle()
      meterRef.current = null
      void refreshTokenUsage()
      onTurnDone?.()
    }
  }

  const send = (text = draft) => {
    const message = text.trim()
    if (!message || busy) return
    push({ id: `user-${Date.now()}`, role: 'user', content: message })
    setDraft('')
    setPending(null)
    void run((signal) =>
      streamBuilderMessage({
        message,
        model,
        projectId,
        deploymentId,
        conversationId,
        onEvent,
        signal,
      }),
    )
  }

  const answer = (response: Record<string, unknown>) => {
    if (!pending) return
    const { runId, request } = pending
    setPending(null)
    push({ id: `user-${Date.now()}`, role: 'user', content: answerText(request, response) })
    void run(
      (signal) => answerAssistant(runId, request.id, response, { onEvent, signal }) as Promise<BuilderRun>,
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {messages.length > 0 ? (
        <div className="flex shrink-0 items-center justify-end border-b border-border/60 px-3 py-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPending(null)
              reset()
            }}
            className="flex h-6 items-center gap-1.5 rounded-[3px] px-2 text-[11.5px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
            title="Start a new conversation (this one is cleared)"
          >
            <SquarePen className="h-3.5 w-3.5" /> New chat
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {messages.length === 0 && !busy ? (
          <ChatEmptyState
            icon={<Boxes />}
            title="Builder assistant"
            description="Builds workflows and apps (React), checks and fixes them, and connects an app to a workflow you deployed."
            suggestions={EXAMPLES}
            onSuggestion={send}
            disabled={busy}
          />
        ) : null}

        {project ? (
          <section className="rounded-[3px] border border-border bg-card px-3 py-2 text-[11.5px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <FolderCode className="h-3.5 w-3.5" /> App project
              </span>
              <span>{project.files.length} files</span>
              {project.changed?.length ? <span>{project.changed.length} changed</span> : null}
              {project.scripts?.length ? <span>scripts: {project.scripts.join(', ')}</span> : null}
              {deploymentId ? (
                <span className="flex items-center gap-1">
                  <Rocket className="h-3.5 w-3.5" /> workflow {deploymentId.slice(0, 8)}
                </span>
              ) : null}
            </div>
            {shots.length ? (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {shots.map((shot) => (
                  <a key={shot.name} href={shot.url} target="_blank" rel="noreferrer" title={shot.name}>
                    <img src={shot.url} alt={shot.name} className="h-24 rounded-[3px] border border-border object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-1 flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" /> No screenshots yet.
              </p>
            )}
          </section>
        ) : null}

        {messages.map((message) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} content={message.content} />
          ) : (
            <div key={message.id} className="min-w-0">
              {message.seconds || message.steps?.length ? (
                <div className="mb-2">
                  <ThoughtSteps steps={message.steps ?? []} seconds={message.seconds} tokens={message.tokens} />
                </div>
              ) : null}
              <ChatTurnBody>
                {message.tone ? (
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    <ChatMarkdown content={message.content} streaming={false} />
                  </p>
                ) : (
                  <ChatMarkdown content={message.content} streaming={false} />
                )}
              </ChatTurnBody>
            </div>
          ),
        )}

        {!busy && pending ? (
          <AssistantRequestCard key={pending.request.id} request={pending.request} busy={busy} onAnswer={answer} />
        ) : null}
        {busy ? <RunSteps steps={liveSteps} live fallbackActivity="Thinking" /> : null}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 space-y-2 bg-background p-3">
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => send()}
          canSubmit={Boolean(draft.trim()) && !busy}
          placeholder="Describe the workflow or app you want…"
          autoFocus
          leading={
            <GenerateModelPicker
              value={model}
              onChange={onModelChange}
              serverModel={serverModel}
              serverConfigured={llmConfigured ?? true}
              ollamaBaseUrl={ollamaBaseUrl}
              disabled={busy}
            />
          }
          action={
            busy ? (
              <ComposerStopButton onClick={() => abortRef.current?.abort()} />
            ) : (
              <ComposerSendButton onClick={() => send()} disabled={!draft.trim()} label="Send message" />
            )
          }
          hint={projectId ? 'Working on your app project' : 'Builds workflows and apps'}
        />
      </div>
    </div>
  )
}
