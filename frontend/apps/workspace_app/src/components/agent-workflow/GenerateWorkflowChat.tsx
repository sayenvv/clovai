import { memo, useEffect, useRef, useState } from 'react'
import { ChevronRight, FileText, Target, X, type LucideIcon } from 'lucide-react'
import { WorkflowIcon as Workflow } from '@/components/shared/WorkflowIcon'
import { toast } from 'sonner'
import {
  ChatComposer,
  ChatEmptyState,
  ChatTurnBody,
  ComposerSendButton,
  ComposerStopButton,
} from '@/components/agent-workflow/ChatComposer'
import { ChatMarkdown } from '@/components/agent-workflow/ChatMarkdown'
import {
  readableChatText,
  UserMessage,
} from '@/components/agent-workflow/ExecutionSidebarPanel'
import { PetalLoader, PetalMark } from '@/components/shared/PetalLoader'
import { PlanReviewCard } from '@/components/agent-workflow/PlanReviewCard'
import type { PlanReview } from '@/services/workflow-run-api'
import type { WorkflowChatMessage } from '@/types/agent-workflow'
import { GenerateModelPicker } from '@/components/agent-workflow/GenerateModelPicker'
import {
  type GenerateWorkflowAttachment,
  type GenerateWorkflowModel,
} from '@/services/generate-workflow-api'
import type { CanvasPlan } from '@/components/agent-workflow/workflow-plan-from-diagram'
import { listAgentNodes } from '@/components/agent-workflow/tool-agent-mapping'
import type { DiagramPage } from '@/components/designer/diagram-types'
import { cn } from '@/utils/cn'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'
import type { ImportedWorkflow } from '@/components/agent-workflow/workflow-import'
import { fetchSavedWorkflows, type SavedWorkflowSummary } from '@/services/activity-api'
import { AssistantRequestCard, DraftReviewCard, draftHasChanges } from '@/components/agent-workflow/AssistantCards'
import { buildWorkflowV4 } from '@/components/agent-workflow/build-workflow-v4'
import { importWorkflowV4 } from '@/components/agent-workflow/import-workflow-v4'
import { useGenerationSpec } from '@/hooks/use-generation-spec'
import {
  acceptDraft,
  answerAssistant,
  createDraft,
  discardDraft,
  fetchDraftDiff,
  streamAssistantMessage,
  type AssistantRequest,
  type AssistantRun,
  type AssistantRunEvent,
  type DraftDiff,
} from '@/services/workflow-assistant-api'

const ASSISTANT_NAME = 'ElevenNodes AI'
const MAX_ATTACHMENTS = 5
const MAX_CONTEXT_TABS = 3
/** Matches the API's per-file limit. */
const MAX_ATTACHMENT_CHARS = 200_000
const ATTACHMENT_ACCEPT = '.csv,.json,.log,.md,.txt,.xml,.yaml,.yml,application/json,text/*'

const EXAMPLE_PROMPTS = [
  'Research a topic, summarize findings, and draft a blog post with human review before publish.',
  'Ingest support tickets, classify urgency, route to the right specialist, and draft replies.',
  'Extract invoice fields from uploaded PDFs, validate totals, and push to accounting.',
]

export interface GenerateChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Files and workflow tabs sent as context with a user message. */
  context?: Array<{ kind: 'file' | 'tab' | 'workflow'; name: string }>
  tone?: 'error' | 'muted'
  /** Assistant replies: each agent's turns from the run, shown above the reply. */
  steps?: WorkflowChatMessage[]
  /** How long the run took, shown as "Thought for Ns" above the reply. */
  seconds?: number
  /** Tokens the run used, summed from its usage events; shown beside the time. */
  tokens?: number
}

interface PendingAttachment extends GenerateWorkflowAttachment {
  id: string
  size: number
}

interface GenerateWorkflowChatProps {
  /** Kept by the page so the conversation survives switching panels. */
  messages: GenerateChatMessage[]
  onMessagesChange: (updater: (previous: GenerateChatMessage[]) => GenerateChatMessage[]) => void
  model: GenerateWorkflowModel
  onModelChange: (model: GenerateWorkflowModel) => void
  serverModel: string
  llmConfigured?: boolean
  ollamaBaseUrl: string
  /** Workflow tabs that can be added as context. */
  pages: DiagramPage[]
  activePageId: string
  /** The canvas already has agents, so a request updates them. */
  replacesCanvas?: boolean
  /** The current tab as a plan, read at send time. Null when it has no agents. */
  getCurrentWorkflow?: () => CanvasPlan | null
  /** `base` is the canvas the plan was updated from, or null for a new draft. */
  onGenerated: (plan: WorkflowGenerationPlan, base: CanvasPlan | null) => void
  /** A complete workflow the assistant returned, placed on the canvas like File → Import. */
  onImportWorkflow?: (imported: ImportedWorkflow) => void
  /** An accepted 4.0 assistant draft: replaces the open tab. */
  onReplaceWorkflow?: (imported: ImportedWorkflow) => void
  /** The chat session id, sent as the run's conversation id (for agents with conversation history). */
  conversationId?: string
}

function ContextChip({
  icon: Icon,
  name,
  meta,
  onRemove,
}: {
  icon: LucideIcon
  name: string
  meta?: string
  onRemove?: () => void
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border border-border/70 pl-1.5 text-[11px]',
        onRemove ? 'bg-muted/40 pr-0.5' : 'bg-background pr-2 text-muted-foreground',
      )}
      title={meta ? `${name} · ${meta}` : name}
    >
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className={cn('max-w-[9rem] truncate', onRemove && 'text-foreground')}>{name}</span>
      {meta ? <span className="shrink-0 tabular-nums text-muted-foreground">{meta}</span> : null}
      {onRemove ? (
        <button
          type="button"
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
}

function isTextFile(file: File): boolean {
  return file.type.startsWith('text/') || /\.(csv|json|log|md|txt|xml|yaml|yml)$/i.test(file.name)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * An agent's answer here is a workflow JSON draft or a review, so it is shown
 * folded under a title like a reasoning step, and the reply below sums it up.
 */
function foldedStep(step: WorkflowChatMessage): WorkflowChatMessage {
  return step.kind === 'reasoning' ? step : { ...step, kind: 'reasoning', title: step.title ?? 'Response' }
}

function finishSteps(steps: WorkflowChatMessage[]): WorkflowChatMessage[] {
  return steps
    .filter((step) => step.content.trim())
    .map((step) => (step.status === 'streaming' ? { ...step, status: 'done' as const } : step))
}

/**
 * The run as a timeline, one item per stage. A running stage shows the loader
 * and what it is doing ("Planning…"); a finished stage shows a dot, its title,
 * and its reasoning on demand. Live model thinking is held back until its stage
 * is done, so a running stage never shows twice.
 *
 * Markers sit in one fixed column centred under the assistant's avatar, joined
 * by a single rail; step text starts where the reply text starts.
 */
function RunSteps({
  steps,
  live,
  activities = {},
  fallbackActivity = 'Thinking',
}: {
  steps: WorkflowChatMessage[]
  live: boolean
  activities?: Record<string, string>
  fallbackActivity?: string
}) {
  const running = (step: WorkflowChatMessage) => live && step.status === 'streaming'
  const shown = steps.filter((step) => !(running(step) && step.nodeId.endsWith(':thinking')))
  const items: TimelineItem[] = shown.map((step) =>
    running(step) && !step.content.trim()
      ? { key: step.id, state: 'running', title: activities[step.nodeId] || step.title || fallbackActivity, content: '' }
      : {
          key: step.id,
          state: step.status === 'failed' || step.content.startsWith('⚠') ? 'failed' : 'done',
          title: foldedStep(step).title ?? 'Step',
          content: readableChatText(step.content.replace(/^⚠\s*/, '')),
        },
  )
  // Between stages, and before the first one, something is still working.
  if (live && !items.some((item) => item.state === 'running')) {
    items.push({ key: 'working', state: 'running', title: fallbackActivity, content: '' })
  }

  return (
    <ol>
      {items.map((item, index) => (
        <TimelineStep key={item.key} item={item} last={index === items.length - 1} />
      ))}
    </ol>
  )
}

/** A finished run, folded to "Thought for Ns"; opening it shows the steps as the timeline. */
function formatTokens(tokens: number): string {
  return tokens >= 1_000 ? `${(tokens / 1_000).toFixed(1)}k` : String(tokens)
}

function ThoughtSteps({ steps, seconds, tokens }: { steps: WorkflowChatMessage[]; seconds?: number; tokens?: number }) {
  const [open, setOpen] = useState(false)
  const expandable = steps.length > 0
  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={!expandable}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={expandable ? open : undefined}
        className={cn(
          'group flex h-5 min-w-0 items-center gap-1.5 text-left text-[12.5px] font-medium text-muted-foreground transition-colors',
          expandable && 'hover:text-foreground',
        )}
      >
        <span>
          {seconds ? `Thought for ${seconds}s` : 'Thought'}
          {tokens ? <span className="font-normal tabular-nums"> · {formatTokens(tokens)} tokens</span> : null}
        </span>
        {expandable ? (
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
        ) : null}
      </button>
      {open ? (
        <div className="mt-2">
          <RunSteps steps={steps} live={false} />
        </div>
      ) : null}
    </div>
  )
}

interface TimelineItem {
  key: string
  state: 'running' | 'done' | 'failed'
  title: string
  content: string
}

function preview(content: string): string {
  return content.split('\n').map((line) => line.replace(/[#*_`>-]/g, '').trim()).find(Boolean) ?? ''
}

function TimelineStep({ item, last }: { item: TimelineItem; last: boolean }) {
  const [open, setOpen] = useState(false)
  const expandable = item.state !== 'running' && Boolean(item.content)

  return (
    <li className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-x-2.5">
      {/* Marker column: the marker, then the rail down to the next item's marker. */}
      <div className="relative flex justify-center">
        <span className="flex h-5 items-center">
          {item.state === 'running' ? (
            <PetalLoader size={22} label={item.title} className="-my-0.5" />
          ) : (
            <span
              aria-hidden
              className={cn('h-[7px] w-[7px] rounded-full', item.state === 'failed' ? 'bg-red-500' : 'bg-foreground/60')}
            />
          )}
        </span>
        {!last ? <span aria-hidden className="absolute bottom-0 left-1/2 top-[17px] w-px -translate-x-1/2 bg-border" /> : null}
      </div>

      <div className={cn('min-w-0', !last && 'pb-3')}>
        {item.state === 'running' ? (
          <div className="flex h-5 min-w-0 items-center gap-2" role="status" aria-live="polite">
            <span className="truncate text-[12.5px] font-medium text-foreground">{item.title}…</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!expandable}
              onClick={() => setOpen((value) => !value)}
              aria-expanded={expandable ? open : undefined}
              className={cn(
                'group flex h-5 w-full min-w-0 items-center gap-1.5 text-left text-[12.5px] transition-colors',
                item.state === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                expandable && 'hover:text-foreground',
              )}
            >
              <span className="shrink-0 font-medium">{item.title}</span>
              {!open && item.content ? (
                <span className="min-w-0 truncate text-muted-foreground/70">{preview(item.content)}</span>
              ) : null}
              {expandable ? (
                <ChevronRight
                  className={cn(
                    'ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-[transform,opacity] group-hover:opacity-100',
                    open && 'rotate-90 opacity-100',
                  )}
                />
              ) : null}
            </button>
            {open && item.content ? (
              <div className="mt-1">
                <ChatMarkdown content={item.content} streaming={false} className="text-[12px] leading-5 text-muted-foreground" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </li>
  )
}



/** Earlier turns for the API, oldest first. Errors and "Stopped." notes are left out. */
/** What each assistant agent is doing while it runs. */
const AGENT_ACTIVITY: Record<string, string> = {
  Router: 'Understanding the request',
  Planner: 'Planning the workflow',
  Builder: 'Building the workflow',
  'Step filler': 'Filling in the steps',
  Editor: 'Editing the workflow',
  Repairer: 'Fixing problems',
  Explainer: 'Explaining the workflow',
  Reviewer: 'Reviewing the workflow',
  Operator: 'Running a test',
  Responder: 'Writing the reply',
}

/** The assistant's tools, as the step a person sees. */
const TOOL_ACTIVITY: Record<string, string> = {
  open_draft: 'Opening the draft',
  get_outline: 'Reading the workflow outline',
  get_object: 'Reading a step',
  get_section: 'Reading part of the workflow',
  find: 'Searching the workflow',
  apply_ops: 'Applying changes to the draft',
  validate_draft: 'Checking the draft',
  get_diff: 'Comparing the changes',
  catalog_models: 'Looking up models',
  catalog_model_clients: 'Looking up model connections',
  catalog_agents: 'Looking up saved agents',
  catalog_tools: 'Looking up tools',
  test_run: 'Test-running the workflow',
  get_run: 'Reading the test run',
}

const toolActivity = (tool: string) => TOOL_ACTIVITY[tool] ?? tool.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())

/**
 * The 4.0 assistant's run as chat steps: one row per agent, and under it one row per tool call, each
 * running until it completes, so a long turn shows what it is doing.
 */
function applyAssistantEvent(steps: WorkflowChatMessage[], event: AssistantRunEvent): WorkflowChatMessage[] {
  const finish = (index: number, failed: boolean, content: string) => {
    if (index < 0) return steps
    const next = [...steps]
    next[index] = { ...next[index], status: failed ? 'failed' : 'done', content }
    return next
  }
  if (event.type === 'tool.started' && event.tool) {
    const title = toolActivity(event.tool)
    return [...steps, { id: `tool-${steps.length}`, nodeId: `tool:${event.tool}`, agentName: event.agent ?? 'Assistant', title, content: '', kind: 'reasoning', status: 'streaming' }]
  }
  if (event.type === 'tool.completed' && event.tool) {
    const index = steps.findLastIndex((step) => step.nodeId === `tool:${event.tool}` && step.status === 'streaming')
    return finish(index, Boolean(event.error), event.error ? `⚠ ${event.error}` : `${event.agent ?? 'The assistant'} used ${event.tool}.`)
  }
  if (event.nodeType && event.nodeType !== 'agent' && event.type === 'node.started') return steps
  if (event.type === 'node.started' && event.nodeId) {
    const name = event.name ?? 'Step'
    const title = AGENT_ACTIVITY[name] ?? name
    return [...steps, { id: `${event.nodeId}-${steps.length}`, nodeId: event.nodeId, agentName: name, title, content: '', kind: 'reasoning', status: 'streaming' }]
  }
  if ((event.type === 'node.completed' || event.type === 'node.failed') && event.nodeId) {
    const index = steps.map((step) => step.nodeId).lastIndexOf(event.nodeId)
    const failed = event.type === 'node.failed'
    return finish(index, failed, failed ? `⚠ ${event.error ?? 'Failed'}` : `${steps[index]?.agentName ?? 'The agent'} finished.`)
  }
  return steps
}

/** Right-panel chat that drafts a workflow onto the canvas from a description. */
export const GenerateWorkflowChat = memo(function GenerateWorkflowChat({
  messages,
  onMessagesChange,
  model,
  onModelChange,
  serverModel,
  llmConfigured = false,
  ollamaBaseUrl,
  pages,
  activePageId,
  replacesCanvas = false,
  onImportWorkflow,
  onReplaceWorkflow,
}: GenerateWorkflowChatProps) {
  const [draft, setDraft] = useState('')
  const generationSpec = useGenerationSpec()
  /** The draft this conversation edits, its pending question, and its changes waiting for review. */
  const [assistantDraftId, setAssistantDraftId] = useState<string | undefined>()
  const [pendingRequest, setPendingRequest] = useState<{ runId: string; request: AssistantRequest } | null>(null)
  const [pendingDraft, setPendingDraft] = useState<DraftDiff | null>(null)
  const [assistantBusy, setAssistantBusy] = useState(false)
  /** The user's saved workflows, offered as the request's context workflow. */
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflowSummary[]>([])
  /** The saved workflow picked as context (`workflow_context_id`); it stays picked across messages. */
  const [contextWorkflowId, setContextWorkflowId] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [contextTabIds, setContextTabIds] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  /** Each agent's turns for the request in flight, streamed as they arrive. */
  const [liveSteps, setLiveSteps] = useState<WorkflowChatMessage[]>([])
  // The manager's plan the running workflow is waiting on, if any.
  const [pendingReview, setPendingReview] = useState<PlanReview | null>(null)
  const liveStepsRef = useRef<WorkflowChatMessage[]>([])
  /** Tokens the request in flight has used so far. */
  /** What each running stage is doing, as the backend names it: Thinking, Planning, Designing… */
  const [activities, setActivities] = useState<Record<string, string>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, isGenerating, liveSteps])

  // Drop an in-flight request if the panel closes.
  useEffect(() => () => abortRef.current?.abort(), [])

  const canGenerate = draft.trim().length > 0 && !isGenerating

  const addFiles = async (files: File[]) => {
    const room = MAX_ATTACHMENTS - attachments.length
    if (room <= 0) {
      toast.error(`Attach up to ${MAX_ATTACHMENTS} files.`)
      return
    }
    if (files.length > room) toast.error(`Only the first ${room} file${room === 1 ? '' : 's'} were attached.`)

    const added: PendingAttachment[] = []
    for (const file of files.slice(0, room)) {
      if (!isTextFile(file)) {
        toast.error(`${file.name}: attach text, Markdown, JSON, CSV, XML, or YAML files.`)
        continue
      }
      if ([...attachments, ...added].some((item) => item.name === file.name)) continue
      try {
        const content = await file.text()
        if (content.length > MAX_ATTACHMENT_CHARS) {
          toast.error(`${file.name} is too large — keep files under ${MAX_ATTACHMENT_CHARS / 1000}k characters.`)
          continue
        }
        added.push({ id: `${file.name}-${file.lastModified}`, name: file.name, size: file.size, content })
      } catch {
        toast.error(`Could not read ${file.name}.`)
      }
    }
    if (added.length > 0) setAttachments((previous) => [...previous, ...added])
  }

  useEffect(() => {
    let live = true
    fetchSavedWorkflows()
      .then((rows) => live && setSavedWorkflows(rows))
      .catch(() => live && setSavedWorkflows([]))
    return () => {
      live = false
    }
  }, [])
  const contextWorkflow = savedWorkflows.find((row) => row.workflow_id === contextWorkflowId)

  // Tabs can be deleted while selected; only keep ones that still exist.
  const contextTabs = contextTabIds
    .map((id) => pages.find((page) => page.id === id))
    .filter((page): page is DiagramPage => Boolean(page))

  const toggleContextTab = (pageId: string) => {
    setContextTabIds((previous) =>
      previous.includes(pageId)
        ? previous.filter((id) => id !== pageId)
        : previous.length >= MAX_CONTEXT_TABS
          ? previous
          : [...previous, pageId],
    )
  }

  const stopGenerating = () => {
    abortRef.current?.abort()
  }

  /** A finished or waiting assistant run: its question as a card, or its reply and the draft to review. */
  const showAssistantRun = async (run: AssistantRun, startedAt: number) => {
    const steps = finishSteps(liveStepsRef.current)
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    if (run.status === 'waiting' && run.requests.length > 0) {
      setPendingRequest({ runId: run.id, request: run.requests[0] })
      if (steps.length) onMessagesChange((previous) => [...previous, { id: `assistant-${Date.now()}`, role: 'assistant', content: '', steps, seconds }])
      return
    }
    setPendingRequest(null)
    if (run.status !== 'succeeded') {
      const detail = run.error || run.issues?.map((issue) => issue.message).join('; ') || run.status
      onMessagesChange((previous) => [
        ...previous,
        { id: `assistant-error-${Date.now()}`, role: 'assistant', content: `The workflow assistant couldn't finish: ${detail}`, tone: 'error', steps, seconds },
      ])
      return
    }
    const draftId = run.output?.draftId || assistantDraftId
    if (draftId) setAssistantDraftId(draftId)
    onMessagesChange((previous) => [
      ...previous,
      { id: `assistant-${Date.now()}`, role: 'assistant', content: run.output?.reply ?? '', steps, seconds },
    ])
    if (draftId) {
      const diff = await fetchDraftDiff(draftId).catch(() => null)
      setPendingDraft(diff && draftHasChanges(diff) ? diff : null)
    }
  }

  /** The draft to work on: the conversation's, else one of the open tab when it has agents. */
  const ensureAssistantDraft = async (): Promise<string | undefined> => {
    if (assistantDraftId) return assistantDraftId
    const page = pages.find((candidate) => candidate.id === activePageId)
    const spec = generationSpec.data?.document
    if (!page || !spec || listAgentNodes(page.diagram).length === 0) return undefined
    const document = buildWorkflowV4({ doc: { pages, activePageId }, pageId: activePageId, diagram: page.diagram, spec })
    const created = await createDraft(document)
    setAssistantDraftId(created.id)
    return created.id
  }

  const runAssistant = async (start: () => Promise<AssistantRun>) => {
    const startedAt = Date.now()
    setIsGenerating(true)
    setAssistantBusy(true)
    liveStepsRef.current = []
    setLiveSteps([])
    setActivities({})
    try {
      await showAssistantRun(await start(), startedAt)
    } catch (error) {
      const stopped = abortRef.current?.signal.aborted
      onMessagesChange((previous) => [
        ...previous,
        stopped
          ? { id: `assistant-stopped-${Date.now()}`, role: 'assistant', content: 'Stopped.', tone: 'muted' }
          : {
              id: `assistant-error-${Date.now()}`,
              role: 'assistant',
              content: `The workflow assistant couldn't finish. ${error instanceof Error ? error.message : ''}`.trim(),
              tone: 'error',
            },
      ])
    } finally {
      abortRef.current = null
      setIsGenerating(false)
      setAssistantBusy(false)
      liveStepsRef.current = []
      setLiveSteps([])
    }
  }

  const handleAssistantMessage = async (prompt: string) => {
    onMessagesChange((previous) => [...previous, { id: `user-${Date.now()}`, role: 'user', content: prompt }])
    setDraft('')
    setPendingRequest(null)
    setPendingDraft(null)
    const controller = new AbortController()
    abortRef.current = controller
    await runAssistant(async () => {
      const draftId = await ensureAssistantDraft()
      return streamAssistantMessage({
        message: prompt,
        draftId,
        model,
        onEvent: (event) => {
          liveStepsRef.current = applyAssistantEvent(liveStepsRef.current, event)
          setLiveSteps(liveStepsRef.current)
        },
        signal: controller.signal,
      })
    })
  }

  const answerRequest = (response: Record<string, unknown>) => {
    if (!pendingRequest) return
    const { runId, request } = pendingRequest
    setPendingRequest(null)
    void runAssistant(() => answerAssistant(runId, request.id, response))
  }

  const acceptAssistantDraft = async () => {
    if (!assistantDraftId) return
    setAssistantBusy(true)
    let accepted: Awaited<ReturnType<typeof acceptDraft>>
    try {
      accepted = await acceptDraft(assistantDraftId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not accept the changes.')
      setAssistantBusy(false)
      return
    }
    // Accepted: the draft is closed, so the card goes whatever happens next
    setPendingDraft(null)
    setAssistantDraftId(undefined)
    try {
      const imported = importWorkflowV4(accepted.document)
      ;(onReplaceWorkflow ?? onImportWorkflow)?.(imported)
      if (imported.losses.length) toast.warning(`Shown approximately on the canvas: ${imported.losses.join('; ')}`)
      // Keep working on what was accepted
      const next = await createDraft(accepted.document)
      setAssistantDraftId(next.id)
    } catch (error) {
      toast.error(`Accepted, but it could not be shown on the canvas: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setAssistantBusy(false)
    }
  }

  const discardAssistantDraft = async () => {
    if (!assistantDraftId) return
    setAssistantBusy(true)
    try {
      await discardDraft(assistantDraftId)
      setAssistantDraftId(undefined)
      setPendingDraft(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not discard the changes.')
    } finally {
      setAssistantBusy(false)
    }
  }

  const handleGenerate = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? draft).trim()
    if (!prompt || isGenerating) return
    await handleAssistantMessage(prompt)
  }


  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div ref={scrollRef} className="min-h-0 w-full min-w-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div>
          <h2 className="text-[15px] font-semibold leading-tight text-foreground">{ASSISTANT_NAME}</h2>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Assistant · {replacesCanvas ? 'edits the canvas' : 'drafts onto the canvas'}
            </p>
          </div>
        </div>
        {messages.length === 0 && (
          <ChatEmptyState
            icon={<PetalMark size={22} />}
            title={`Build with ${ASSISTANT_NAME}`}
            description="Describe an automation and it's drafted onto the canvas, or describe a change to the agents already there."
            suggestions={EXAMPLE_PROMPTS}
            onSuggestion={(example) => void handleGenerate(example)}
            disabled={isGenerating}
          />
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} content={message.content}>
              {message.context?.length ? (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {message.context.map((item) => (
                    <ContextChip
                      key={`${item.kind}-${item.name}`}
                      icon={item.kind === 'workflow' ? Target : item.kind === 'tab' ? Workflow : FileText}
                      name={item.name}
                    />
                  ))}
                </div>
              ) : null}
            </UserMessage>
          ) : (
            <div key={message.id} className="min-w-0">
              {message.seconds || message.steps?.length ? (
                <div className="mb-2">
                  <ThoughtSteps steps={message.steps ?? []} seconds={message.seconds} tokens={message.tokens} />
                </div>
              ) : null}
              <ChatTurnBody>
                {message.tone ? (
                  <p
                    className={cn(
                      'text-[12px] leading-relaxed',
                      message.tone === 'error'
                        ? 'text-foreground dark:text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {message.content}
                  </p>
                ) : (
                  <ChatMarkdown content={message.content} streaming={false} />
                )}
              </ChatTurnBody>
            </div>
          ),
        )}

        {!isGenerating && pendingRequest && (
          <AssistantRequestCard key={pendingRequest.request.id} request={pendingRequest.request} busy={assistantBusy} onAnswer={answerRequest} />
        )}
        {!isGenerating && !pendingRequest && pendingDraft && (
          <DraftReviewCard
            diff={pendingDraft}
            busy={assistantBusy}
            onAccept={() => void acceptAssistantDraft()}
            onDiscard={() => void discardAssistantDraft()}
          />
        )}

        {isGenerating && (
          <div className="min-w-0">
            <RunSteps
              steps={liveSteps}
              live
              activities={activities}
              fallbackActivity="Thinking"
            />
            {pendingReview && (
              <PlanReviewCard
                key={pendingReview.requestId}
                review={pendingReview}
                onAnswered={() => setPendingReview(null)}
              />
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 bg-background p-3 backdrop-blur-sm">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept={ATTACHMENT_ACCEPT}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.currentTarget.value = ''
            if (files.length > 0) void addFiles(files)
          }}
        />
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => void handleGenerate()}
          canSubmit={canGenerate}
          // Stay editable during a run so the next message can be drafted; sending waits for the run.
          placeholder="Describe the workflow you want to build…"
          autoFocus
          onFilesDropped={(files) => void addFiles(files)}
          header={
            contextWorkflow || contextTabs.length > 0 || attachments.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5 pt-0.5">
                {contextWorkflow ? (
                  <ContextChip
                    icon={Target}
                    name={contextWorkflow.name || 'Untitled workflow'}
                    meta="context"
                    onRemove={() => setContextWorkflowId('')}
                  />
                ) : null}
                {contextTabs.map((page) => {
                  const count = listAgentNodes(page.diagram).length
                  return (
                    <ContextChip
                      key={page.id}
                      icon={Workflow}
                      name={page.name}
                      meta={`${count} agent${count === 1 ? '' : 's'}`}
                      onRemove={() => toggleContextTab(page.id)}
                    />
                  )
                })}
                {attachments.map((attachment) => (
                  <ContextChip
                    key={attachment.id}
                    icon={FileText}
                    name={attachment.name}
                    meta={formatFileSize(attachment.size)}
                    onRemove={() =>
                      setAttachments((previous) => previous.filter((item) => item.id !== attachment.id))
                    }
                  />
                ))}
              </div>
            ) : null
          }
          leading={
              <GenerateModelPicker
                value={model}
                onChange={onModelChange}
                serverModel={serverModel}
                serverConfigured={llmConfigured}
                ollamaBaseUrl={ollamaBaseUrl}
                disabled={isGenerating}
              />
          }
          action={
            isGenerating ? (
              <ComposerStopButton onClick={stopGenerating} />
            ) : (
              <ComposerSendButton onClick={() => void handleGenerate()} disabled={!canGenerate} label="Send message" />
            )
          }
          hint={
            assistantDraftId
              ? 'Working on a draft: review and accept its changes'
              : replacesCanvas
                ? 'Works on a draft of the open tab'
                : 'Drafts a new workflow'
          }
        />
      </div>
    </div>
  )
})
