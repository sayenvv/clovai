import { memo, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { InstructionsEditorField } from '@/components/agent-workflow/InstructionsEditorField'
import { generateAgentInstructions } from '@/services/generate-agent-instructions-api'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import type { AgentNodeConfig, AgentStatus, AgentType } from '@/types/agent-workflow'

interface AgentConfigPanelProps {
  node: DiagramNode
  onChange: (updater: (previous: Diagram) => Diagram) => void
}

const AGENT_TYPES: { value: AgentType; label: string }[] = [
  { value: 'llm', label: 'LLM Agent' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'tool', label: 'Tool Agent' },
  { value: 'planner', label: 'Planner' },
  { value: 'human', label: 'Human Review' },
  { value: 'router', label: 'Router' },
  { value: 'trigger', label: 'Trigger' },
  { value: 'memory', label: 'Memory' },
  { value: 'output', label: 'Output' },
  { value: 'control', label: 'Control' },
]

const MODELS = ['gpt-4.1', 'gpt-4.1-mini', 'claude-sonnet-4', 'gemini-2.5-pro']

function updateAgent(
  onChange: AgentConfigPanelProps['onChange'],
  nodeId: string,
  patch: Partial<AgentNodeConfig>,
  label?: string,
) {
  onChange((previous) => ({
    ...previous,
    nodes: previous.nodes.map((candidate) => {
      if (candidate.id !== nodeId || !candidate.agent) return candidate
      return {
        ...candidate,
        label: label ?? candidate.label,
        agent: { ...candidate.agent, ...patch },
      }
    }),
  }))
}

export const AgentConfigPanel = memo(function AgentConfigPanel({
  node,
  onChange,
}: AgentConfigPanelProps) {
  const agent = node.agent!
  const toolsText = agent.tools.join(', ')
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewToken, setPreviewToken] = useState(0)

  const handleGenerateInstructions = useCallback(async () => {
    if (!node.label.trim()) {
      toast.error('Add an agent name before generating instructions')
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateAgentInstructions({
        agentName: node.label.trim(),
        description: agent.description.trim(),
      })
      updateAgent(onChange, node.id, { instructions: result.instructions })
      setPreviewToken((previous) => previous + 1)
      if (result.source === 'template') {
        toast.success('Instructions drafted from template — check server .env LLM settings')
      } else {
        toast.success('Instructions generated')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate instructions')
    } finally {
      setIsGenerating(false)
    }
  }, [agent.description, node.id, node.label, onChange])

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <TabsList className="h-8 w-full shrink-0">
          <TabsTrigger value="general" className="flex-1 text-xs">
            General
          </TabsTrigger>
          <TabsTrigger value="model" className="flex-1 text-xs">
            Model
          </TabsTrigger>
          <TabsTrigger value="io" className="flex-1 text-xs">
            I/O
          </TabsTrigger>
          <TabsTrigger value="runtime" className="flex-1 text-xs">
            Runtime
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <Field label="Agent name">
            <Input
              value={node.label}
              onChange={(event) => updateAgent(onChange, node.id, {}, event.target.value)}
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              value={agent.description}
              onChange={(event) => updateAgent(onChange, node.id, { description: event.target.value })}
            />
          </Field>
          <Field
            label="Instructions / system prompt"
            hint="Markdown system prompt — uses the server LLM configuration from backend .env"
          >
            <InstructionsEditorField
              value={agent.instructions}
              onChange={(instructions) => updateAgent(onChange, node.id, { instructions })}
              onGenerate={handleGenerateInstructions}
              isGenerating={isGenerating}
              previewToken={previewToken}
            />
          </Field>
          <Field label="Agent type">
            <Select
              value={agent.agentType}
              onChange={(event) =>
                updateAgent(onChange, node.id, { agentType: event.target.value as AgentType })
              }
            >
              {AGENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={agent.status}
              onChange={(event) =>
                updateAgent(onChange, node.id, { status: event.target.value as AgentStatus })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </Select>
          </Field>
        </TabsContent>

        <TabsContent value="model" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <Field label="Model">
            <Select
              value={agent.model}
              onChange={(event) => updateAgent(onChange, node.id, { model: event.target.value })}
            >
              {MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Temperature">
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={agent.temperature}
              onChange={(event) =>
                updateAgent(onChange, node.id, { temperature: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Tools / skills" hint="Comma-separated tool identifiers">
            <Input
              value={toolsText}
              onChange={(event) =>
                updateAgent(onChange, node.id, {
                  tools: event.target.value
                    .split(',')
                    .map((tool) => tool.trim())
                    .filter(Boolean),
                })
              }
              placeholder="web_search, code_runner, slack_notify"
            />
          </Field>
          <PanelSection title="Memory">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm">Enable memory</span>
              <Switch
                checked={agent.memoryEnabled}
                onCheckedChange={(checked) =>
                  updateAgent(onChange, node.id, { memoryEnabled: checked })
                }
              />
            </div>
            {agent.memoryEnabled && (
              <Field label="Memory scope">
                <Select
                  value={agent.memoryScope}
                  onChange={(event) =>
                    updateAgent(onChange, node.id, {
                      memoryScope: event.target.value as AgentNodeConfig['memoryScope'],
                    })
                  }
                >
                  <option value="session">Session</option>
                  <option value="workflow">Workflow</option>
                  <option value="global">Global</option>
                </Select>
              </Field>
            )}
          </PanelSection>
        </TabsContent>

        <TabsContent value="io" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <Field label="Input schema (JSON)">
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={agent.inputSchema}
              onChange={(event) => updateAgent(onChange, node.id, { inputSchema: event.target.value })}
            />
          </Field>
          <Field label="Output schema (JSON)">
            <Textarea
              rows={8}
              className="font-mono text-xs"
              value={agent.outputSchema}
              onChange={(event) => updateAgent(onChange, node.id, { outputSchema: event.target.value })}
            />
          </Field>
        </TabsContent>

        <TabsContent value="runtime" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <Field label="Retry count">
            <Input
              type="number"
              min={0}
              max={10}
              value={agent.retryCount}
              onChange={(event) =>
                updateAgent(onChange, node.id, { retryCount: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Timeout (seconds)">
            <Input
              type="number"
              min={10}
              value={agent.timeoutSeconds}
              onChange={(event) =>
                updateAgent(onChange, node.id, { timeoutSeconds: Number(event.target.value) })
              }
            />
          </Field>
        </TabsContent>
      </Tabs>
    </div>
  )
})
