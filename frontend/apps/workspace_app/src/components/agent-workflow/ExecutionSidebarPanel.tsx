import { memo, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ChevronRight,
  ListChecks,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatComposer } from '@/components/agent-workflow/ChatComposer'
import { ExecutionFileUploadButton } from '@/components/agent-workflow/ExecutionFileUploadButton'
import { ReviewDecisionBar } from '@/components/agent-workflow/ReviewDecisionBar'
import { cn } from '@/utils/cn'
import {
  primaryExecutionError,
  summarizeExecutionError,
} from '@/components/agent-workflow/execution-error-summary'
import { ChatMarkdown, useSmoothText } from '@/components/agent-workflow/ChatMarkdown'
import { TokenBudgetBar } from '@/components/agent-workflow/TokenBudgetBar'
import type {
  ExecutionTraceStep,
  WorkflowChatMessage,
  WorkflowExecutionEvent,
  WorkflowRunState,
  WorkflowRunStatus,
} from '@/types/agent-workflow'

interface ExecutionSidebarPanelProps {
  testInput: string
  onTestInputChange: (value: string) => void
  onExecute: () => void
  isExecuting?: boolean
  canExecute?: boolean
  runStatus: WorkflowRunStatus
  runId?: string | null
  onCancel?: () => void
  approvalPrompt?: WorkflowRunState['approvalPrompt']
  onSubmitApproval?: (value: string) => void
  onSubmitFeedback?: (value: string) => void
  stepOutputs?: Record<string, string>
  trace?: ExecutionTraceStep[]
  messages?: WorkflowChatMessage[]
  finalResponse?: string | null
  errors?: WorkflowExecutionEvent[]
  onShowDetails?: () => void
}

export const ExecutionSidebarPanel = memo(function ExecutionSidebarPanel({
  testInput,
  onTestInputChange,
  onExecute,
  isExecuting = false,
  canExecute = true,
  runStatus,
  onCancel,
  approvalPrompt,
  onSubmitApproval,
  onSubmitFeedback,
  trace = [],
  messages = [],
  finalResponse = null,
  errors = [],
  onShowDetails,
}: ExecutionSidebarPanelProps) {
  const [approvalInput, setApprovalInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isActive = runStatus === 'running' || runStatus === 'waiting-approval'
  const canRerun = runStatus === 'completed' || runStatus === 'failed' || runStatus === 'cancelled'
  const awaitingApproval = Boolean(approvalPrompt)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, runStatus, approvalPrompt, errors.length])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    let pinned = true
    const onScroll = () => {
      pinned = element.scrollHeight - element.scrollTop - element.clientHeight < 48
    }
    const observer = new MutationObserver(() => {
      if (pinned) element.scrollTop = element.scrollHeight
    })
    element.addEventListener('scroll', onScroll, { passive: true })
    observer.observe(element, { childList: true, subtree: true, characterData: true })
    return () => {
      element.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div ref={scrollRef} className="min-h-0 w-full min-w-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <TokenBudgetBar />

        {runStatus === 'idle' && trace.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
            Type a message below to run this workflow. The model reply appears here, and trace,
            logs, and errors stay in the output panel under the canvas.
          </p>
        )}

        {testInput.trim() && runStatus !== 'idle' && <UserMessage content={testInput} />}

        {messages.map((message, index) => {
          const previous = messages[index - 1]
          return (
            <AgentMessage
              key={message.id}
              message={message}
              showHeader={!previous || previous.nodeId !== message.nodeId}
              live={isActive}
            />
          )
        })}

        {messages.length === 0 && finalResponse && (
          <AgentMessage
            message={{
              id: 'final',
              nodeId: 'final',
              agentName: 'Assistant',
              content: finalResponse,
              kind: 'response',
              status: 'done',
            }}
            showHeader
            live={false}
          />
        )}

        {runStatus === 'running' && messages.length === 0 && (
          <div className="flex items-center gap-2 pl-0.5 text-[12px] text-muted-foreground">
            <TypingDots />
            Starting workflow
          </div>
        )}

        {runStatus === 'failed' && errors.length > 0 && (
          <FailureNotice
            message={primaryExecutionError(errors.map((event) => event.message))}
            onShowDetails={onShowDetails}
          />
        )}

        {approvalPrompt && (
          <div className="space-y-2">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                    Review before &ldquo;{approvalPrompt.nextAgentName}&rdquo;
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {approvalPrompt.message}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Reviewer: <span className="font-medium text-foreground">{approvalPrompt.role}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/60 bg-background p-3 backdrop-blur-sm">
        {awaitingApproval && approvalPrompt ? (
          <ReviewDecisionBar
            approvalPrompt={approvalPrompt}
            value={approvalInput}
            onChange={setApprovalInput}
            onApprove={(note) => onSubmitApproval?.(note)}
            onRequestChanges={onSubmitFeedback}
          />
        ) : (
          <ChatComposer
            value={testInput}
            onChange={onTestInputChange}
            onSubmit={onExecute}
            canSubmit={!isExecuting && canExecute}
            disabled={isExecuting}
            leading={
              <ExecutionFileUploadButton
                variant="icon"
                disabled={isExecuting}
                onInputLoaded={onTestInputChange}
              />
            }
            action={
              isActive && onCancel ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onCancel}
                  className="h-9 gap-1.5 px-4 text-xs shadow-md dark:bg-black dark:text-white dark:hover:bg-zinc-950"
                  aria-label="Stop workflow"
                  title="Stop workflow"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canExecute || isExecuting}
                  onClick={onExecute}
                  className="h-9 gap-1.5 px-4 text-xs shadow-md dark:bg-black dark:text-white dark:hover:bg-zinc-950"
                  aria-label={isExecuting ? 'Executing workflow' : canRerun ? 'Run again' : 'Execute workflow'}
                  title={isExecuting ? 'Executing workflow' : canRerun ? 'Run again' : 'Execute workflow'}
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : canRerun ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Run again
                    </>
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                </Button>
              )
            }
            hint={canRerun ? '⌘/Ctrl + Enter to run again' : '⌘/Ctrl + Enter to execute'}
          />
        )}
      </div>
    </div>
  )
})

function FailureNotice({
  message,
  onShowDetails,
}: {
  message: string
  onShowDetails?: () => void
}) {
  const summary = summarizeExecutionError(message)

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-red-900 dark:text-red-100">{summary.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{summary.summary}</p>
          {onShowDetails && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-[11px]"
              onClick={onShowDetails}
            >
              View logs
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Join a token-per-line model reply into one sentence. */
export function readableChatText(content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length < 3 || lines.some((line) => line.includes(' '))) return content.trim()
  return lines.reduce((sentence, line) => {
    if (!sentence) return line
    if (/^[,.'’!?;:%)\]}]/.test(line) || line.startsWith("'")) return sentence + line
    return `${sentence} ${line}`
  }, '')
}

export function TypingDots() {
  return (
    <span className="flex h-6 items-center gap-1" aria-label="Thinking">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}

const AVATAR_TONES = [
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
]

export function AgentAvatar({ name }: { name: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold',
        AVATAR_TONES[hash % AVATAR_TONES.length],
      )}
    >
      {initials || 'AI'}
    </span>
  )
}

export function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-[13px] leading-6 text-foreground">
        {content.trim()}
      </p>
    </div>
  )
}

export function AgentMessage({
  message,
  showHeader,
  live,
}: {
  message: WorkflowChatMessage
  showHeader: boolean
  live: boolean
}) {
  const text = readableChatText(message.content)
  const streaming = message.status === 'streaming'
  const shown = useSmoothText(text, streaming || live)
  const typing = streaming || shown.length < text.length

  return (
    <div className={cn('min-w-0', !showHeader && '-mt-2')}>
      {showHeader && (
        <div className="mb-1.5 flex min-w-0 items-center gap-2">
          <AgentAvatar name={message.agentName} />
          <span className="truncate text-[12.5px] font-semibold text-foreground">{message.agentName}</span>
        </div>
      )}
      <div className="min-w-0 pl-8">
        {message.kind === 'reasoning' ? (
          <ReasoningBlock title={message.title} content={shown} typing={typing} />
        ) : shown ? (
          <ChatMarkdown content={shown} streaming={typing} />
        ) : (
          <span className="inline-flex animate-pulse items-center text-[12px] text-muted-foreground">Working…</span>
        )}
        {message.status === 'failed' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            This step failed
          </p>
        )}
      </div>
    </div>
  )
}

const REASONING_ICONS: Record<string, typeof Sparkles> = {
  Plan: ListChecks,
  'Revised plan': ListChecks,
  'Progress check': Activity,
}

function preview(content: string): string {
  const line = content
    .split('\n')
    .map((part) => part.replace(/[#*_`>-]/g, '').trim())
    .find(Boolean)
  return line ?? ''
}

function ReasoningBlock({ title, content, typing }: { title?: string; content: string; typing: boolean }) {
  const [open, setOpen] = useState(typing)
  const touched = useRef(false)
  const startedAt = useRef(Date.now())
  const [seconds, setSeconds] = useState<number | null>(null)

  useEffect(() => {
    if (typing) return
    setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)))
    if (!touched.current) setOpen(false)
  }, [typing])

  const label = title ?? 'Reasoning'
  const Icon = REASONING_ICONS[label] ?? Sparkles
  const heading = typing
    ? label === 'Thinking'
      ? 'Thinking…'
      : `${label}…`
    : label === 'Thinking' && seconds
      ? `Thought for ${seconds}s`
      : label

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => {
          touched.current = true
          setOpen((value) => !value)
        }}
        className="group flex w-full min-w-0 items-center gap-1.5 rounded-md py-0.5 text-left text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        <Icon className={cn('h-3.5 w-3.5 shrink-0', typing && 'animate-pulse')} />
        <span className={cn('shrink-0 font-medium', typing && 'animate-pulse')}>{heading}</span>
        {!open && content && (
          <span className="min-w-0 truncate text-muted-foreground/70">· {preview(content)}</span>
        )}
        <ChevronRight
          className={cn('ml-auto h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')}
        />
      </button>
      {open && content && (
        <div className="mt-1.5 border-l-2 border-border/70 pl-3">
          <ChatMarkdown
            content={content}
            streaming={typing}
            className="text-[12px] leading-5 text-muted-foreground"
          />
        </div>
      )}
    </div>
  )
}
