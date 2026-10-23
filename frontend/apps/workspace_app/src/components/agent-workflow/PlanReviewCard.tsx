import { useState } from 'react'
import { Check, ClipboardList, MessageSquareText } from 'lucide-react'
import { ChatMarkdown } from '@/components/agent-workflow/ChatMarkdown'
import { ReviewCard, ReviewContent, ReviewFeedbackInput } from '@/components/agent-workflow/ReviewCard'
import { Button } from '@/components/ui/button'
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
    <ReviewCard
      className="mt-3"
      icon={ClipboardList}
      title={review.isStalled ? 'Revised plan' : 'Plan approval'}
      subtitle={
        review.isStalled
          ? 'The manager changed course. Review the new plan before the agents continue.'
          : 'Review the plan before the agents start.'
      }
      footer={
        <>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 bg-background text-[11.5px]"
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
        </>
      }
    >
      <ReviewContent>
        <ChatMarkdown content={review.plan || '_The manager sent an empty plan._'} className="text-[12px] leading-5" />
      </ReviewContent>
      <ReviewFeedbackInput
        value={feedback}
        onChange={setFeedback}
        placeholder="What should change? Only needed to request changes."
        disabled={sending}
        onSubmit={() => {
          if (!sending && feedback.trim()) void answer(false)
        }}
      />
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
    </ReviewCard>
  )
}
