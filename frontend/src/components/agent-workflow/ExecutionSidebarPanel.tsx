import { memo, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Play,
  Send,
  Square,
  User,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ExecutionFileUploadButton } from '@/components/agent-workflow/ExecutionFileUploadButton'
import { cn } from '@/utils/cn'
import type {
  ExecutionTraceStep,
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
  stepOutputs?: Record<string, string>
  trace?: ExecutionTraceStep[]
}

const STATUS_LABELS: Record<WorkflowRunStatus, string> = {
  idle: 'Ready',
  running: 'Running',
  'waiting-approval': 'Awaiting approval',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<WorkflowRunStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  running: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'waiting-approval': 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
}

export const ExecutionSidebarPanel = memo(function ExecutionSidebarPanel({
  testInput,
  onTestInputChange,
  onExecute,
  isExecuting = false,
  canExecute = true,
  runStatus,
  runId,
  onCancel,
  approvalPrompt,
  onSubmitApproval,
  stepOutputs = {},
  trace = [],
}: ExecutionSidebarPanelProps) {
  const [approvalInput, setApprovalInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isActive = runStatus === 'running' || runStatus === 'waiting-approval'
  const awaitingApproval = Boolean(approvalPrompt)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [trace.length, runStatus, approvalPrompt])

  const completedSteps = trace.filter(
    (step) => step.status === 'completed' || step.output || (step.nodeId && stepOutputs[step.nodeId]),
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {runStatus === 'idle' && trace.length === 0 && (
          <p className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
            Send a JSON payload below to run this workflow. Trace, logs, and errors appear in the
            output panel under the canvas.
          </p>
        )}

        {runStatus !== 'idle' && (
          <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {runStatus === 'running' && <Loader2 className="h-4 w-4 animate-spin text-violet-600" />}
              {runStatus === 'completed' && (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
              {runStatus === 'failed' && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
              {runStatus === 'waiting-approval' && (
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <Badge variant="outline" className={cn('h-5 border-0 px-2 text-[10px]', STATUS_STYLES[runStatus])}>
                {STATUS_LABELS[runStatus]}
              </Badge>
              {isActive && onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto h-7 gap-1 text-[10px]"
                  onClick={onCancel}
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  Stop
                </Button>
              )}
            </div>
            {runId && (
              <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{runId}</p>
            )}
          </div>
        )}

        {testInput.trim() && runStatus !== 'idle' && (
          <ChatBubble role="user" content={testInput} label="Workflow input" />
        )}

        {completedSteps.map((step) => {
          const output = step.output ?? (step.nodeId ? stepOutputs[step.nodeId] : undefined)
          if (!output) return null
          return (
            <ChatBubble
              key={step.id}
              role="assistant"
              content={output}
              label={step.agentName}
            />
          )
        })}

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
          <>
            <Textarea
              rows={2}
              value={approvalInput}
              onChange={(event) => setApprovalInput(event.target.value)}
              placeholder={`Approval note for ${approvalPrompt.role}…`}
              className="min-h-[80px] resize-none text-xs"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  if (!approvalInput.trim()) return
                  onSubmitApproval?.(approvalInput)
                  setApprovalInput('')
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-9 w-full gap-1.5 bg-amber-600 text-xs text-white hover:bg-amber-700"
              disabled={!approvalInput.trim()}
              onClick={() => {
                if (!approvalInput.trim()) return
                onSubmitApproval?.(approvalInput)
                setApprovalInput('')
              }}
            >
              <Send className="h-3.5 w-3.5" />
              Approve &amp; continue
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-[22px] border border-border/60 bg-background p-2.5 shadow-sm transition-colors focus-within:border-ring/40 focus-within:ring-2 focus-within:ring-ring/10 dark:border-zinc-700/70 dark:focus-within:border-zinc-600 dark:focus-within:ring-zinc-500/10">
              <Textarea
                rows={2}
                value={testInput}
                onChange={(event) => onTestInputChange(event.target.value)}
                disabled={isExecuting}
                placeholder="Ask for workflow changes"
                className="min-h-[52px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 dark:text-white dark:placeholder:text-zinc-500"
                spellCheck={false}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    if (!isExecuting && canExecute) onExecute()
                  }
                }}
              />
              <div className="flex items-center gap-1 pt-1">
                <ExecutionFileUploadButton
                  variant="icon"
                  disabled={isExecuting}
                  onInputLoaded={onTestInputChange}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canExecute || isExecuting}
                  onClick={onExecute}
                  className="ml-auto h-9 gap-1.5 px-4 text-xs shadow-md dark:bg-black dark:text-white dark:hover:bg-zinc-950"
                  aria-label={isExecuting ? 'Executing workflow' : 'Execute workflow'}
                  title={isExecuting ? 'Executing workflow' : 'Execute workflow'}
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to execute</p>
          </>
        )}
      </div>
    </div>
  )
})

function ChatBubble({
  role,
  content,
  label,
}: {
  role: 'user' | 'assistant'
  content: string
  label?: string
}) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          isUser ? 'bg-emerald-500/15 text-emerald-600' : 'bg-violet-500/15 text-violet-600',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </span>
      <div
        className={cn(
          'min-w-0 max-w-[90%] rounded-xl border px-3 py-2 text-xs leading-relaxed shadow-sm',
          isUser
            ? 'border-emerald-600/35 bg-emerald-50 text-foreground dark:border-emerald-500/20 dark:bg-emerald-500/5'
            : 'border-violet-600/35 bg-violet-50 text-foreground dark:border-violet-500/20 dark:bg-violet-500/5',
        )}
      >
        {label && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        )}
        <pre
          className={cn(
            'max-h-48 overflow-auto whitespace-pre-wrap',
            isUser && content.trimStart().startsWith('{') && 'font-mono text-[11px]',
          )}
        >
          {content}
        </pre>
      </div>
    </div>
  )
}
