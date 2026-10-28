import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { PlaygroundRequest } from '@/api/playground'
import { Button } from '@/components/ui/button'

/**
 * What a waiting 4.0 run asks in the Playground: an approval (approve / reject), the workflow assistant's
 * plan approval (build it, or say what to change), or any other question (a text answer).
 */
export function PlaygroundRequestCard({
  request,
  busy,
  onAnswer,
}: {
  request: PlaygroundRequest
  busy: boolean
  onAnswer: (answer: Record<string, unknown>) => void
}) {
  const [text, setText] = useState('')
  const isPlanApproval = request.kind === 'ask_user' && 'approve' in (request.payload.responseSchema?.properties ?? {})

  return (
    <div className="space-y-2 rounded-[2px] border border-border bg-muted/30 p-3 text-[12px]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {request.nodeName || 'The workflow'} is waiting {request.kind === 'approval' ? 'for approval' : 'for an answer'}
      </p>
      <p className="whitespace-pre-wrap text-foreground">{request.payload.message ?? request.payload.question}</p>
      {request.kind === 'approval' ? (
        <div className="flex gap-2">
          <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={() => onAnswer({ approved: true })}>
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={() => onAnswer({ approved: false })}>
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      ) : (
        <>
          <textarea
            rows={2}
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={busy}
            placeholder={isPlanApproval ? 'What should change? (empty to build it as planned)' : 'Your answer'}
            className="w-full resize-none rounded-[2px] border border-input bg-transparent px-2 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex gap-2">
            {isPlanApproval ? (
              <>
                <Button size="sm" className="h-7 text-[11.5px]" disabled={busy || text.trim().length > 0} onClick={() => onAnswer({ approve: true })}>
                  Build it
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11.5px]" disabled={busy || !text.trim()} onClick={() => onAnswer({ approve: false, changes: text.trim() })}>
                  Change the plan
                </Button>
              </>
            ) : (
              <Button size="sm" className="h-7 text-[11.5px]" disabled={busy || !text.trim()} onClick={() => onAnswer({ text: text.trim() })}>
                Send answer
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-[11.5px]" disabled={busy} onClick={() => onAnswer({ timeout: true })}>
              Time out
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
