import { memo, useEffect, useRef, useState } from 'react'
import {
  Bot,
  Check,
  Loader2,
  MessageSquarePlus,
  PanelRightClose,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { generateFlowchartFromPrompt } from '@/services/generate-flowchart-api'
import { cn } from '@/utils/cn'
import type { FlowchartGenerationPlan } from '@/types/flowchart-generation'

const EXAMPLE_PROMPTS = [
  'User signup flow with email verification and error handling',
  'Order checkout: cart → payment → inventory → confirmation',
  'AWS API Gateway to Lambda to DynamoDB with SNS failure alerts',
]

export interface FlowchartChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Pending draft attached to an assistant message — accept to render on canvas. */
  draft?: FlowchartGenerationPlan
  draftMeta?: { model: string; origin: string }
  draftStatus?: 'pending' | 'accepted' | 'discarded'
}

interface GenerateFlowchartChatProps {
  onClose: () => void
  diagramName?: string
  llmConfigured?: boolean
  onAcceptDraft: (plan: FlowchartGenerationPlan) => void
}

function DraftCard({
  plan,
  meta,
  status,
  onAccept,
  onDiscard,
}: {
  plan: FlowchartGenerationPlan
  meta?: { model: string; origin: string }
  status: 'pending' | 'accepted' | 'discarded'
  onAccept: () => void
  onDiscard: () => void
}) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-violet-500/25 bg-background/80">
      <div className="border-b border-violet-500/15 bg-violet-500/[0.06] px-2.5 py-1.5">
        <p className="text-[11px] font-semibold text-foreground">{plan.title}</p>
        <p className="text-[10px] text-muted-foreground">
          Draft · {plan.nodes.length} shapes · {plan.edges.length} connectors
          {meta?.origin === 'template' ? ' · template' : meta?.model ? ` · ${meta.model}` : ''}
        </p>
      </div>
      <ul className="max-h-36 space-y-1 overflow-y-auto px-2.5 py-2">
        {plan.nodes.map((node, index) => (
          <li key={node.key} className="flex items-start gap-1.5 text-[11px] leading-snug">
            <span className="mt-0.5 w-4 shrink-0 tabular-nums text-muted-foreground">{index + 1}.</span>
            <span className="min-w-0">
              <span className="font-medium text-foreground">{node.label}</span>
              <span className="text-muted-foreground"> · {node.paletteId.replace(/^fc-/, '')}</span>
            </span>
          </li>
        ))}
      </ul>
      {plan.edges.some((edge) => edge.label) && (
        <div className="border-t border-border/60 px-2.5 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Connectors</p>
          <ul className="mt-1 space-y-0.5">
            {plan.edges
              .filter((edge) => edge.label)
              .slice(0, 6)
              .map((edge) => (
                <li key={`${edge.fromKey}-${edge.toKey}-${edge.label}`} className="text-[10px] text-muted-foreground">
                  {edge.fromKey} → {edge.toKey}
                  {edge.label ? `: “${edge.label}”` : ''}
                </li>
              ))}
          </ul>
        </div>
      )}
      {status === 'pending' ? (
        <div className="flex gap-1.5 border-t border-border/60 p-2">
          <Button
            type="button"
            size="sm"
            className="h-7 flex-1 gap-1 bg-violet-600 text-[11px] text-white hover:bg-violet-500"
            onClick={onAccept}
          >
            <Check className="h-3 w-3" />
            Accept to canvas
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={onDiscard}
          >
            <Trash2 className="h-3 w-3" />
            Discard
          </Button>
        </div>
      ) : (
        <div className="border-t border-border/60 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          {status === 'accepted' ? 'Accepted — rendered on the canvas.' : 'Discarded.'}
        </div>
      )}
    </div>
  )
}

export const GenerateFlowchartChat = memo(function GenerateFlowchartChat({
  onClose,
  diagramName = '',
  llmConfigured = false,
  onAcceptDraft,
}: GenerateFlowchartChatProps) {
  const [messages, setMessages] = useState<FlowchartChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi — I’m Eleven Nodes AI. Describe the flowchart you want. I’ll show a draft here first; accept it when you’re happy and I’ll place it on the canvas.',
    },
  ])
  const [input, setInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, isGenerating])

  const canSend = input.trim().length >= 4 && !isGenerating

  const handleSend = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? input).trim()
    if (prompt.length < 4 || isGenerating) return

    const userMessage: FlowchartChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
    }
    const history = messages
      .filter((message) => message.id !== 'welcome')
      .flatMap((message) => {
        if (message.role === 'user') return [{ role: 'user' as const, content: message.content }]
        if (message.draft) {
          return [
            {
              role: 'assistant' as const,
              content: `${message.content}\n\nDraft title: ${message.draft.title}\nNodes: ${message.draft.nodes.map((node) => node.label).join(', ')}`,
            },
          ]
        }
        return [{ role: 'assistant' as const, content: message.content }]
      })

    setMessages((previous) => [...previous, userMessage])
    setInput('')
    setIsGenerating(true)

    try {
      const result = await generateFlowchartFromPrompt({
        prompt,
        diagramName: diagramName || undefined,
        history,
      })
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
          draft: result.plan,
          draftMeta: { model: result.model, origin: result.origin },
          draftStatus: 'pending',
        },
      ])
      if (result.origin === 'template') {
        toast.message('Draft ready (template) — review and accept to place on canvas')
      } else {
        toast.message('Draft ready — review and accept to place on canvas')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate flowchart'
      toast.error(message)
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: `I couldn’t generate that flowchart. ${message}`,
        },
      ])
    } finally {
      setIsGenerating(false)
    }
  }

  const updateDraftStatus = (messageId: string, status: 'accepted' | 'discarded') => {
    setMessages((previous) =>
      previous.map((message) =>
        message.id === messageId ? { ...message, draftStatus: status } : message,
      ),
    )
  }

  return (
    <aside className="relative flex h-full w-[22rem] shrink-0 flex-col border-l bg-background">
      <div className="relative border-b border-violet-500/15 bg-gradient-to-br from-violet-500/[0.1] via-fuchsia-500/[0.04] to-background px-3 py-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/25">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight">Eleven Nodes AI</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {llmConfigured
                ? 'Chat to draft a flowchart — accept to render'
                : 'Template fallback · accept drafts to render'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label="Close AI chat"
            title="Close"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {message.role === 'assistant' && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[92%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed',
                message.role === 'user'
                  ? 'rounded-br-md bg-violet-600 text-white'
                  : 'rounded-bl-md border bg-muted/30 text-foreground',
              )}
            >
              {message.content}
              {message.draft && message.draftStatus && (
                <DraftCard
                  plan={message.draft}
                  meta={message.draftMeta}
                  status={message.draftStatus}
                  onAccept={() => {
                    onAcceptDraft(message.draft!)
                    updateDraftStatus(message.id, 'accepted')
                    toast.success('Flowchart placed on the canvas')
                  }}
                  onDiscard={() => {
                    updateDraftStatus(message.id, 'discarded')
                    toast.message('Draft discarded')
                  }}
                />
              )}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
            Generating draft…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-3 py-2">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-violet-500/20 bg-violet-500/[0.06] px-2.5 py-1 text-left text-[10px] leading-snug text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-foreground"
              onClick={() => void handleSend(example)}
              disabled={isGenerating}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-1.5 rounded-xl border border-violet-500/20 bg-background p-1.5 focus-within:border-violet-500/40">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe a flowchart…"
            rows={3}
            className="min-h-[3.5rem] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-[12px] shadow-none focus-visible:ring-0"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSend()
              }
            }}
            disabled={isGenerating}
          />
          <Button
            type="button"
            size="icon"
            className="h-8 w-8 shrink-0 bg-violet-600 text-white hover:bg-violet-500"
            disabled={!canSend}
            onClick={() => void handleSend()}
            aria-label="Send message"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="mt-1.5 flex items-center gap-1 px-0.5 text-[10px] text-muted-foreground">
          <MessageSquarePlus className="h-3 w-3" />
          Drafts stay in chat until you accept them
        </p>
      </div>
    </aside>
  )
})
