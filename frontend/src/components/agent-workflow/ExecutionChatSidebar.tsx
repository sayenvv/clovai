import { memo, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Bot,
  ChevronRight,
  MessageSquare,
  PanelLeftClose,
  RotateCcw,
  Send,
  Settings2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import { cn } from '@/utils/cn'
import type { WorkflowRunState } from '@/types/agent-workflow'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

interface ExecutionChatSidebarProps {
  messages: ChatMessage[]
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  onReset: () => void
  isRunning: boolean
  runState: WorkflowRunState
  jsonMode: boolean
  onJsonModeChange: (value: boolean) => void
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
}

export const ExecutionChatSidebar = memo(function ExecutionChatSidebar({
  messages,
  draft,
  onDraftChange,
  onSend,
  onReset,
  isRunning,
  runState,
  jsonMode,
  onJsonModeChange,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
}: ExecutionChatSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, runState.status])

  if (collapsed) {
    return (
      <aside
        className="relative flex h-full shrink-0 flex-col border-r border-border/60 bg-background"
        style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
      >
        <div className="flex flex-col items-center gap-2 border-b border-border/60 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleCollapse}
            aria-label="Expand chat panel"
            title="Expand chat"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
            Chat
          </span>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r border-border/60 bg-background"
      style={{ width }}
    >
      <DesignerResizeHandle
        side="right"
        onPointerDown={onResizePointerDown}
        ariaLabel="Resize chat panel"
      />

      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Chat</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onToggleCollapse}
          aria-label="Collapse chat panel"
          title="Collapse panel"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 h-8 w-auto shrink-0 justify-start gap-0.5 bg-muted/60 p-0.5">
          <TabsTrigger value="chat" className="h-7 flex-1 gap-1 px-2 text-[11px]">
            <MessageSquare className="h-3 w-3" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="options" className="h-7 flex-1 gap-1 px-2 text-[11px]">
            <Settings2 className="h-3 w-3" />
            Options
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-xs text-muted-foreground">
                Send a message or payload to run the workflow. Execution updates will appear here.
              </p>
            ) : (
              messages.map((message) => <ChatBubble key={message.id} message={message} />)
            )}
            {runState.approvalPrompt && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                Waiting for {runState.approvalPrompt.role} approval before{' '}
                {runState.approvalPrompt.nextAgentName}. Use the inspector panel to approve.
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-2 border-t border-border/60 p-3">
            <Textarea
              rows={3}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={
                jsonMode
                  ? '{\n  "query": "Your request…"\n}'
                  : 'Ask the workflow to run a task…'
              }
              className={cn('text-xs', jsonMode && 'font-mono')}
              disabled={isRunning}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  onSend()
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                size="sm"
                onClick={onSend}
                disabled={isRunning || !draft.trim()}
              >
                <Send className="h-3.5 w-3.5" />
                {isRunning ? 'Running…' : 'Send & execute'}
              </Button>
              {!isRunning && runState.status !== 'idle' && (
                <Button variant="outline" size="sm" onClick={onReset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter to send</p>
          </div>
        </TabsContent>

        <TabsContent value="options" className="mt-0 space-y-4 overflow-y-auto px-3 py-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
            <input
              type="checkbox"
              checked={jsonMode}
              onChange={(event) => onJsonModeChange(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-xs font-medium text-foreground">JSON payload mode</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Send structured JSON as workflow input instead of plain text.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/60 p-3 opacity-60">
            <input type="checkbox" disabled className="mt-0.5" />
            <span>
              <span className="block text-xs font-medium text-foreground">Stream step updates</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Post each agent step to chat as it runs (coming soon).
              </span>
            </span>
          </label>
        </TabsContent>
      </Tabs>
    </aside>
  )
})

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-emerald-500/15 text-emerald-600'
            : isSystem
              ? 'bg-muted text-muted-foreground'
              : 'bg-red-500/15 text-red-600',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </span>
      <div
        className={cn(
          'max-w-[90%] rounded-xl border px-3 py-2 text-xs leading-relaxed shadow-sm',
          isUser
            ? 'border-emerald-600/35 bg-emerald-50 text-foreground dark:border-emerald-500/20 dark:bg-emerald-500/5'
            : isSystem
              ? 'border-border/60 bg-muted/60 text-muted-foreground dark:border-border/60 dark:bg-muted/30'
              : 'border-red-600/35 bg-red-50 text-foreground dark:border-red-500/20 dark:bg-red-500/5',
        )}
      >
        <pre className={cn('whitespace-pre-wrap font-sans', isUser && message.content.startsWith('{') && 'font-mono text-[11px]')}>
          {message.content}
        </pre>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}
