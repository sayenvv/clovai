/**
 * Microsoft Agent Framework builder settings for each workflow pattern. One registry drives both
 * the workflow node's settings form and the configuration exported in the JSON, keyed and ordered
 * as the builders define them (SequentialBuilder, ConcurrentBuilder, HandoffBuilder,
 * GroupChatBuilder, MagenticBuilder).
 *
 * From the canvas: `participants` (the agents the workflow node connects to), the manager
 * (`manager_agent` / `manager`: the workflow node itself) and, for handoff, `handoffs` (who may
 * hand off to whom). The output lists and every other setting are stored on the node as
 * `agent.workflowConfig`. `participant_factories` is always empty: participants are given directly.
 */

import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import {
  findOrchestrations,
  type OrchestrationPattern,
} from '@/components/agent-workflow/orchestration-patterns'

export type BuilderFieldKind = 'number' | 'boolean' | 'text' | 'textarea' | 'select' | 'agent'

export interface BuilderField {
  key: string
  label: string
  kind: BuilderFieldKind
  hint?: string
  /** Value when the user hasn't set one; `null` means "use the framework default". */
  defaultValue: string | number | boolean | null
  options?: Array<{ value: string; label: string }>
  /** Settings-form section the field is shown under (the export stays flat). */
  section?: string
  min?: number
}

/** Where a builder key's value comes from, in the builder's own key order. */
type BuilderKey =
  | { from: 'participants' }
  | { from: 'factories' }
  | { from: 'manager' }
  | { from: 'handoffs' }
  | { from: 'outputs'; list: 'intermediate_output_from' | 'output_from' }
  | { from: 'field'; field: BuilderField }

export interface BuilderSpec {
  builder: string
  summary: string
  /** Key the workflow node is exported under as manager (`manager_agent` / `manager`), if any. */
  managerKey: string | null
  /** Which output lists this builder takes. */
  outputs: Array<'intermediate_output_from' | 'output_from'>
  keys: Array<[string, BuilderKey]>
}

const CHECKPOINT_STORAGE: BuilderField = {
  key: 'checkpoint_storage',
  label: 'Checkpoint storage',
  kind: 'select',
  defaultValue: null,
  options: [
    { value: '', label: 'None' },
    { value: 'in_memory', label: 'In memory (InMemoryCheckpointStorage)' },
    { value: 'file', label: 'File system (FileCheckpointStorage)' },
  ],
  hint: 'Save workflow state so a run can resume after a failure or a pause.',
}

const TERMINATION_CONDITION: BuilderField = {
  key: 'termination_condition',
  label: 'Termination condition',
  kind: 'text',
  defaultValue: null,
  hint: 'Stop when a message contains this text, e.g. “APPROVED”. Empty uses the framework default.',
}

const REQUEST_INFO: BuilderField = {
  key: 'request_info',
  label: 'Request info',
  kind: 'textarea',
  defaultValue: null,
  hint: 'What to ask the user when the workflow needs more input.',
}

const REQUEST_HANDLER: BuilderField = {
  key: 'request_handler',
  label: 'Request handler',
  kind: 'text',
  defaultValue: null,
  hint: 'Name of the backend handler that answers requests for input.',
}

const PROMPT = (key: string, label: string, hint: string): BuilderField => ({
  key,
  label,
  kind: 'textarea',
  defaultValue: null,
  section: 'Manager prompts',
  hint: `${hint} Empty uses the framework's prompt.`,
})

const field = (definition: BuilderField): [string, BuilderKey] => [definition.key, { from: 'field', field: definition }]
const participants: [string, BuilderKey] = ['participants', { from: 'participants' }]
const factories: [string, BuilderKey] = ['participant_factories', { from: 'factories' }]
const intermediate: [string, BuilderKey] = ['intermediate_output_from', { from: 'outputs', list: 'intermediate_output_from' }]
const output: [string, BuilderKey] = ['output_from', { from: 'outputs', list: 'output_from' }]

export const BUILDER_SPECS: Record<OrchestrationPattern, BuilderSpec> = {
  sequential: {
    builder: 'SequentialBuilder',
    summary: 'Runs the participants one after another, each seeing the conversation so far.',
    managerKey: null,
    outputs: ['intermediate_output_from', 'output_from'],
    keys: [
      participants,
      factories,
      field({
        key: 'chain_only_agent_responses',
        label: 'Chain only agent responses',
        kind: 'boolean',
        defaultValue: false,
        hint: 'Pass only the previous agent’s reply to the next one, not the whole conversation.',
      }),
      intermediate,
      output,
      field(CHECKPOINT_STORAGE),
    ],
  },
  concurrent: {
    builder: 'ConcurrentBuilder',
    summary: 'Sends the same input to every participant at once, then aggregates their answers.',
    managerKey: null,
    outputs: ['intermediate_output_from'],
    keys: [
      participants,
      factories,
      field({
        key: 'aggregator',
        label: 'Aggregator',
        kind: 'text',
        defaultValue: null,
        hint: 'Name of the aggregator (a function or agent) that merges the answers. Empty uses the default.',
      }),
      intermediate,
      field(CHECKPOINT_STORAGE),
    ],
  },
  handoff: {
    builder: 'HandoffBuilder',
    summary: 'A coordinator triages each request and hands it off to the best participant.',
    managerKey: null,
    outputs: ['output_from'],
    keys: [
      participants,
      factories,
      field({
        key: 'start_agent',
        label: 'Start agent',
        kind: 'agent',
        defaultValue: null,
        hint: 'Who receives the request first. Defaults to this router.',
      }),
      ['handoffs', { from: 'handoffs' }],
      field(TERMINATION_CONDITION),
      field({
        key: 'enable_return_to_previous',
        label: 'Return to previous agent',
        kind: 'boolean',
        defaultValue: true,
        hint: 'Let a participant hand the conversation back to whoever handed it off.',
      }),
      field({
        key: 'interaction_mode',
        label: 'Interaction mode',
        kind: 'select',
        defaultValue: null,
        options: [
          { value: '', label: 'Framework default' },
          { value: 'human_in_loop', label: 'Human in the loop (ask the user between turns)' },
          { value: 'autonomous', label: 'Autonomous (agents continue on their own)' },
        ],
      }),
      field(REQUEST_INFO),
      field(REQUEST_HANDLER),
      field(CHECKPOINT_STORAGE),
      output,
    ],
  },
  'group-chat': {
    builder: 'GroupChatBuilder',
    summary: 'A manager picks who speaks next in a shared conversation until the task is done.',
    managerKey: 'manager',
    outputs: ['intermediate_output_from'],
    keys: [
      participants,
      factories,
      field({
        key: 'selection_func',
        label: 'Selection function',
        kind: 'text',
        defaultValue: null,
        hint: 'Name of a function that picks the next speaker instead of the manager, e.g. round_robin.',
      }),
      ['manager', { from: 'manager' }],
      field({
        key: 'max_rounds',
        label: 'Max rounds',
        kind: 'number',
        defaultValue: null,
        min: 1,
        hint: 'Stop after this many turns. Empty means no limit.',
      }),
      field(TERMINATION_CONDITION),
      field(CHECKPOINT_STORAGE),
      field(REQUEST_INFO),
      field(REQUEST_HANDLER),
      intermediate,
    ],
  },
  magentic: {
    builder: 'MagenticBuilder',
    summary: 'A manager plans the task, tracks progress in ledgers and delegates to participants.',
    managerKey: 'manager_agent',
    outputs: ['intermediate_output_from'],
    keys: [
      participants,
      factories,
      ['manager_agent', { from: 'manager' }],
      field({
        key: 'task_ledger',
        label: 'Task ledger',
        kind: 'textarea',
        defaultValue: null,
        section: 'Manager prompts',
        hint: 'A starting task ledger (facts and plan). Empty builds it from the task.',
      }),
      field(PROMPT('task_ledger_facts_prompt', 'Facts prompt', 'Gathers the facts for the task ledger.')),
      field(PROMPT('task_ledger_plan_prompt', 'Plan prompt', 'Drafts the plan.')),
      field(PROMPT('task_ledger_full_prompt', 'Full ledger prompt', 'Combines facts and plan.')),
      field(PROMPT('task_ledger_facts_update_prompt', 'Facts update prompt', 'Updates the facts on re-plan.')),
      field(PROMPT('task_ledger_plan_update_prompt', 'Plan update prompt', 'Updates the plan on re-plan.')),
      field(PROMPT('progress_ledger_prompt', 'Progress ledger prompt', 'Checks progress each round.')),
      field(PROMPT('final_answer_prompt', 'Final answer prompt', 'Writes the final answer.')),
      field({
        key: 'max_stall_count',
        label: 'Max stall count',
        kind: 'number',
        defaultValue: 3,
        min: 0,
        hint: 'Rounds without progress before the manager re-plans.',
      }),
      field({
        key: 'max_reset_count',
        label: 'Max reset count',
        kind: 'number',
        defaultValue: null,
        min: 0,
        hint: 'How many times the plan may be reset. Empty means no limit.',
      }),
      field({
        key: 'max_round_count',
        label: 'Max rounds',
        kind: 'number',
        defaultValue: null,
        min: 1,
        hint: 'Most coordination rounds before stopping. Empty means no limit.',
      }),
      field({
        key: 'enable_plan_review',
        label: 'Plan review',
        kind: 'boolean',
        defaultValue: false,
        hint: 'A person approves the manager’s plan before work starts.',
      }),
      field({
        key: 'human_input_on_stall',
        label: 'Human input on stall',
        kind: 'boolean',
        defaultValue: false,
        hint: 'Ask a person for guidance when the team stalls.',
      }),
      field(CHECKPOINT_STORAGE),
      intermediate,
    ],
  },
}

/** The editable settings of a builder (what the form shows), in builder order. */
export function builderFields(pattern: OrchestrationPattern): BuilderField[] {
  return BUILDER_SPECS[pattern].keys.flatMap(([, key]) => (key.from === 'field' ? [key.field] : []))
}

export type WorkflowConfigValues = Record<string, unknown>

/** A field's current value: what the user set, else its default. */
export function fieldValue(field: BuilderField, values: WorkflowConfigValues | undefined): unknown {
  const value = values?.[field.key]
  return value === undefined ? field.defaultValue : value
}

/**
 * Handoff routes from the canvas: the router can hand off to every participant, and a participant
 * to any teammate it's connected to.
 */
function handoffRoutes(diagram: Diagram, routerId: string, participantIds: string[]) {
  const team = new Set(participantIds)
  return [routerId, ...participantIds].flatMap((source) => {
    const targets =
      source === routerId
        ? participantIds
        : diagram.edges.filter((edge) => edge.from === source && team.has(edge.to) && edge.to !== source).map((edge) => edge.to)
    return targets.length > 0 ? [{ source, targets: [...new Set(targets)] }] : []
  })
}

/**
 * A workflow node's builder and its configuration, once, keyed and ordered as the builder
 * defines it: canvas-derived keys filled in, settings with their defaults, empty text as `null`.
 */
export function builderConfig(
  pattern: OrchestrationPattern,
  orchestrator: DiagramNode,
  participantIds: string[],
  diagram: Diagram,
): { builder: string; config: Record<string, unknown> } {
  const spec = BUILDER_SPECS[pattern]
  const values = orchestrator.agent?.workflowConfig
  const config: Record<string, unknown> = {}
  for (const [name, key] of spec.keys) {
    if (key.from === 'participants') config[name] = participantIds
    else if (key.from === 'factories') config[name] = []
    else if (key.from === 'manager') config[name] = orchestrator.id
    else if (key.from === 'handoffs') config[name] = handoffRoutes(diagram, orchestrator.id, participantIds)
    else if (key.from === 'outputs') {
      const list = values?.[key.list]
      config[name] = Array.isArray(list) ? list.filter((id) => participantIds.includes(String(id))) : []
    } else {
      let value = fieldValue(key.field, values)
      if (key.field.key === 'start_agent' && value == null) value = orchestrator.id
      if (typeof value === 'string' && !value.trim()) value = null
      config[name] = value
    }
  }
  return { builder: spec.builder, config }
}

/** The team (participants) of a workflow node on the canvas. */
export function teamOfWorkflowNode(diagram: Diagram, nodeId: string): string[] {
  return findOrchestrations(diagram).find((item) => item.orchestratorId === nodeId)?.participantIds ?? []
}
