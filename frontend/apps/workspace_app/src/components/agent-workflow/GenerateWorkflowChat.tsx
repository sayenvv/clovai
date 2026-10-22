import { memo, useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, ChevronRight, FileText, Paperclip, Square, Workflow, X, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ChatComposer } from '@/components/agent-workflow/ChatComposer'
import { ChatMarkdown } from '@/components/agent-workflow/ChatMarkdown'
import {
  readableChatText,
  UserMessage,
} from '@/components/agent-workflow/ExecutionSidebarPanel'
import { applyChatMessage } from '@/components/agent-workflow/use-workflow-runner'
import { TokenBudgetBar } from '@/components/agent-workflow/TokenBudgetBar'
import { PetalLoader, PetalMark } from '@/components/shared/PetalLoader'
import type { ExecutionLogEvent } from '@/services/orchestration-api'
import { PlanReviewCard } from '@/components/agent-workflow/PlanReviewCard'
import type { PlanReview } from '@/services/workflow-run-api'
import type { WorkflowChatMessage } from '@/types/agent-workflow'
import { GenerateModelPicker } from '@/components/agent-workflow/GenerateModelPicker'
import {
  generateWorkflowFromPrompt,
  type GenerateWorkflowAttachment,
  type GenerateWorkflowModel,
} from '@/services/generate-workflow-api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { describeWorkflowTab } from '@/components/agent-workflow/workflow-tab-context'
import type { CanvasPlan } from '@/components/agent-workflow/workflow-plan-from-diagram'
import { listAgentNodes } from '@/components/agent-workflow/tool-agent-mapping'
import type { DiagramPage } from '@/components/designer/diagram-types'
import { cn } from '@/utils/cn'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'

const ASSISTANT_NAME = 'ElevenNodes AI'
const MAX_ATTACHMENTS = 5
const MAX_CONTEXT_TABS = 3
/** Matches the API's per-file limit. */
const MAX_ATTACHMENT_CHARS = 200_000
/** Earlier turns sent with each request, so follow-ups like "make it shorter" have context. */
const MAX_HISTORY_MESSAGES = 10
/** Matches the API's per-message limit. */
const MAX_HISTORY_CHARS = 20_000
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
  context?: Array<{ kind: 'file' | 'tab'; name: string }>
  tone?: 'error' | 'muted'
  /** Assistant replies: each agent's turns from the run, shown above the reply. */
  steps?: WorkflowChatMessage[]
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

function planSummary(
  plan: WorkflowGenerationPlan,
  meta: { model: string; summary?: string; tokens?: number },
): string {
  const count = plan.agents.length
  const reviews = plan.edges.filter((edge) => edge.humanApproval).length
  // What was done is the assistant's own summary; the UI only states what is on the canvas.
  const lines: string[] = []
  const note = meta.summary?.trim() || plan.description.trim()
  if (note) lines.push(note, '')
  lines.push(`**${plan.workflowName}** is on the canvas with ${count} agent${count === 1 ? '' : 's'}.`)
  lines.push(
    '',
    ...plan.agents.map(
      (agent, index) =>
        `${index + 1}. **${agent.name}**${agent.description ? ` — ${agent.description}` : ''}`,
    ),
  )
  if (reviews > 0) lines.push('', `Includes ${reviews} human review step${reviews === 1 ? '' : 's'}.`)
  const used = meta.tokens ? ` · ${formatTokens(meta.tokens)} tokens` : ''
  lines.push('', `_Generated with ${meta.model}${used}._`)
  return lines.join('\n')
}

/** Fold one streamed row into the run's turns, keyed by agent like the execute chat. */
function applyAgentRow(steps: WorkflowChatMessage[], event: ExecutionLogEvent): WorkflowChatMessage[] {
  const agentName = event.agent?.trim() || 'Agent'
  return applyChatMessage(steps, event.agentId || agentName, agentName, event)
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
  tokens = 0,
}: {
  steps: WorkflowChatMessage[]
  live: boolean
  activities?: Record<string, string>
  fallbackActivity?: string
  tokens?: number
}) {
  const running = (step: WorkflowChatMessage) => live && step.status === 'streaming'
  const shown = steps.filter((step) => !(running(step) && step.nodeId.endsWith(':thinking')))
  const items: TimelineItem[] = shown.map((step) =>
    running(step) && !step.content.trim()
      ? { key: step.id, state: 'running', title: activities[step.nodeId] || fallbackActivity, content: '' }
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
    <ol className="pl-1">
      {items.map((item, index) => (
        <TimelineStep key={item.key} item={item} last={index === items.length - 1} tokens={tokens} />
      ))}
    </ol>
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

function TimelineStep({ item, last, tokens }: { item: TimelineItem; last: boolean; tokens: number }) {
  const [open, setOpen] = useState(false)
  const expandable = item.state !== 'running' && Boolean(item.content)

  return (
    <li className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-x-3">
      {/* Marker column: the marker, then the rail down to the next item's marker. */}
      <div className="relative flex justify-center">
        <span className="flex h-5 items-center">
          {item.state === 'running' ? (
            <PetalLoader size={14} label={item.title} />
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
            {tokens > 0 ? (
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatTokens(tokens)} tokens</span>
            ) : null}
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

function AssistantHeader() {
  return (
    <div className="mb-1.5 flex min-w-0 items-center gap-2">
      <PetalMark size={20} />
      <span className="truncate text-[12.5px] font-semibold text-foreground">{ASSISTANT_NAME}</span>
    </div>
  )
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

/** Earlier turns for the API, oldest first. Errors and "Stopped." notes are left out. */
function chatHistory(messages: GenerateChatMessage[]) {
  return messages
    .filter((message) => !message.tone && message.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content.slice(0, MAX_HISTORY_CHARS) }))
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
  getCurrentWorkflow,
  onGenerated,
}: GenerateWorkflowChatProps) {
  const [draft, setDraft] = useState('')
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [contextTabIds, setContextTabIds] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  /** Each agent's turns for the request in flight, streamed as they arrive. */
  const [liveSteps, setLiveSteps] = useState<WorkflowChatMessage[]>([])
  // The manager's plan the running workflow is waiting on, if any.
  const [pendingReview, setPendingReview] = useState<PlanReview | null>(null)
  const liveStepsRef = useRef<WorkflowChatMessage[]>([])
  /** Tokens the request in flight has used so far. */
  const [runTokens, setRunTokens] = useState(0)
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

  const handleGenerate = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? draft).trim()
    if (!prompt || isGenerating) return

    // The open tab is the workflow being edited; other tabs travel as reference context.
    const base = getCurrentWorkflow?.() ?? null
    const history = chatHistory(messages)
    const sentFiles = attachments
    // Describe tabs at send time so the model sees their latest state.
    const sentTabs = contextTabs.filter((page) => !base || page.id !== activePageId).map((page) => ({
      name: `Workflow tab: ${page.name}`,
      content: describeWorkflowTab(page),
      label: page.name,
    }))
    const context = [
      ...sentTabs.map((tab) => ({ kind: 'tab' as const, name: tab.label })),
      ...sentFiles.map((file) => ({ kind: 'file' as const, name: file.name })),
    ]
    onMessagesChange((previous) => [
      ...previous,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: prompt,
        ...(context.length > 0 ? { context } : {}),
      },
    ])
    setDraft('')
    setAttachments([])
    setContextTabIds([])
    setIsGenerating(true)
    liveStepsRef.current = []
    setLiveSteps([])
    setRunTokens(0)
    setActivities({})
    const onAgentEvent = (event: ExecutionLogEvent) => {
      const stage = event.agentId
      if (event.activity && stage) setActivities((previous) => (previous[stage] === event.activity ? previous : { ...previous, [stage]: event.activity! }))
      liveStepsRef.current = applyAgentRow(liveStepsRef.current, event)
      setLiveSteps(liveStepsRef.current)
    }

    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await generateWorkflowFromPrompt({
        prompt,
        model,
        ...(base ? { workflow: base.plan } : {}),
        history,
        attachments: [
          ...sentTabs.map(({ name, content }) => ({ name, content })),
          ...sentFiles.map(({ name, content }) => ({ name, content })),
        ],
        onAgentEvent,
        onPlanReview: setPendingReview,
        onUsage: setRunTokens,
        signal: controller.signal,
      })
      const plan = result.plan
      // Merge into the open canvas (keeping agent settings) only when the backend says it updated it.
      if (plan) onGenerated(plan, result.mode === 'update' ? base : null)
      onMessagesChange((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: plan
            ? planSummary(plan, {
                model: result.model,
                summary: result.summary,
                tokens: result.tokens,
              })
            : `${result.reply ?? ''}${result.tokens ? `\n\n_${formatTokens(result.tokens)} tokens._` : ''}`,
          steps: finishSteps(liveStepsRef.current),
        },
      ])
    } catch (error) {
      const stopped = controller.signal.aborted
      onMessagesChange((previous) => [
        ...previous,
        stopped
          ? {
              id: `assistant-stopped-${Date.now()}`,
              role: 'assistant',
              content: 'Stopped.',
              tone: 'muted',
              steps: finishSteps(liveStepsRef.current),
            }
          : {
              id: `assistant-error-${Date.now()}`,
              role: 'assistant',
              content: `The workflow assistant couldn't finish. ${error instanceof Error ? error.message : ''}`.trim(),
              tone: 'error',
              steps: finishSteps(liveStepsRef.current),
            },
      ])
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsGenerating(false)
      setPendingReview(null)
      liveStepsRef.current = []
      setLiveSteps([])
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div ref={scrollRef} className="min-h-0 w-full min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <TokenBudgetBar />
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
              Describe the automation below. Agents, connectors, and instructions are drafted onto
              the canvas so you can edit them. When the canvas already has agents, describe a change
              and it is applied to them. Use the workflow button to include other tabs, or the paperclip to attach files.
            </p>
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">Try an example</p>
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void handleGenerate(example)}
                  className={cn(
                    'w-full rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 text-left text-[11px] leading-snug text-muted-foreground',
                    'transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) =>
          message.role === 'user' ? (
            <div key={message.id} className="space-y-1.5">
              {message.context?.length ? (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {message.context.map((item) => (
                    <ContextChip
                      key={`${item.kind}-${item.name}`}
                      icon={item.kind === 'tab' ? Workflow : FileText}
                      name={item.name}
                    />
                  ))}
                </div>
              ) : null}
              <UserMessage content={message.content} />
            </div>
          ) : (
            <div key={message.id} className="min-w-0">
              {messages[index - 1]?.role !== 'assistant' && <AssistantHeader />}
              {message.steps?.length ? (
                <div className="mb-2">
                  <RunSteps steps={message.steps} live={false} />
                </div>
              ) : null}
              <div className="min-w-0 pl-8">
                {message.tone ? (
                  <p
                    className={cn(
                      'text-[12px] leading-relaxed',
                      message.tone === 'error'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    {message.content}
                  </p>
                ) : (
                  <ChatMarkdown content={message.content} streaming={false} />
                )}
              </div>
            </div>
          ),
        )}

        {isGenerating && (
          <div className="min-w-0">
            <RunSteps
              steps={liveSteps}
              live
              activities={activities}
              fallbackActivity="Thinking"
              tokens={runTokens}
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

      <div className="shrink-0 space-y-2 border-t border-border/60 bg-background p-3 backdrop-blur-sm">
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
            contextTabs.length > 0 || attachments.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5 pt-0.5">
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
            <>
              <button
                type="button"
                disabled={isGenerating || attachments.length >= MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors',
                  'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-50',
                )}
                aria-label="Attach files"
                title={
                  attachments.length >= MAX_ATTACHMENTS
                    ? `Up to ${MAX_ATTACHMENTS} files`
                    : 'Attach files (text, Markdown, JSON, CSV, XML, YAML)'
                }
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={isGenerating}>
                  <button
                    type="button"
                    className={cn(
                      'relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors',
                      'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-muted data-[state=open]:text-foreground',
                    )}
                    aria-label="Add workflow tabs as context"
                    title="Add workflow tabs as context"
                  >
                    <Workflow className="h-4 w-4" />
                    {contextTabs.length > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-0.5 text-[9px] font-semibold tabular-nums text-background">
                        {contextTabs.length}
                      </span>
                    ) : null}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-64">
                  <DropdownMenuLabel className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    Workflow tabs
                    <span className="font-normal tabular-nums">
                      {contextTabs.length}/{MAX_CONTEXT_TABS}
                    </span>
                  </DropdownMenuLabel>
                  <div className="max-h-56 overflow-y-auto">
                    {pages.map((page) => {
                      const selected = contextTabIds.includes(page.id)
                      const count = listAgentNodes(page.diagram).length
                      return (
                        <DropdownMenuItem
                          key={page.id}
                          disabled={!selected && contextTabs.length >= MAX_CONTEXT_TABS}
                          // Keep the menu open so several tabs can be picked.
                          onSelect={(event) => {
                            event.preventDefault()
                            toggleContextTab(page.id)
                          }}
                          className="items-start py-1.5"
                        >
                          <Workflow className="mt-0.5" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] text-foreground">{page.name}</span>
                              {page.id === activePageId ? (
                                <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                                  Current
                                </span>
                              ) : null}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {page.kind === 'sub' ? 'Sub-workflow' : 'Workflow'} · {count} agent
                              {count === 1 ? '' : 's'}
                            </span>
                          </span>
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center pt-0.5">
                            {selected ? <Check className="h-3.5 w-3.5 !text-foreground" /> : null}
                          </span>
                        </DropdownMenuItem>
                      )
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <GenerateModelPicker
                value={model}
                onChange={onModelChange}
                serverModel={serverModel}
                serverConfigured={llmConfigured}
                ollamaBaseUrl={ollamaBaseUrl}
                disabled={isGenerating}
              />
            </>
          }
          action={
            isGenerating ? (
              <button
                type="button"
                onClick={stopGenerating}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Stop"
                title="Stop"
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!canGenerate}
                onClick={() => void handleGenerate()}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  canGenerate
                    ? 'bg-foreground text-background hover:bg-foreground/85'
                    : 'cursor-not-allowed bg-muted text-muted-foreground shadow-none',
                )}
                aria-label="Send message"
                title={canGenerate ? 'Send' : 'Type a message'}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
              </button>
            )
          }
          hint={
            replacesCanvas
              ? '⌘/Ctrl + Enter to send · changes apply to the current canvas'
              : '⌘/Ctrl + Enter to send'
          }
        />
      </div>
    </div>
  )
})
