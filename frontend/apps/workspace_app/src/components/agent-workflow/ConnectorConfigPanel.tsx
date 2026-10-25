import { memo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import type { Diagram, DiagramEdge } from '@/components/designer/diagram-types'
import type { ConnectorConfig } from '@/types/agent-workflow'

/** Asks the workflow page to put a Human Review step on a connector (`detail.edgeId`). */
export const INSERT_REVIEW_ON_EDGE_EVENT = 'eleven-nodes-insert-review-on-edge'

interface ConnectorConfigPanelProps {
  edge: DiagramEdge
  fromLabel: string
  toLabel: string
  onChange: (updater: (previous: Diagram) => Diagram) => void
}

function updateConnector(
  onChange: ConnectorConfigPanelProps['onChange'],
  edgeId: string,
  patch: Partial<ConnectorConfig>,
  label?: string,
) {
  onChange((previous) => ({
    ...previous,
    edges: previous.edges.map((candidate) => {
      if (candidate.id !== edgeId) return candidate
      const connector = { ...(candidate.connector ?? {}), ...patch } as ConnectorConfig
      return {
        ...candidate,
        label: label ?? candidate.label,
        connector,
      }
    }),
  }))
}

export const ConnectorConfigPanel = memo(function ConnectorConfigPanel({
  edge,
  onChange,
}: ConnectorConfigPanelProps) {
  const connector = edge.connector!

  return (
    <div className="flex h-full flex-col">
      {connector.humanApproval ? (
        <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
          <div className="flex items-start gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <ShieldCheck className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-foreground">Approval set on this connector</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Human approval now lives in a Human Review step, so the pause shows on the canvas and
                keeps its own message, reviewer and timeout.
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex gap-2 pl-[38px]">
            <Button
              size="sm"
              className="h-7 text-[11.5px]"
              onClick={() =>
                window.dispatchEvent(new CustomEvent(INSERT_REVIEW_ON_EDGE_EVENT, { detail: { edgeId: edge.id } }))
              }
            >
              Convert to review step
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11.5px] text-muted-foreground"
              onClick={() => updateConnector(onChange, edge.id, { humanApproval: false })}
            >
              Remove approval
            </Button>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="flow" className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <TabsList className="h-8 w-full shrink-0">
          <TabsTrigger value="flow" className="flex-1 text-xs">
            Flow
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex-1 text-xs">
            Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flow" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <Field label="Connector label">
            <Input
              value={edge.label ?? ''}
              onChange={(event) => updateConnector(onChange, edge.id, {}, event.target.value)}
              placeholder="e.g. On success, If score > 0.8"
            />
          </Field>
          <Field
            label="Condition logic"
            hint='field op value on the previous agent&apos;s output: ==, !=, >, >=, <, <=, contains, in. Use "text" for its reply. Leave empty for the default path.'
          >
            <Textarea
              rows={4}
              className="font-mono text-xs"
              value={connector.condition}
              onChange={(event) => updateConnector(onChange, edge.id, { condition: event.target.value })}
              placeholder={'category == "billing"'}
            />
          </Field>
          <Field label="Execution order">
            <Input
              type="number"
              min={1}
              value={connector.executionOrder}
              onChange={(event) =>
                updateConnector(onChange, edge.id, { executionOrder: Number(event.target.value) })
              }
            />
          </Field>
          <PanelSection title="Error handling">
            <Field label="Fallback path">
              <Input
                value={connector.fallbackPath}
                onChange={(event) =>
                  updateConnector(onChange, edge.id, { fallbackPath: event.target.value })
                }
                placeholder="agent-id or branch name"
              />
            </Field>
            <Field label="Error handling path">
              <Input
                value={connector.errorPath}
                onChange={(event) =>
                  updateConnector(onChange, edge.id, { errorPath: event.target.value })
                }
                placeholder="error-handler-agent-id"
              />
            </Field>
          </PanelSection>
        </TabsContent>

        <TabsContent value="mapping" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <Field label="Input mapping" hint="JSONPath or template for downstream input">
            <Textarea
              rows={6}
              className="font-mono text-xs"
              value={connector.inputMapping}
              onChange={(event) =>
                updateConnector(onChange, edge.id, { inputMapping: event.target.value })
              }
              placeholder='{ "query": "{{previous.output.text}}" }'
            />
          </Field>
          <Field label="Output mapping">
            <Textarea
              rows={6}
              className="font-mono text-xs"
              value={connector.outputMapping}
              onChange={(event) =>
                updateConnector(onChange, edge.id, { outputMapping: event.target.value })
              }
            />
          </Field>
        </TabsContent>

      </Tabs>
    </div>
  )
})
