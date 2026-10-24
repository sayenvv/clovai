import { memo, useCallback, useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import {
  ModelProviderLogo,
  modelForProvider,
  resolveModelProvider,
  type ModelProvider,
} from '@/components/agent-workflow/model-providers'
import type { CatalogModelOption } from '@/services/models-api'
import {
  availableModelProviders,
  catalogModelsFor,
  useModelCatalog,
} from '@/components/agent-workflow/hooks/use-model-catalog'
import { cn } from '@/utils/cn'
import { InstructionsEditorField } from '@/components/agent-workflow/InstructionsEditorField'
import { HumanInTheLoopPanel } from '@/components/agent-workflow/HumanInTheLoopPanel'
import { WorkflowBuilderSettings } from '@/components/agent-workflow/WorkflowBuilderSettings'
import { AgentModelConnections } from '@/components/agent-workflow/AgentModelConnections'
import type { ModelConnectionProvider } from '@/services/model-connections-api'
import { orchestratorPattern } from '@/components/agent-workflow/orchestration-patterns'
import { teamOfWorkflowNode } from '@/components/agent-workflow/workflow-builder-config'
import {
  applyAgentHumanInTheLoop,
  listAgentHitlHandoffEdges,
} from '@/components/agent-workflow/agent-hitl'
import { generateAgentInstructions } from '@/services/generate-agent-instructions-api'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import type { AgentNodeConfig, AgentStatus, AgentType } from '@/types/agent-workflow'

interface AgentConfigPanelProps {
  node: DiagramNode
  diagram: Diagram
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
  const currentProvider = resolveModelProvider(agent)
  const { catalog, error: catalogError, reload: reloadCatalog } = useModelCatalog()
  const providers = availableModelProviders(catalog)
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
          <TabsTrigger value="io" className="flex-1 text-xs">
            I/O
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
              onChange={(event) => {
                const agentType = event.target.value as AgentType
                if (agentType === 'human') {
                  onChange((previous) =>
                    applyAgentHumanInTheLoop(
                      {
                        ...previous,
                        nodes: previous.nodes.map((candidate) =>
                          candidate.id === node.id && candidate.agent
                            ? { ...candidate, agent: { ...candidate.agent, agentType } }
                            : candidate,
                        ),
                      },
                      node.id,
                      { humanInTheLoop: true },
                    ),
                  )
                  return
                }
                updateAgent(onChange, node.id, { agentType })
              }}
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

        <TabsContent value="model" className="mt-3 flex-1 overflow-y-auto space-y-4 pb-4">
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
          <Field
            label="Model client"
            hint={agent.modelConnectionId ? 'Using your own model above; pick a client here to switch back' : 'The provider this agent runs on'}
          >
            {catalog === null ? (
              <CatalogStatus error={catalogError} onRetry={reloadCatalog} />
            ) : providers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No model clients are configured. Add one in Admin center → Configuration → models.
              </p>
            ) : (
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Model client">
              {providers.map((provider) => {
                const active = !agent.modelConnectionId && provider.id === currentProvider?.id
                return (
                  <button
                    key={provider.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      updateAgent(onChange, node.id, {
                        modelConnectionId: undefined,
                        modelProvider: provider.id,
                        model: modelForProvider(
                          provider,
                          agent.model,
                          catalogModelsFor(catalog, provider.id).map((model) => model.id),
                        ),
                      })
                    }
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-foreground/50 bg-accent text-foreground'
                        : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                    )}
                  >
                    <ModelProviderLogo provider={provider} className="size-5 rounded-[5px]" />
                    <span className="truncate font-medium">{provider.label}</span>
                  </button>
                )
              })}
            </div>
            )}
          </Field>
          <Field label="Model" hint={currentProvider ? `Models available on ${currentProvider.label}` : 'Choose a model client first'}>
            <ModelList
              models={catalogModelsFor(catalog, currentProvider?.id)}
              loading={catalog === null}
              provider={currentProvider}
              value={agent.model}
              onChange={(model) => updateAgent(onChange, node.id, { model })}
            />
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

/**
 * The models the agent can run on: the client's suggested models plus whatever the
 * application's model catalog lists for it (e.g. models installed on Ollama). Pick one from
 * the list; "Other model…" is there for a name the list doesn't have.
 */
/** Loading / failure note for the model catalog. */
function CatalogStatus({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return error ? (
    <p className="text-xs text-destructive">
      {error}{' '}
      <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
        Retry
      </button>
    </p>
  ) : (
    <p className="text-xs text-muted-foreground">Loading model clients…</p>
  )
}

/**
 * The models the agent can run on, as the application's model catalog lists them for the
 * chosen client. "Other model…" is there for a name the catalog doesn't have.
 */
function ModelList({
  provider,
  models,
  loading,
  value,
  onChange,
}: {
  provider: ModelProvider | undefined
  models: CatalogModelOption[]
  loading: boolean
  value: string
  onChange: (model: string) => void
}) {
  const [custom, setCustom] = useState(false)
  const current = value.trim()
  const listed = models.some((model) => model.id === current)

  if (!provider) {
    return <p className="text-xs text-muted-foreground">Pick a model client above to see its models.</p>
  }
  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading models…</p>
  }

  return (
    <div className="space-y-1.5">
      <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-card p-1" role="listbox" aria-label="Models">
        {models.length === 0 && !current ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No models listed for {provider.label}.</p>
        ) : null}
        {models.map((model) => {          const selected = model.id === current
          return (
            <button
              key={model.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                setCustom(false)
                onChange(model.id)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                selected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <ModelProviderLogo provider={provider} className="size-4 rounded-[4px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs">{model.id}</span>
                {model.detail ? <span className="block truncate text-[10.5px] text-muted-foreground">{model.detail}</span> : null}
              </span>
              {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            </button>
          )
        })}
        {current && !listed ? (
          <div className="flex items-center gap-2 rounded-md bg-accent px-2 py-1.5 text-foreground">
            <ModelProviderLogo provider={provider} className="size-4 rounded-[4px]" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{current}</span>
            <Check className="h-3.5 w-3.5 shrink-0" />
          </div>
        ) : null}
      </div>
      {custom ? (
        <Input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Model name"
          className="h-8 font-mono text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCustom(true)}
          className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Other model…
        </button>
      )}
    </div>
  )
}

/** The model client logo / id used for a saved connection's provider. */
function connectionProviderId(provider: ModelConnectionProvider): string {
  return provider === 'openai-compatible' ? 'openai' : provider
}
