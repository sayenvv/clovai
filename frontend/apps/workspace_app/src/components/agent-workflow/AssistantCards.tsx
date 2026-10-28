import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AssistantRequest, DraftDiff } from '@/services/workflow-assistant-api'

/**
 * Cards the 4.0 workflow assistant shows in the chat: what a waiting run asks the user (a plan to approve,
 * a question, a confirmation), and the draft's changes to accept onto the canvas or discard.
 */

const CARD = 'mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3 text-[12px]'

export function AssistantRequestCard({
  request,
  busy,
  onAnswer,
}: {
  request: AssistantRequest
  busy: boolean
  onAnswer: (response: Record<string, unknown>) => void
}) {
  const [text, setText] = useState('')
  const fields = request.payload.responseSchema?.properties ?? {}
  // A question whose answer is "approve, or say what to change" (the assistant's plan approval)
  const isPlanApproval = request.kind === 'ask_user' && 'approve' in fields

  if (request.kind === 'approval') {
    return (
      <div className={CARD}>
        <p className="font-medium text-foreground">Confirm</p>
        <p className="whitespace-pre-wrap text-muted-foreground">{request.payload.message}</p>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={() => onAnswer({ approved: true })}>
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={() => onAnswer({ approved: false })}>
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="whitespace-pre-wrap text-foreground">{request.payload.question}</p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        placeholder={isPlanApproval ? 'What should change? (leave empty to build it as planned)' : 'Your answer'}
        className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-[12px] outline-none focus:border-foreground/30"
        disabled={busy}
      />
      <div className="flex gap-2">
        {isPlanApproval ? (
          <>
            <Button size="sm" className="h-7 text-[11.5px]" disabled={busy || text.trim().length > 0} onClick={() => onAnswer({ approve: true })}>
              Build it
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11.5px]"
              disabled={busy || !text.trim()}
              onClick={() => onAnswer({ approve: false, changes: text.trim() })}
            >
              Change the plan
            </Button>
          </>
        ) : (
          <Button size="sm" className="h-7 text-[11.5px]" disabled={busy || !text.trim()} onClick={() => onAnswer({ text: text.trim() })}>
            Send answer
          </Button>
        )}
      </div>
    </div>
  )
}

function count(part: { added: string[]; removed: string[]; changed: unknown[] } | undefined, noun: string): string | null {
  if (!part) return null
  const bits = [
    part.added.length ? `${part.added.length} added` : '',
    part.removed.length ? `${part.removed.length} removed` : '',
    part.changed.length ? `${part.changed.length} changed` : '',
  ].filter(Boolean)
  return bits.length ? `${noun}: ${bits.join(', ')}` : null
}

export function draftHasChanges(diff: DraftDiff): boolean {
  const parts = Object.values(diff).filter((value): value is { added: string[]; removed: string[]; changed: unknown[] } =>
    Boolean(value && typeof value === 'object' && 'added' in value),
  )
  return parts.some((part) => part.added.length || part.removed.length || part.changed.length) || diff.sections.length > 0
}

export function DraftReviewCard({
  diff,
  busy,
  onAccept,
  onDiscard,
}: {
  diff: DraftDiff
  busy: boolean
  onAccept: () => void
  onDiscard: () => void
}) {
  const lines = [
    count(diff.nodes, 'Steps'),
    count(diff.edges, 'Connections'),
    count(diff.agents as DraftDiff['nodes'] | undefined, 'Agents'),
    count(diff.tools as DraftDiff['nodes'] | undefined, 'Tools'),
    diff.sections.length ? `Settings: ${diff.sections.join(', ')}` : null,
  ].filter(Boolean)
  return (
    <div className={CARD}>
      <p className="font-medium text-foreground">Changes ready to review</p>
      <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={onAccept}>
          <Check className="h-3.5 w-3.5" /> Accept onto canvas
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={onDiscard}>
          <X className="h-3.5 w-3.5" /> Discard
        </Button>
      </div>
    </div>
  )
}
