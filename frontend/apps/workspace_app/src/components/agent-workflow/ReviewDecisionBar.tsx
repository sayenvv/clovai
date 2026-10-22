import { Send, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { WorkflowRunState } from '@/types/agent-workflow'

interface ReviewDecisionBarProps {
  approvalPrompt: NonNullable<WorkflowRunState['approvalPrompt']>
  value: string
  onChange: (value: string) => void
  onApprove: (note: string) => void
  onRequestChanges?: (feedback: string) => void
}

export function ReviewDecisionBar({
  approvalPrompt,
  value,
  onChange,
  onApprove,
  onRequestChanges,
}: ReviewDecisionBarProps) {
  const allowFeedback = Boolean(approvalPrompt.feedbackRevisionsEnabled && onRequestChanges)
  const revisionCount = approvalPrompt.revisionCount ?? 0
  const maxRevisions = approvalPrompt.maxFeedbackRevisions ?? 5
  const revisionsLeft = Math.max(0, maxRevisions - revisionCount)
  const canRequestChanges = allowFeedback && value.trim().length > 0 && revisionsLeft > 0

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          allowFeedback
            ? `Approve with a note, or describe changes for ${approvalPrompt.agentName ?? 'the agent'}…`
            : `Approval note for ${approvalPrompt.role}…`
        }
        className="min-h-[80px] resize-none text-xs"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            onApprove(value)
            onChange('')
          }
        }}
      />
      {allowFeedback ? (
        <p className="text-[10px] text-muted-foreground">
          {revisionsLeft > 0
            ? `${revisionsLeft} revision round${revisionsLeft === 1 ? '' : 's'} remaining. Feedback re-runs ${approvalPrompt.agentName ?? 'the agent'} until you approve.`
            : 'Revision limit reached. Approve to continue or stop the run.'}
        </p>
      ) : null}
      <div className={allowFeedback ? 'grid grid-cols-2 gap-2' : ''}>
        {allowFeedback ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            disabled={!canRequestChanges}
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
        <Button
          type="button"
          size="sm"
          className="h-9 w-full gap-1.5 bg-amber-600 text-xs text-white hover:bg-amber-700"
          onClick={() => {
            onApprove(value)
            onChange('')
          }}
        >
          <Send className="h-3.5 w-3.5" />
          Approve &amp; continue
        </Button>
      </div>
    </div>
  )
}
