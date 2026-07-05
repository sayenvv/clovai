import { memo } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import type { Diagram, DiagramEdge } from '@/components/designer/diagram-types'
import type { ConnectorConfig } from '@/types/agent-workflow'

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
      {connector.humanApproval && (
        <div className="border-b border-border px-4 py-2">
          <Badge className="bg-violet-600 text-[10px] hover:bg-violet-600">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Human approval
          </Badge>
        </div>
      )}

      <Tabs defaultValue="flow" className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <TabsList className="h-8 w-full shrink-0">
          <TabsTrigger value="flow" className="flex-1 text-xs">
            Flow
          </TabsTrigger>
          <TabsTrigger value="mapping" className="flex-1 text-xs">
            Mapping
          </TabsTrigger>
          <TabsTrigger value="approval" className="flex-1 text-xs">
            Approval
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
          <Field label="Condition logic" hint="JavaScript-like expression evaluated on transition">
            <Textarea
              rows={4}
              className="font-mono text-xs"
              value={connector.condition}
              onChange={(event) => updateConnector(onChange, edge.id, { condition: event.target.value })}
              placeholder="output.confidence > 0.8"
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

        <TabsContent value="approval" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <div className="flex items-center justify-between rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Human approval required</p>
              <p className="text-xs text-muted-foreground">Pause workflow until a reviewer approves</p>
            </div>
            <Switch
              checked={connector.humanApproval}
              onCheckedChange={(checked) =>
                updateConnector(onChange, edge.id, { humanApproval: checked })
              }
            />
          </div>

          {connector.humanApproval && (
            <>
              <Field label="Approval message">
                <Textarea
                  rows={3}
                  value={connector.approvalMessage}
                  onChange={(event) =>
                    updateConnector(onChange, edge.id, { approvalMessage: event.target.value })
                  }
                />
              </Field>
              <Field label="Approval role / user">
                <Input
                  value={connector.approvalRole}
                  onChange={(event) =>
                    updateConnector(onChange, edge.id, { approvalRole: event.target.value })
                  }
                  placeholder="reviewer, admin@company.com"
                />
              </Field>
              <Field label="Approval timeout (minutes)">
                <Input
                  type="number"
                  min={1}
                  value={connector.approvalTimeoutMinutes}
                  onChange={(event) =>
                    updateConnector(onChange, edge.id, {
                      approvalTimeoutMinutes: Number(event.target.value),
                    })
                  }
                />
              </Field>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
})
