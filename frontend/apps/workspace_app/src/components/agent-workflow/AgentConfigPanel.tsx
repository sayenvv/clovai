import { memo, useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { resolveModelProvider } from '@/components/agent-workflow/model-providers'
import { catalogModelsFor, useModelCatalog } from '@/components/agent-workflow/hooks/use-model-catalog'
import { useWorkflowModel } from '@/components/agent-workflow/workflow-model-context'
import { agentOwnModel } from '@/components/agent-workflow/workflow-model-config'
import { cn } from '@/utils/cn'
import { InstructionsEditorField } from '@/components/agent-workflow/InstructionsEditorField'
import { HumanInTheLoopPanel } from '@/components/agent-workflow/HumanInTheLoopPanel'
import { WorkflowBuilderSettings } from '@/components/agent-workflow/WorkflowBuilderSettings'
import { ContextProviderPicker } from '@/components/agent-workflow/ContextProviderPicker'
import { AgentModelConnections } from '@/components/agent-workflow/AgentModelConnections'
import { useModelConnections } from '@/components/agent-workflow/hooks/use-model-connections'
import type { ModelConnectionProvider } from '@/services/model-connections-api'
import { orchestratorPattern } from '@/components/agent-workflow/orchestration-patterns'
import { teamOfWorkflowNode } from '@/components/agent-workflow/workflow-builder-config'
import {
  applyAgentHumanInTheLoop,
  listAgentHitlHandoffEdges,
} from '@/components/agent-workflow/agent-hitl'
import { generateAgentInstructions } from '@/services/generate-agent-instructions-api'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import type { AgentNodeConfig, AgentStatus } from '@/types/agent-workflow'

interface AgentConfigPanelProps {
  node: DiagramNode
  diagram: Diagram
  onChange: (updater: (previous: Diagram) => Diagram) => void
}

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
  diagram,
  onChange,
}: AgentConfigPanelProps) {
  const agent = node.agent!
  const workflowModel = useWorkflowModel()
  // No model and no connection of its own: the agent runs on the workflow's model
  const inheritsModel = !agentOwnModel(agent)
  const currentProvider = inheritsModel ? undefined : resolveModelProvider(agent)
  // Only read for what the agent's model rejects (no temperature on reasoning models)
  const { catalog } = useModelCatalog()
  const { connections } = useModelConnections()
  const unsupportedOptions = agent.modelConnectionId
    ? connections.find((connection) => connection.id === agent.modelConnectionId)?.unsupportedOptions
    : catalogModelsFor(catalog, currentProvider?.id).find((model) => model.id === agent.model)?.unsupportedOptions
  const temperatureSupported = !unsupportedOptions?.includes('temperature')
  const toolsText = agent.tools.join(', ')
  const isReviewAgent = agent.agentType === 'human'
  // Workflow nodes (an orchestrator and its team) get their builder settings first.
  const pattern = orchestratorPattern(node)
  const team = pattern
    ? teamOfWorkflowNode(diagram, node.id).flatMap((id) => diagram.nodes.filter((candidate) => candidate.id === id))
    : []
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
      <Tabs key={pattern ? 'workflow' : 'agent'} defaultValue={pattern ? 'workflow' : 'general'} className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <TabsList className="flex h-auto min-h-8 w-full shrink-0 flex-wrap gap-0.5">
          {pattern ? (
            <TabsTrigger value="workflow" className="flex-1 text-xs">
              Workflow
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="general" className="flex-1 text-xs">
            General
          </TabsTrigger>
          <TabsTrigger value="model" className="flex-1 text-xs">
            Model
          </TabsTrigger>
          {/* A Magentic manager plans; context providers are for the agents doing the work */}
          {pattern ? null : (
            <TabsTrigger value="memory" className="flex-1 text-xs">
              Memory
            </TabsTrigger>
          )}
          <TabsTrigger value="io" className="flex-1 text-xs">
            Output
          </TabsTrigger>
          <TabsTrigger value="runtime" className="flex-1 text-xs">
            Runtime
          </TabsTrigger>
        </TabsList>

        {pattern ? (
          <TabsContent value="workflow" className="mt-3 flex-1 overflow-y-auto pb-4">
            <WorkflowBuilderSettings
              pattern={pattern}
              node={node}
              team={team}
              values={agent.workflowConfig}
              onChange={(workflowConfig) => updateAgent(onChange, node.id, { workflowConfig })}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="general" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <Field label="Agent name">
            <Input
              value={node.label}
              onChange={(event) => updateAgent(onChange, node.id, {}, event.target.value)}
            />
          </Field>
          <Field label="Logo URL" hint="Image shown on the node; leave empty for the default agent icon">
            <Input
              value={agent.logo ?? ''}
              placeholder="https://…/logo.png"
              onChange={(event) => updateAgent(onChange, node.id, { logo: event.target.value.trim() || undefined })}
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
          {/* Human review: its approval settings are what the node is for. */}
          {isReviewAgent ? (
          <HumanInTheLoopPanel
              agent={agent}
              agentLabel={node.label.trim() || 'this agent'}
              handoffCount={listAgentHitlHandoffEdges(
                diagram,
                node.id,
                isReviewAgent ? 'incoming' : 'outgoing',
              ).length}
              lockedOn={isReviewAgent}
              onToggle={(enabled) =>
                onChange((previous) =>
                  applyAgentHumanInTheLoop(previous, node.id, { humanInTheLoop: enabled }),
                )
              }
              onChange={(patch) =>
                onChange((previous) =>
                  applyAgentHumanInTheLoop(previous, node.id, {
                    ...patch,
                    ...(isReviewAgent ? { humanInTheLoop: true } : {}),
                  }),
                )
              }
            />
          ) : null}
        </TabsContent>

        {pattern ? null : (
          <TabsContent value="memory" className="mt-3 flex-1 overflow-y-auto pb-4">
            <ContextProviderPicker
              value={agent.contextProviderIds ?? []}
              onChange={(contextProviderIds) => updateAgent(onChange, node.id, { contextProviderIds })}
            />
          </TabsContent>
        )}

        <TabsContent value="model" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
          <Field label="Runs on" hint="By default an agent uses the workflow's model, the one test runs use. Pick one of the models below to give it its own.">
            <button
              type="button"
              role="radio"
              aria-checked={inheritsModel}
              onClick={() => updateAgent(onChange, node.id, { model: '', modelProvider: undefined, modelConnectionId: undefined })}
              className={cn(
                'flex w-full min-w-0 items-center justify-between gap-2 rounded-[3px] border px-2 py-1.5 text-left text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                inheritsModel
                  ? 'border-foreground/50 bg-accent text-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
              )}
            >
              <span className="font-medium">Workflow model (default)</span>
              <span className="truncate font-mono text-[10.5px] text-muted-foreground">{workflowModel?.model || 'not set'}</span>
            </button>
          </Field>
          <AgentModelConnections
            selectedId={agent.modelConnectionId}
            onSelect={(connection) =>
              updateAgent(
                onChange,
                node.id,
                connection
                  ? {
                      modelConnectionId: connection.id,
                      modelProvider: connectionProviderId(connection.providerType),
                      model: connection.model,
                    }
                  : { modelConnectionId: undefined },
              )
            }
          />
          <Field label="Temperature" hint={temperatureSupported ? undefined : `${agent.model} does not support temperature`}>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              disabled={!temperatureSupported}
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
            <div className="flex items-center justify-between rounded-[3px] border border-border px-3 py-2">
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
          {/* An agent takes the conversation as input; only its reply can be structured */}
          <Field label="Output schema (JSON)" hint="Structured response: JSON Schema the agent's reply must follow">
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

/** The model client logo / id used for a saved connection's provider. */
export function connectionProviderId(provider: ModelConnectionProvider): string {
  return provider === 'openai-compatible' ? 'openai' : provider
}
