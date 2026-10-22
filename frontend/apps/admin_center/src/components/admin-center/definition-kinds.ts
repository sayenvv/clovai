import { Bot, Layers, Workflow, Wrench, type LucideIcon } from 'lucide-react'
import type { DefinitionKind, WorkflowType } from '@/api/definitions'

export interface DefinitionKindConfig {
  kind: DefinitionKind
  label: string
  singular: string
  icon: LucideIcon
  description: string
  /** Only list definitions of this type. Workflows show admin-made ones only. */
  onlyType?: WorkflowType
  /** The JSON a new definition starts from. */
  template: Record<string, unknown>
  /** Extra column read from the definition, such as a tool's type. */
  detailColumn?: { label: string; read: (definition: Record<string, unknown>) => string }
  /** Small figures shown on a grid card. */
  stats: (definition: Record<string, unknown>) => { label: string; value: string }[]
}

const count = (value: unknown) => String(Array.isArray(value) ? value.length : 0)
const text = (value: unknown) => (value === undefined || value === null || value === '' ? '—' : String(value))

export const DEFINITION_KINDS: Record<DefinitionKind, DefinitionKindConfig> = {
  workflows: {
    kind: 'workflows',
    label: 'Workflows',
    singular: 'workflow',
    icon: Workflow,
    description: 'Admin-made workflow definitions.',
    onlyType: 'system_generated',
    stats: (definition) => {
      const orchestration = (definition.orchestration ?? {}) as Record<string, unknown>
      const pattern = text(orchestration.pattern)
      const config = (orchestration[pattern] ?? {}) as Record<string, unknown>
      return [
        { label: 'Pattern', value: pattern },
        { label: 'Participants', value: count(config.participants) },
        { label: 'Max rounds', value: text(config.maxRoundCount) },
      ]
    },
    template: {
      schemaVersion: '1.0',
      name: 'New workflow',
      description: '',
      orchestration: {
        pattern: 'magentic',
        magentic: { managerAgentId: '', participants: [], intermediateOutputFrom: [] },
        checkpointing: { enabled: false, storage: 'in_memory', path: null },
        streaming: true,
      },
    },
  },
  agents: {
    kind: 'agents',
    label: 'Agents',
    singular: 'agent',
    icon: Bot,
    description: 'Agents with their model, tools and middlewares.',
    template: {
      name: 'New agent',
      description: '',
      instructions: '',
      model: { provider: 'openai', name: 'gpt-4.1', credential: 'env', temperature: 0, maxTokens: 4000 },
      tools: [],
      middlewares: [],
      contextProviders: [],
      humanInTheLoop: null,
    },
    stats: (definition) => [
      { label: 'Tools', value: count(definition.tools) },
      { label: 'Middlewares', value: count(definition.middlewares) },
      { label: 'Temperature', value: text((definition.model as { temperature?: number } | undefined)?.temperature) },
    ],
    detailColumn: {
      label: 'Model',
      read: (definition) => String((definition.model as { name?: string } | undefined)?.name ?? '—'),
    },
  },
  tools: {
    kind: 'tools',
    label: 'Tools',
    singular: 'tool',
    icon: Wrench,
    description: 'Function tools and MCP servers agents can call.',
    template: {
      type: 'function',
      name: 'new_tool',
      description: '',
      handler: 'app.tools.module:function_name',
      approvalMode: 'never_require',
      maxInvocations: 5,
      maxInvocationExceptions: 2,
      inputModel: { type: 'object', properties: {}, required: [] },
    },
    detailColumn: { label: 'Type', read: (definition) => String(definition.type ?? '—') },
    stats: (definition) => [
      { label: 'Approval', value: text(definition.approvalMode).replace('_', ' ') },
      { label: 'Max calls', value: text(definition.maxInvocations) },
      {
        label: 'Inputs',
        value: String(Object.keys((definition.inputModel as { properties?: object } | undefined)?.properties ?? {}).length),
      },
    ],
  },
  middlewares: {
    kind: 'middlewares',
    label: 'Middlewares',
    singular: 'middleware',
    icon: Layers,
    description: 'Middleware layers agents and tools run through.',
    template: {
      name: 'new_middleware',
      layer: 'agent',
      description: '',
      handler: 'app.middleware.module:ClassName',
      defaultConfig: {},
    },
    detailColumn: { label: 'Layer', read: (definition) => String(definition.layer ?? '—') },
    stats: (definition) => [
      { label: 'Layer', value: text(definition.layer) },
      { label: 'Settings', value: String(Object.keys((definition.defaultConfig as object | undefined) ?? {}).length) },
    ],
  },
}
