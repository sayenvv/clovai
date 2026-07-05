import { memo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Field } from '@/components/agent-workflow/FormField'
import {
  agentLabel,
  listAgentNodes,
  remapToolToAgent,
} from '@/components/agent-workflow/tool-agent-mapping'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'

interface ToolConfigPanelProps {
  node: DiagramNode
  diagram: Diagram
  onChange: (updater: (previous: Diagram) => Diagram) => void
}

export const ToolConfigPanel = memo(function ToolConfigPanel({
  node,
  diagram,
  onChange,
}: ToolConfigPanelProps) {
  const agent = node.agent!
  const agents = listAgentNodes(diagram)
  const toolsText = agent.tools.join(', ')

  const updateTool = (patch: Partial<typeof agent>, label?: string) => {
    onChange((previous) => ({
      ...previous,
      nodes: previous.nodes.map((candidate) => {
        if (candidate.id !== node.id || !candidate.agent) return candidate
        return {
          ...candidate,
          label: label ?? candidate.label,
          agent: { ...candidate.agent, ...patch },
        }
      }),
    }))
  }

  const handleAgentChange = (agentId: string) => {
    onChange((previous) => remapToolToAgent(previous, node.id, agentId))
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="mapping" className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <TabsList className="h-8 w-full shrink-0">
          <TabsTrigger value="mapping" className="flex-1 text-xs">
            Mapping
          </TabsTrigger>
          <TabsTrigger value="config" className="flex-1 text-xs">
            Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapping" className="mt-3 flex-1 space-y-4 overflow-y-auto pb-4">
          <Field label="Mapped agent" hint="This tool runs under the selected agent">
            <Select
              value={node.mappedAgentId ?? ''}
              onChange={(event) => handleAgentChange(event.target.value)}
            >
              <option value="" disabled>
                Select agent…
              </option>
              {agents.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </Select>
          </Field>
          <p className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
            Currently mapped to{' '}
            <span className="font-medium text-foreground">
              {agentLabel(diagram, node.mappedAgentId)}
            </span>
            . Change the mapping anytime — the tool will reposition in the row under that agent.
          </p>
        </TabsContent>

        <TabsContent value="config" className="mt-3 flex-1 space-y-4 overflow-y-auto pb-4">
          <Field label="Tool name">
            <Input
              value={node.label}
              onChange={(event) => updateTool({}, event.target.value)}
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              value={agent.description}
              onChange={(event) => updateTool({ description: event.target.value })}
            />
          </Field>
          <Field label="Tool identifiers" hint="Comma-separated integrations this node can call">
            <Input
              value={toolsText}
              onChange={(event) =>
                updateTool({
                  tools: event.target.value
                    .split(',')
                    .map((tool) => tool.trim())
                    .filter(Boolean),
                })
              }
              placeholder="web_search, slack_notify"
            />
          </Field>
          <Field label="Instructions">
            <Textarea
              rows={5}
              className="font-mono text-xs"
              value={agent.instructions}
              onChange={(event) => updateTool({ instructions: event.target.value })}
            />
          </Field>
        </TabsContent>
      </Tabs>
    </div>
  )
})
