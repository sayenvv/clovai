import { Check, RotateCcw, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReviewCard, ReviewFeedbackInput } from '@/components/agent-workflow/ReviewCard'
import type { WorkflowRunState } from '@/types/agent-workflow'

interface ReviewDecisionBarProps {
  approvalPrompt: NonNullable<WorkflowRunState['approvalPrompt']>
  value: string
  onChange: (value: string) => void
  onApprove: (note: string) => void
  onRequestChanges?: (feedback: string) => void
}

/** A human-in-the-loop handoff in the run chat: approve (with an optional note) or send feedback. */
export function ReviewDecisionBar({
  approvalPrompt,
  value,
  onChange,
  onApprove,
  onRequestChanges,
}: ReviewDecisionBarProps) {
  const agentName = approvalPrompt.agentName ?? 'the agent'
  const allowFeedback = Boolean(approvalPrompt.feedbackRevisionsEnabled && onRequestChanges)
  const revisionCount = approvalPrompt.revisionCount ?? 0
  const maxRevisions = approvalPrompt.maxFeedbackRevisions ?? 5
  const revisionsLeft = Math.max(0, maxRevisions - revisionCount)
  const canRequestChanges = allowFeedback && value.trim().length > 0 && revisionsLeft > 0

  const approve = () => {
    onApprove(value)
    onChange('')
  }

  return (
    <ReviewCard
      icon={UserCheck}
      title={`Review before ${approvalPrompt.nextAgentName}`}
      subtitle={
        <>
          {approvalPrompt.message}
          <span className="mt-1 block text-[10.5px]">
            Reviewer · <span className="font-medium text-foreground">{approvalPrompt.role}</span>
          </span>
        </>
      }
      footer={
        <>
          {allowFeedback ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-background text-[11.5px]"
              disabled={!canRequestChanges}
              title={`Send feedback and re-run ${agentName}`}
              onClick={() => {
                if (!canRequestChanges) return
                onRequestChanges?.(value)
                onChange('')
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Request changes
            </Button>
          ) : null}
          <Button type="button" size="sm" className="h-8 gap-1.5 text-[11.5px] font-semibold" onClick={approve}>
            <Check className="h-3.5 w-3.5" />
            Approve &amp; continue
          </Button>
        </>
      }
    >
      <ReviewFeedbackInput
        value={value}
        onChange={onChange}
        placeholder={
          allowFeedback
            ? `Add a note to approve, or describe changes for ${agentName}…`
            : `Approval note for ${approvalPrompt.role}…`
        }
        onSubmit={approve}
      />
      <p className="text-[10.5px] text-muted-foreground">
        {allowFeedback
          ? revisionsLeft > 0
            ? `Request changes re-runs ${agentName} · ${revisionsLeft} revision${revisionsLeft === 1 ? '' : 's'} left`
            : 'Revision limit reached. Approve to continue or stop the run.'
          : '⌘/Ctrl + Enter to approve'}
      </p>
    </ReviewCard>
  )
}
