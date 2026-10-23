import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  ArrowUp,
  ChevronRight,
  ListChecks,
  Play,
  RotateCcw,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ChatComposer,
  ChatEmptyState,
  ChatTurnBody,
  ChatTurnHeader,
  ComposerSendButton,
  ComposerStopButton,
} from '@/components/agent-workflow/ChatComposer'
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
  /** Empty-state help; says where trace and logs appear on this page. */
  emptyHint?: string
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
  emptyHint = 'Send a message to run it. Replies appear here; trace, logs and errors are in the output panel under the canvas.',
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
          <ChatEmptyState
            icon={<Play className="h-4 w-4 fill-current text-foreground" />}
            title="Run this workflow"
            description={emptyHint}
          />
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
          <ChatTurnBody className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <TypingDots />
            Starting workflow
          </ChatTurnBody>
        )}

        {runStatus === 'failed' && errors.length > 0 && (
          <FailureNotice
            message={primaryExecutionError(errors.map((event) => event.message))}
            onShowDetails={onShowDetails}
          />
        )}

        {approvalPrompt && (
          <ReviewDecisionBar
            approvalPrompt={approvalPrompt}
            value={approvalInput}
            onChange={setApprovalInput}
            onApprove={(note) => onSubmitApproval?.(note)}
            onRequestChanges={onSubmitFeedback}
          />
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/60 bg-background p-3 backdrop-blur-sm">
        {/* While a review is pending the box stays in place, disabled; the decision is in the card above. */}
        <ChatComposer
          value={awaitingApproval ? '' : testInput}
          onChange={onTestInputChange}
          onSubmit={onExecute}
          canSubmit={!awaitingApproval && !isExecuting && canExecute && Boolean(testInput.trim())}
          disabled={isExecuting || awaitingApproval}
          leading={
            <ExecutionFileUploadButton
              variant="icon"
              disabled={isExecuting || awaitingApproval}
              onInputLoaded={onTestInputChange}
            />
          }
          placeholder={awaitingApproval ? 'Waiting for your review above…' : 'Message the workflow…'}
          action={
            isActive && onCancel ? (
              <ComposerStopButton onClick={onCancel} label="Stop" />
            ) : (
              <ComposerSendButton
                onClick={onExecute}
                disabled={!canExecute || isExecuting || !testInput.trim()}
                busy={isExecuting}
                label={canRerun ? 'Run again' : 'Run workflow'}
                icon={canRerun ? RotateCcw : ArrowUp}
                text={canRerun ? 'Run again' : undefined}
              />
            )
          }
          hint={
            awaitingApproval
              ? 'Approve or request changes to continue'
              : canRerun
                ? 'Sending runs the workflow again'
                : 'Sending runs the workflow'
          }
        />
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
    <div className="rounded-xl border border-foreground/30 bg-foreground/5 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-foreground dark:text-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground dark:text-foreground">{summary.title}</p>
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
  'bg-foreground/15 text-foreground dark:text-foreground',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-foreground/15 text-foreground dark:text-foreground',
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
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
        AVATAR_TONES[hash % AVATAR_TONES.length],
      )}
    >
      {initials || 'AI'}
    </span>
  )
}

export function UserMessage({ content, children }: { content: string; children?: ReactNode }) {
  const json = content.trimStart().startsWith('{')
  return (
    <div className="min-w-0">
      <ChatTurnHeader
        name="You"
        avatar={
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
            <User className="h-3.5 w-3.5" />
          </span>
        }
      />
      <ChatTurnBody>
        {children}
        <p
          className={cn(
            'whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-[13px] leading-6 text-foreground',
            json && 'font-mono text-[12px] leading-5',
          )}
        >
          {content.trim()}
        </p>
      </ChatTurnBody>
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
      {showHeader && <ChatTurnHeader avatar={<AgentAvatar name={message.agentName} />} name={message.agentName} />}
      <ChatTurnBody>
        {message.kind === 'reasoning' ? (
          <ReasoningBlock title={message.title} content={shown} typing={typing} />
        ) : shown ? (
          <ChatMarkdown content={shown} streaming={typing} />
        ) : (
          <span className="inline-flex animate-pulse items-center text-[12px] text-muted-foreground">Working…</span>
        )}
        {message.status === 'failed' && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-foreground dark:text-foreground">
            <XCircle className="h-3 w-3" />
            This step failed
          </p>
        )}
      </ChatTurnBody>
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
