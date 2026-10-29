import { memo } from 'react'
import { AlertTriangle, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import type { Diagram, DiagramDocument, DiagramNode } from '@/components/designer/diagram-types'
import type { AgentNodeConfig } from '@/types/agent-workflow'
import { cn } from '@/utils/cn'

/** Flow blocks configured here instead of in the agent panel. */
export const FLOW_STEP_PALETTE_IDS = new Set(['aw-ask-user', 'aw-delay', 'aw-wait-event', 'aw-transform', 'aw-loop'])

// Steps that pause for a person or an outside event: the engine cannot run them inside a loop
const PAUSING_PALETTE_IDS = new Set(['aw-reviewer', 'aw-ask-user', 'aw-wait-event'])

const NAME_FIELD: Record<string, { label: string; hint: string; placeholder: string }> = {
  'aw-ask-user': { label: 'Question', hint: 'Asked in the run chat; the run continues with the answer.', placeholder: 'Which order number?' },
  'aw-wait-event': { label: 'Event name', hint: 'The run holds until an outside system sends this event.', placeholder: 'payment.received' },
  'aw-delay': { label: 'Name', hint: 'Shown on the canvas.', placeholder: 'Pause' },
  'aw-transform': { label: 'Name', hint: 'Shown on the canvas; later steps read its output by this name.', placeholder: 'Shape order' },
  'aw-loop': { label: 'Name', hint: 'Shown on the canvas.', placeholder: 'For each order' },
}

export const FlowStepPanel = memo(function FlowStepPanel({
  node,
  doc,
  onChange,
  onOpenTab,
  onCreateLoopSteps,
}: {
  node: DiagramNode
  doc: DiagramDocument
  onChange: (updater: (previous: Diagram) => Diagram) => void
  onOpenTab?: (pageId: string) => void
  onCreateLoopSteps?: (nodeId: string) => void
}) {
  const agent = node.agent
  const name = NAME_FIELD[node.paletteId]
  const update = (patch: { label?: string; agent?: Partial<AgentNodeConfig> }) =>
    onChange((previous) => ({
      ...previous,
      nodes: previous.nodes.map((item) =>
        item.id === node.id
          ? { ...item, ...(patch.label !== undefined ? { label: patch.label } : {}), ...(patch.agent && item.agent ? { agent: { ...item.agent, ...patch.agent } } : {}) }
          : item,
      ),
    }))

  const stepsTab = node.subWorkflowPageId ? doc.pages.find((page) => page.id === node.subWorkflowPageId) : undefined
  const pausing = stepsTab?.diagram.nodes.filter((item) => PAUSING_PALETTE_IDS.has(item.paletteId)) ?? []

  return (
    <div className="space-y-6 p-4">
      <PanelSection title="Step">
        {name ? (
          <Field label={name.label} hint={name.hint}>
            <Input value={node.label} placeholder={name.placeholder} onChange={(event) => update({ label: event.target.value })} />
          </Field>
        ) : null}

        {node.paletteId === 'aw-delay' ? (
          <Field label="Seconds" hint="Up to 60 seconds inside a run.">
            <Input
              type="number"
              min={0}
              max={60}
              value={agent?.timeoutSeconds ?? 30}
              onChange={(event) => update({ agent: { timeoutSeconds: Math.max(0, Math.min(60, Number(event.target.value) || 0)) } })}
            />
          </Field>
        ) : null}

        {node.paletteId === 'aw-transform' ? (
          <Field
            label="Output"
            hint="Text or an expression. {{ last.output }} is the previous step's result; {{ nodes.<step id>.output }} any earlier step's; {{ state.<key> }} shared state."
          >
            <Textarea
              rows={5}
              className="font-mono text-[12px]"
              value={agent?.transformOutput ?? '{{ last.output }}'}
              onChange={(event) => update({ agent: { transformOutput: event.target.value } })}
            />
          </Field>
        ) : null}
      </PanelSection>

      {node.paletteId === 'aw-loop' ? (
        <>
          <PanelSection title="Loop">
            <Field label="For each item in" hint="An expression that gives a list, such as {{ last.output.orders }}.">
              <Input
                className="font-mono text-[12px]"
                value={agent?.loopOver ?? '{{ last.output }}'}
                onChange={(event) => update({ agent: { loopOver: event.target.value } })}
              />
            </Field>
            <Field label="Item name" hint="Inside the loop, the current item is {{ loop.<name> }}.">
              <Input
                className="font-mono text-[12px]"
                value={agent?.loopItem ?? 'item'}
                onChange={(event) => update({ agent: { loopItem: event.target.value.replace(/[^A-Za-z0-9_]/g, '') || 'item' } })}
              />
            </Field>
            <Field label="Run items">
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Run items">
                {(['sequential', 'parallel'] as const).map((mode) => {
                  const active = (agent?.loopMode ?? 'sequential') === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => update({ agent: { loopMode: mode } })}
                      className={cn(
                        'rounded-[3px] border px-2 py-1.5 text-xs font-medium transition-colors',
                        active ? 'border-foreground/50 bg-accent text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {mode === 'sequential' ? 'One by one' : 'In parallel (4 at a time)'}
                    </button>
                  )
                })}
              </div>
            </Field>
          </PanelSection>

          <PanelSection title="Steps">
            {stepsTab ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  The steps repeated for each item live in the <span className="font-medium text-foreground">{stepsTab.name}</span> tab.
                </p>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => onOpenTab?.(stepsTab.id)}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open steps tab
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">No steps yet: each item passes through unchanged.</p>
                <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onCreateLoopSteps?.(node.id)} disabled={!onCreateLoopSteps}>
                  <Plus className="h-3.5 w-3.5" /> Create steps tab
                </Button>
              </div>
            )}
            {pausing.length ? (
              <p className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {pausing.map((item) => item.label).join(', ')} cannot run inside a loop (approvals, questions and events pause a
                run). Move them before or after the loop.
              </p>
            ) : null}
          </PanelSection>
        </>
      ) : null}
    </div>
  )
})
