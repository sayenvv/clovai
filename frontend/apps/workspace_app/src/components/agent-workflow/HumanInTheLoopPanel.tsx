import { ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/agent-workflow/FormField'
import { resolvedAgentHitl } from '@/components/agent-workflow/agent-hitl'
import type { AgentNodeConfig } from '@/types/agent-workflow'

interface HumanInTheLoopPanelProps {
  agent: AgentNodeConfig
  agentLabel: string
  handoffCount: number
  lockedOn?: boolean
  onToggle: (enabled: boolean) => void
  onChange: (patch: {
    approvalMessage?: string
    approvalRole?: string
    approvalTimeoutMinutes?: number
    feedbackRevisionsEnabled?: boolean
    maxFeedbackRevisions?: number
  }) => void
}

export function HumanInTheLoopPanel({
  agent,
  agentLabel,
  handoffCount,
  lockedOn = false,
  onToggle,
  onChange,
}: HumanInTheLoopPanelProps) {
  const hitl = resolvedAgentHitl(agent)
  const enabled = lockedOn || hitl.humanInTheLoop

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <ShieldCheck className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Human in the loop</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {lockedOn
                ? `${agentLabel} is a review step. Downstream work waits until a person approves.`
                : `Pause after ${agentLabel} until a reviewer approves the handoff to the next agent.`}
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={lockedOn}
            onCheckedChange={onToggle}
            aria-label="Enable human in the loop"
          />
        </div>
      </div>

      {enabled ? (
        <>
          <Field
            label="Approval message"
            hint="Shown to the reviewer when this agent finishes"
          >
            <Textarea
              rows={4}
              value={hitl.approvalMessage}
              onChange={(event) => onChange({ approvalMessage: event.target.value })}
              placeholder="Please review the agent output before continuing."
            />
          </Field>
          <Field label="Reviewer role / user">
            <Input
              value={hitl.approvalRole}
              onChange={(event) => onChange({ approvalRole: event.target.value })}
              placeholder="reviewer, admin@company.com"
            />
          </Field>
          <Field label="Timeout (minutes)">
            <Input
              type="number"
              min={1}
              value={hitl.approvalTimeoutMinutes}
              onChange={(event) =>
                onChange({ approvalTimeoutMinutes: Number(event.target.value) })
              }
            />
          </Field>
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Request changes & re-run</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                If the reviewer sends feedback, this agent runs again with that feedback until they
                approve.
              </p>
            </div>
            <Switch
              checked={hitl.feedbackRevisionsEnabled}
              onCheckedChange={(checked) => onChange({ feedbackRevisionsEnabled: checked })}
              aria-label="Re-run agent when reviewer sends feedback"
            />
          </div>
          {hitl.feedbackRevisionsEnabled ? (
            <Field
              label="Max revision rounds"
              hint="After this many feedback loops, the reviewer must approve or stop"
            >
              <Input
                type="number"
                min={1}
                max={20}
                value={hitl.maxFeedbackRevisions}
                onChange={(event) =>
                  onChange({ maxFeedbackRevisions: Number(event.target.value) })
                }
              />
            </Field>
          ) : null}
          <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {handoffCount > 0
              ? `Applies to ${handoffCount} outgoing connector${handoffCount === 1 ? '' : 's'}. Execution waits here before the next agent runs.`
              : 'Connect this agent to the next step so review can pause the handoff.'}
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          When enabled, this agent’s output must be approved before the workflow continues. You can
          still add a Human Review block on a connector if you want an explicit review node on the
          canvas.
        </p>
      )}
    </div>
  )
}
