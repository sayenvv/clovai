import { useState } from 'react'
import { Check, ClipboardList, MessageSquareText } from 'lucide-react'
import { ChatMarkdown } from '@/components/agent-workflow/ChatMarkdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { submitPlanReview, type PlanReview } from '@/services/workflow-run-api'

/**
 * The manager's plan, shown while the run waits for approval. Approve to let the agents
 * start, or describe what to change and the manager writes a new plan.
 */
export function PlanReviewCard({ review, onAnswered }: { review: PlanReview; onAnswered: () => void }) {
  const [feedback, setFeedback] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const answer = async (approved: boolean) => {
    setSending(true)
    setError('')
    try {
      await submitPlanReview(review, { approved, feedback: approved ? '' : feedback.trim() })
      onAnswered()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send your answer.')
      setSending(false)
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
        <ClipboardList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        {review.isStalled ? 'Revised plan — review before the agents continue' : 'Review the plan before the agents start'}
      </div>
      <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border/60 bg-background/70 p-2.5">
        <ChatMarkdown content={review.plan || '_The manager sent an empty plan._'} className="text-[12px] leading-5" />
      </div>
      <Textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder="What should change? (only needed to request changes)"
        className="mt-2 min-h-[64px] text-[12px]"
        disabled={sending}
      />
      {error && <p className="mt-1.5 text-[11.5px] text-destructive">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-[11.5px]"
          disabled={sending || !feedback.trim()}
          onClick={() => void answer(false)}
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          Request changes
        </Button>
        <Button size="sm" className="h-8 gap-1.5 text-[11.5px] font-semibold" disabled={sending} onClick={() => void answer(true)}>
          <Check className="h-3.5 w-3.5" />
          Approve plan
        </Button>
      </div>
    </div>
  )
}
