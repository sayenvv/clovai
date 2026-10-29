/**
 * The canvas as a workflow format 4.0 document (backend `docs/workflow-format.md`), driven by the
 * workflow generation spec that admins publish in the Admin Center.
 *
 * The spec decides what each block becomes (its role) and how its settings map to 4.0 fields. This
 * file applies the roles' graph work, which stays in code: orchestrator teams become `delegate` or
 * `handoff` edges, Sequential and Concurrent blocks dissolve into plain edges, Switch blocks become
 * `next: "choose"` with CEL conditions, approvals are inserted on connectors, and Start, End, branch
 * and join modes are filled in. Every id is a UUID; ids the canvas did not create as UUIDs get a
 * stable one.
 */

import { pageWorkflowId } from '@/components/agent-workflow/page-workflow-id'
import { findOrchestrations } from '@/components/agent-workflow/orchestration-patterns'
import { isSubWorkflowNode } from '@/components/agent-workflow/sub-workflow-ops'
import { normalizeExecutorSource } from '@/components/agent-workflow/executor-source'
import { isExternalAgentPalette, resolveExternalAgent } from '@/components/agent-workflow/agent-workflow-defaults'
import {
  isAgentNode,
  isExecutorNode,
  isToolNode,
  listToolsForAgent,
} from '@/components/agent-workflow/tool-agent-mapping'
import { parseCondition } from '@/components/agent-workflow/workflow-edge-groups'
import {
  DEFAULT_WORKFLOW_MODEL_CONFIG,
  resolveWorkflowModelConfig,
  agentOwnModel,
  WORKFLOW_CONNECTION_NAME,
  WORKFLOW_MODEL_PRESET,
  workflowActiveModelConfig,
} from '@/components/agent-workflow/workflow-model-config'
import { getWorkflowConfiguration, type WorkflowConfiguration } from '@/services/workflow-configuration-store'
import type { Diagram, DiagramDocument, DiagramEdge, DiagramNode } from '@/components/designer/diagram-types'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import type {
  SpecBlockRule,
  SpecMatch,
  SpecRole,
  WorkflowGenerationSpec,
} from '@/types/workflow-generation-spec'
import { slugifyIdentifier } from '@/utils/slug'
import {
  WORKFLOW_V4_VERSION,
  type AgentV4,
  type ConnectionV4,
  type EdgeV4,
  type Expr,
  type KnowledgeV4,
  type ModelV4,
  type NodeV4,
  type SubworkflowV4,
  type ToolV4,
  type TriggerV4,
  type WorkflowV4Document,
} from '@/types/workflow-v4'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A UUID derived from `seed` (cyrb128 hash, version 8): the same seed always gives the same id. */
export function stableUuid(seed: string): string {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('')
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** `id` when it is a UUID, else a stable UUID for it. */
function asUuid(kind: string, id: string): string {
  return UUID_PATTERN.test(id) ? id : stableUuid(`${kind}:${id}`)
}

// ---- Spec values

type Sources = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function lookup(sources: Sources, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), sources)
}

function missing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim())
}

/** A spec value resolved against a block's sources; `undefined` means "leave the field out". */
export function resolveSpecValue(spec: unknown, sources: Sources): unknown {
  if (Array.isArray(spec)) {
    return spec.map((item) => resolveSpecValue(item, sources)).filter((item) => item !== undefined)
  }
  if (!isRecord(spec)) return spec
  if ('literal' in spec) return spec.literal
  if ('when' in spec) {
    const condition = resolveSpecValue(spec.when, sources)
    return condition && condition !== '0' ? resolveSpecValue(spec.then, sources) : undefined
  }
  if (typeof spec.from === 'string') {
    let value = lookup(sources, spec.from)
    if (spec.parse === 'json' && typeof value === 'string') {
      try {
        value = value.trim() ? (JSON.parse(value) as unknown) : undefined
      } catch {
        value = undefined
      }
    }
    if (isRecord(spec.map)) {
      const key = String(value)
      value = key in spec.map ? spec.map[key] : 'default' in spec ? undefined : value
    }
    if (missing(value)) return 'default' in spec ? resolveSpecValue(spec.default, sources) : undefined
    if (spec.type === 'number') {
      const number = Number(value)
      if (!Number.isFinite(number)) return 'default' in spec ? resolveSpecValue(spec.default, sources) : undefined
      value = number
    } else if (spec.type === 'boolean') {
      value = value === true || value === 'true'
    } else if (spec.type === 'string') {
      value = String(value)
    }
    if (typeof spec.multiply === 'number' && typeof value === 'number') value = value * spec.multiply
    if (typeof spec.prefix === 'string') value = `${spec.prefix}${String(value)}`
    return value
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(spec)) {
    const resolved = resolveSpecValue(value, sources)
    if (resolved !== undefined) out[key] = resolved
  }
  return out
}

function resolveSet(set: Record<string, unknown> | undefined, sources: Sources): Record<string, unknown> {
  return set ? (resolveSpecValue(set, sources) as Record<string, unknown>) : {}
}

function celLiteral(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  if (Array.isArray(value)) return `[${value.map(celLiteral).join(', ')}]`
  return String(value)
}

/** A connector condition (`category == "billing"`, `text contains "refund"`) as CEL over the previous output. */
export function conditionToCel(expression: string): Expr | undefined {
  const condition = parseCondition(expression)
  if (!condition) return undefined
  if (!condition.field || !condition.op) return `{{ ${condition.expression} }}`
  // A canvas has no shared state: `state.label` is the previous agent's `label`, which it returns (see conditionFields)
  const name = condition.field.replace(/^(state|output|last\.output)\./, '')
  const field = condition.field === 'text' ? 'string(last.output)' : `last.output.${name}`
  const value = celLiteral(condition.value)
  switch (condition.op) {
    case 'exists':
      return condition.field === 'text' ? '{{ size(string(last.output)) > 0 }}' : `{{ has(${field}) }}`
    case 'equals':
      return `{{ ${field} == ${value} }}`
    case 'not_equals':
      return `{{ ${field} != ${value} }}`
    case 'gt':
      return `{{ ${field} > ${value} }}`
    case 'gte':
      return `{{ ${field} >= ${value} }}`
    case 'lt':
      return `{{ ${field} < ${value} }}`
    case 'lte':
      return `{{ ${field} <= ${value} }}`
    case 'contains':
      return `{{ ${field}.contains(${value}) }}`
    case 'in':
      return `{{ ${field} in ${value} }}`
    default:
      return `{{ ${condition.expression} }}`
  }
}

/** The output fields of `agentId` that conditions on its agent nodes' outgoing edges read (`last.output.<field>`). */
function conditionFields(edges: EdgeV4[], nodes: NodeV4[], agentId: string): string[] {
  const nodeIds = new Set(nodes.filter((node) => node.type === 'agent' && node.agentId === agentId).map((node) => node.id))
  const fields = new Set<string>()
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !edge.when) continue
    for (const match of edge.when.matchAll(/last\.output\.([A-Za-z_]\w*)/g)) fields.add(match[1])
  }
  return [...fields]
}

// ---- Matching blocks to rules

interface BlockFacts {
  node: DiagramNode
  pattern?: string
}

function oneOf(expected: string | string[] | undefined, actual: string | undefined): boolean {
  if (expected === undefined) return true
  return actual !== undefined && (Array.isArray(expected) ? expected.includes(actual) : expected === actual)
}

function matches(match: SpecMatch, { node, pattern }: BlockFacts, sources: Sources): boolean {
  if (!oneOf(match.paletteId, node.paletteId)) return false
  if (!oneOf(match.pattern, pattern)) return false
  if (!oneOf(match.agentType, node.agent?.agentType)) return false
  if (match.attached !== undefined && match.attached !== isToolNode(node)) return false
  if (match.executor !== undefined && match.executor !== isExecutorNode(node)) return false
  if (match.subworkflow !== undefined && match.subworkflow !== isSubWorkflowNode(node)) return false
  if (match.external !== undefined && match.external !== isExternalAgentPalette(node.paletteId)) return false
  if (match.agent !== undefined && match.agent !== isAgentNode(node)) return false
  if (match.has !== undefined && missing(lookup(sources, match.has))) return false
  return true
}

function blockSources(node: DiagramNode): Sources {
  return {
    agent: node.agent ?? {},
    config: node.agent?.workflowConfig ?? {},
    node: { label: node.label, paletteId: node.paletteId, slug: slugifyIdentifier(node.label, 'block') },
  }
}

export interface BuildWorkflowV4Options {
  doc: DiagramDocument
  pageId: string
  diagram: Diagram
  /** The published generation spec (Admin Center). */
  spec: WorkflowGenerationSpec
  serverModelConfig?: WorkflowModelConfig
  /** Configuration tab settings; read from the store when not passed. */
  configuration?: WorkflowConfiguration
}

/** Serialize the canvas into a workflow format 4.0 document, following the generation spec. */
export function buildWorkflowV4({
  doc,
  pageId,
  diagram,
  spec,
  serverModelConfig,
  configuration,
}: BuildWorkflowV4Options): WorkflowV4Document {
  const page = doc.pages.find((candidate) => candidate.id === pageId)
  const workflowId = pageWorkflowId(doc, pageId)
  const settings = configuration ?? getWorkflowConfiguration(workflowId)
  const defaults = spec.defaults ?? {}
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]))
  const nodeUuid = (id: string) => asUuid('node', id)

  // ---- What each canvas block becomes: the first spec rule that matches it
  const orchestrations = findOrchestrations(diagram)
  const orchestrationOf = new Map(orchestrations.map((item) => [item.orchestratorId, item]))
  const ruleOf = new Map<string, SpecBlockRule | undefined>()
  for (const node of diagram.nodes) {
    const facts = { node, pattern: orchestrationOf.get(node.id)?.pattern }
    const sources = blockSources(node)
    ruleOf.set(node.id, spec.blocks.find((rule) => matches(rule.match ?? {}, facts, sources)))
  }
  const roleOf = (id: string): SpecRole | undefined => ruleOf.get(id)?.role ?? (nodesById.has(id) ? 'skip' : undefined)

  // ---- Models and connections
  // The workflow's own model wins; the server's is the fallback when the workflow never picked one
  const workflowModel = serverModelConfig
    ? workflowActiveModelConfig(doc.workflow, serverModelConfig)
    : resolveWorkflowModelConfig(doc.workflow?.modelConfig ?? DEFAULT_WORKFLOW_MODEL_CONFIG)
  const connections = new Map<string, ConnectionV4>()
  const models = new Map<string, ModelV4>()
  const defaultConnectionId = stableUuid(`connection:default:${workflowId}`)
  connections.set(defaultConnectionId, {
    id: defaultConnectionId,
    name: WORKFLOW_CONNECTION_NAME,
    provider: workflowModel.provider,
    // The model client picked for the workflow; without one the server uses the application's for the provider
    credentialId: workflowModel.connectionId ?? stableUuid(`credential:default:${workflowId}`),
  })
  const modelFor = (model: string, temperature: number | undefined, provider?: string, connection?: string) => {
    let connectionId = defaultConnectionId
    if (connection) {
      connectionId = asUuid('connection', connection)
      if (!connections.has(connectionId)) {
        connections.set(connectionId, {
          id: connectionId,
          name: `Model connection ${connections.size}`,
          provider: provider || workflowModel.provider,
          credentialId: connectionId,
        })
      }
    }
    const inherits = !model.trim() && !connection
    const raw = model.trim() || workflowModel.model
    const name = raw.includes('/') ? raw.split('/').slice(1).join('/') : raw
    const id = stableUuid(`model:${inherits ? 'workflow' : connectionId}:${raw}:${temperature ?? ''}`)
    if (!models.has(id)) {
      models.set(id, {
        id,
        // Read back on import: agents on this preset have no model of their own
        name: inherits ? WORKFLOW_MODEL_PRESET : name,
        connectionId,
        model: name,
        params: { temperature: temperature ?? workflowModel.temperature, maxTokens: workflowModel.maxTokens },
      })
    }
    return id
  }

  // ---- Agents, their tools, memory and knowledge
  const agents: AgentV4[] = []
  const tools: ToolV4[] = []
  const knowledge = new Map<string, KnowledgeV4>()
  const agentIdOf = new Map<string, string>()

  for (const node of diagram.nodes) {
    const rule = ruleOf.get(node.id)
    if (rule?.role !== 'agent') continue
    const config = node.agent
    const sources = blockSources(node)
    const id = stableUuid(`agent:${nodeUuid(node.id)}`)
    agentIdOf.set(node.id, id)
    const extra = resolveSet(rule.agentSet, sources)
    if (isExternalAgentPalette(node.paletteId)) {
      agents.push({
        id,
        name: node.label,
        kind: 'external',
        ...(config?.description ? { description: config.description } : {}),
        provider: resolveExternalAgent(node.paletteId)?.provider ?? node.paletteId.replace(/^aw-ext-/, ''),
        config: {},
        ...extra,
      } as AgentV4)
      continue
    }
    const toolIds: string[] = []
    let longTerm = false
    for (const child of listToolsForAgent(diagram, node.id)) {
      const childSources = blockSources(child)
      const toolRule = (spec.tools ?? []).find((candidate) =>
        matches(candidate.match ?? {}, { node: child }, childSources),
      )
      if (!toolRule) continue
      if (toolRule.kind === 'memory') {
        longTerm = true
        continue
      }
      const fields = { ...resolveSet(spec.toolCommon, childSources), ...resolveSet(toolRule.set, childSources) }
      const tool = { id: asUuid('tool', child.id), name: child.label, ...fields } as ToolV4
      if (tool.kind === 'function') tool.handlerId = stableUuid(`handler:${tool.handler}`)
      if (!tools.some((existing) => existing.id === tool.id)) tools.push(tool)
      toolIds.push(tool.id)
    }
    const knowledgeIds = (config?.contextProviderIds ?? []).map((providerId) => {
      const knowledgeId = stableUuid(`knowledge:${providerId}`)
      if (!knowledge.has(knowledgeId)) {
        knowledge.set(knowledgeId, {
          id: knowledgeId,
          name: providerId,
          collectionId: asUuid('collection', providerId),
          topK: defaults.knowledgeTopK ?? 6,
        })
      }
      return knowledgeId
    })
    const responseSchema = resolveSpecValue({ from: 'agent.outputSchema', parse: 'json' }, sources)
    agents.push({
      id,
      name: node.label,
      kind: 'native',
      ...(config?.description ? { description: config.description } : {}),
      instructions: config?.instructions ?? '',
      modelId: modelFor(agentOwnModel(config), config?.temperature, config?.modelProvider, config?.modelConnectionId),
      toolIds,
      ...(knowledgeIds.length ? { knowledgeIds } : {}),
      ...(config?.memoryEnabled || longTerm ? { memory: { conversation: true, longTerm } } : {}),
      ...(isRecord(responseSchema) ? { responseSchema } : {}),
      ...extra,
    } as AgentV4)
  }

  // ---- Graph nodes
  const nodes: NodeV4[] = []
  const subworkflows: SubworkflowV4[] = []
  const triggers: TriggerV4[] = []
  const notes: WorkflowV4Document['canvas']['pages'][number]['notes'] = []
  const layout: Record<string, { x: number; y: number }> = {}
  const place = (id: string, x: number, y: number) => {
    layout[id] = { x: Math.round(x), y: Math.round(y) }
  }

  for (const node of diagram.nodes) {
    const rule = ruleOf.get(node.id)
    const id = nodeUuid(node.id)
    const fields = resolveSet(rule?.set, blockSources(node))
    switch (rule?.role) {
      case 'start':
        nodes.push({ id, name: node.label || 'Start', type: 'start', ...fields } as NodeV4)
        place(id, node.x, node.y)
        break
      case 'end':
        nodes.push({ id, name: node.label || 'End', type: 'end', output: defaults.endOutput, ...fields } as NodeV4)
        place(id, node.x, node.y)
        break
      case 'trigger':
        triggers.push({ id: asUuid('trigger', node.id), name: node.label, ...fields } as TriggerV4)
        break
      case 'note':
        notes.push({ id, text: node.label, x: Math.round(node.x), y: Math.round(node.y) })
        break
      case 'subworkflow': {
        const subPage = doc.pages.find((candidate) => candidate.id === node.subWorkflowPageId)
        const subworkflowId = stableUuid(`subworkflow:${id}`)
        subworkflows.push({
          id: subworkflowId,
          name: subPage?.name ?? node.label,
          workflowRef: {
            library: 'workflow',
            id: asUuid('workflow', subPage?.workflowId ?? node.subWorkflowPageId ?? node.id),
            version: 'latest',
          },
          inputs: {},
          outputs: {},
        })
        nodes.push({ id, name: node.label, type: 'subworkflow', subworkflowId, ...fields } as NodeV4)
        place(id, node.x, node.y)
        break
      }
      case 'code': {
        const code = { id, name: node.label, type: 'code', ...fields } as Extract<NodeV4, { type: 'code' }>
        code.source = normalizeExecutorSource(code.source ?? '')
        nodes.push(code)
        place(id, node.x, node.y)
        break
      }
      case 'step':
        // The rule names the node type and its fields (ask user, delay, wait for event)
        nodes.push({ id, name: node.label, ...fields } as NodeV4)
        place(id, node.x, node.y)
        break
      case 'approval':
        nodes.push({ id, name: node.label, type: 'approval', ...fields } as NodeV4)
        place(id, node.x, node.y)
        break
      case 'agent':
        nodes.push({ id, name: node.label, type: 'agent', agentId: agentIdOf.get(node.id)!, ...fields } as NodeV4)
        place(id, node.x, node.y)
        break
      default:
        break
    }
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  // Steps with one way out still name it on their connector, as the format requires
  const SINGLE_OUTCOME: Record<string, string> = { ask_user: 'replied', wait_event: 'event' }
  const outcomeOf = (nodeId: string) => {
    const type: string | undefined = nodeById.get(nodeId)?.type
    return type ? SINGLE_OUTCOME[type] : undefined
  }

  // ---- Edges
  const edges: EdgeV4[] = []
  const edgeKeys = new Set<string>()
  const addEdge = (edge: Omit<EdgeV4, 'id'>, seed?: string) => {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) return
    const key = `${edge.from}>${edge.to}:${edge.type ?? 'next'}:${edge.on ?? ''}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ id: seed && UUID_PATTERN.test(seed) ? seed : stableUuid(`edge:${seed ?? key}`), ...edge })
  }
  const outsideGraph = new Set<SpecRole>(['attached', 'note', 'skip'])
  const flowEdges = diagram.edges.filter((edge) => {
    const from = roleOf(edge.from)
    const to = roleOf(edge.to)
    return from && to && !outsideGraph.has(from) && !outsideGraph.has(to)
  })
  const notInGraph = new Set<SpecRole>(['switch', 'chain', 'parallel', 'trigger', 'attached', 'note', 'skip'])
  const isFlow = (id: string) => {
    const role = roleOf(id)
    return role !== undefined && !notInGraph.has(role)
  }

  // A start node: the canvas's own, else one placed before the first nodes.
  const startId = diagram.nodes.find((node) => roleOf(node.id) === 'start')?.id
  const startUuid = startId ? nodeUuid(startId) : stableUuid(`start:${workflowId}`)
  if (!startId) {
    nodes.unshift({ id: startUuid, name: 'Start', type: 'start' })
    nodeById.set(startUuid, nodes[0])
    const first = diagram.nodes.filter((node) => isFlow(node.id))
    place(startUuid, Math.min(0, ...first.map((node) => node.x)) - 160, first[0]?.y ?? 0)
  }

  // Teams, handoff peers and dissolved blocks
  const teamMembers = new Set<string>()
  const chooseSources = new Set<string>()
  const allSources = new Set<string>()
  const joinAllTargets = new Set<string>()
  const groups: WorkflowV4Document['canvas']['pages'][number]['groups'] = []
  const dissolvedBlocks = new Set<string>()
  const teamEdges = new Set<string>()
  for (const orchestration of orchestrations) {
    const rule = ruleOf.get(orchestration.orchestratorId)
    const lead = nodeUuid(orchestration.orchestratorId)
    const leadNode = nodesById.get(orchestration.orchestratorId)
    // Only agents join an agent's team; its connector to any other block (an approval, a tool) is a step after the team
    const members = orchestration.participantIds.filter((id) => isFlow(id) && (rule?.role !== 'agent' || roleOf(id) === 'agent'))
    if (rule?.role === 'agent' && rule.team === 'delegate') {
      for (const member of members) {
        teamMembers.add(member)
        teamEdges.add(`${orchestration.orchestratorId}>${member}`)
        addEdge({ from: lead, to: nodeUuid(member), type: 'delegate' })
      }
      groups.push({ id: stableUuid(`group:${lead}`), label: `${leadNode?.label ?? 'Team'} team`, nodeIds: [lead, ...members.map(nodeUuid)] })
    } else if (rule?.role === 'agent' && rule.team === 'handoff') {
      const leadHandoff = nodeById.get(lead)
      for (const member of members) {
        teamMembers.add(member)
        teamEdges.add(`${orchestration.orchestratorId}>${member}`)
        const memberNode = nodesById.get(member)
        const peer = nodeById.get(nodeUuid(member))
        if (peer?.type === 'agent' && leadHandoff?.type === 'agent' && !peer.handoff && leadHandoff.handoff) {
          peer.handoff = { ...leadHandoff.handoff }
        }
        addEdge({ from: lead, to: nodeUuid(member), type: 'handoff', description: memberNode?.agent?.description || memberNode?.label })
        addEdge({ from: nodeUuid(member), to: lead, type: 'handoff', description: leadNode?.agent?.description || leadNode?.label })
      }
    } else if (rule?.role === 'chain' || rule?.role === 'parallel') {
      // What led into the block leads into its participants; what it led to follows them.
      const block = orchestration.orchestratorId
      dissolvedBlocks.add(block)
      for (const member of orchestration.participantIds) teamEdges.add(`${block}>${member}`)
      const incoming = flowEdges.filter((edge) => edge.to === block).map((edge) => edge.from)
      const outgoing = flowEdges.filter((edge) => edge.from === block && !members.includes(edge.to)).map((edge) => edge.to)
      const ids = (list: string[]) => list.map((id) => (roleOf(id) === 'trigger' ? startUuid : nodeUuid(id)))
      const sources = incoming.length ? ids(incoming) : [startUuid]
      if (rule.role === 'chain') {
        const chain = [sources[0], ...ids(members)]
        for (const source of sources.slice(1)) addEdge({ from: source, to: chain[1] ?? chain[0] })
        for (let index = 0; index + 1 < chain.length; index++) addEdge({ from: chain[index], to: chain[index + 1] })
        for (const target of ids(outgoing)) addEdge({ from: chain[chain.length - 1], to: target })
      } else {
        for (const source of sources) {
          allSources.add(source)
          for (const member of ids(members)) addEdge({ from: source, to: member })
        }
        for (const target of ids(outgoing)) {
          joinAllTargets.add(target)
          for (const member of ids(members)) addEdge({ from: member, to: target })
        }
      }
    }
  }

  // Approval inserted on a connector (connector or agent human-in-the-loop setting)
  const pendingRejected: string[] = []
  const approvalBetween = (edge: DiagramEdge, from: string, to: string) => {
    const source = nodesById.get(edge.from)?.agent
    const config = edge.connector?.humanApproval ? edge.connector : source
    const approvalId = stableUuid(`approval:${edge.id}`)
    const fields = resolveSet(spec.connectors?.approval?.set, { approval: config ?? {} })
    const approval = { id: approvalId, name: `Approve ${nodesById.get(edge.to)?.label ?? 'next step'}`, type: 'approval', ...fields } as NodeV4
    nodes.push(approval)
    nodeById.set(approvalId, approval)
    const a = layout[from]
    const b = layout[to]
    if (a && b) place(approvalId, (a.x + b.x) / 2, (a.y + b.y) / 2 + 40)
    addEdge({ from, to: approvalId }, edge.id)
    addEdge({ from: approvalId, to, on: 'approved' })
    if (config?.feedbackRevisionsEnabled) {
      addEdge({ from: approvalId, to: from, on: 'rejected', maxTraversals: config.maxFeedbackRevisions ?? 5 })
    } else {
      pendingRejected.push(approvalId)
    }
  }
  const whenOf = (connectorCondition: string | undefined) =>
    spec.connectors?.conditionToWhen === false ? undefined : conditionToCel(connectorCondition ?? '')

  for (const edge of flowEdges) {
    const fromRole = roleOf(edge.from)
    const toRole = roleOf(edge.to)
    if (teamEdges.has(`${edge.from}>${edge.to}`)) continue
    if (dissolvedBlocks.has(edge.from) || dissolvedBlocks.has(edge.to)) continue
    if (fromRole === 'switch') continue
    const from = fromRole === 'trigger' ? startUuid : nodeUuid(edge.from)
    if (toRole === 'switch') {
      // Switch: every input gets the Switch's cases as `choose` edges.
      for (const out of flowEdges.filter((candidate) => candidate.from === edge.to)) {
        const when = whenOf(out.connector?.condition)
        addEdge({ from, to: nodeUuid(out.to), ...(when ? { when } : {}) }, `${edge.id}__${out.id}`)
      }
      chooseSources.add(from)
      continue
    }
    const to = nodeUuid(edge.to)
    const source = nodesById.get(edge.from)
    const needsApproval =
      // An approval block already is the approval; another one after it would wait twice
      fromRole !== 'approval' &&
      (Boolean(edge.connector?.humanApproval) || (Boolean(source?.agent?.humanInTheLoop) && fromRole === 'agent'))
    if (needsApproval) {
      approvalBetween(edge, from, to)
      continue
    }
    const when = fromRole === 'approval' ? undefined : whenOf(edge.connector?.condition)
    const on = fromRole === 'approval' ? 'approved' : outcomeOf(from)
    addEdge({ from, to, ...(when ? { when } : {}), ...(on ? { on } : {}) }, edge.id)
    if (fromRole === 'approval') {
      const reviewer = source?.agent
      const back = flowEdges.find((incoming) => incoming.to === edge.from)?.from
      if (reviewer?.feedbackRevisionsEnabled && back) {
        addEdge({ from, to: nodeUuid(back), on: 'rejected', maxTraversals: reviewer.maxFeedbackRevisions ?? 5 })
      } else {
        pendingRejected.push(from)
      }
    }
    if (edge.connector?.errorPath?.trim()) {
      const target = diagram.nodes.find((node) => node.label === edge.connector!.errorPath.trim())
      if (target && isFlow(target.id)) addEdge({ from, to: nodeUuid(target.id), type: 'error' })
    }
  }

  // Nodes with no way in start from Start; nodes with no way out end at End.
  const memberIds = new Set([...teamMembers].map(nodeUuid))
  for (const node of nodes) {
    if (node.type === 'start' || node.type === 'end' || memberIds.has(node.id)) continue
    if (!edges.some((edge) => edge.to === node.id)) addEdge({ from: startUuid, to: node.id })
  }
  let endNode = nodes.find((node) => node.type === 'end')
  const needsEnd = nodes.filter((node) => {
    if (node.type === 'end' || memberIds.has(node.id)) return false
    return !edges.some((edge) => edge.from === node.id && (edge.type ?? 'next') === 'next' && edge.on !== 'rejected')
  })
  if (!endNode && (needsEnd.length || pendingRejected.length)) {
    const endId = stableUuid(`end:${workflowId}`)
    endNode = { id: endId, name: 'End', type: 'end', output: defaults.endOutput }
    nodes.push(endNode)
    nodeById.set(endId, endNode)
    const right = Math.max(0, ...Object.values(layout).map((point) => point.x))
    place(endId, right + 200, layout[startUuid]?.y ?? 0)
  }
  if (endNode) {
    for (const node of needsEnd) {
      // An approval ends on both outcomes: approved goes on to End, rejected ends there too unless it loops back
      if (node.type === 'approval') {
        addEdge({ from: node.id, to: endNode.id, on: 'approved' })
        if (edges.some((edge) => edge.from === node.id && edge.on === 'rejected')) continue
        // With feedback revisions, rejected goes back to the step before for another try
        const block = diagram.nodes.find((candidate) => nodeUuid(candidate.id) === node.id)
        const back = block ? flowEdges.find((incoming) => incoming.to === block.id)?.from : undefined
        if (block?.agent?.feedbackRevisionsEnabled && back) {
          addEdge({ from: node.id, to: nodeUuid(back), on: 'rejected', maxTraversals: block.agent.maxFeedbackRevisions ?? 5 })
        } else {
          pendingRejected.push(node.id)
        }
      } else {
        const on = outcomeOf(node.id)
        addEdge({ from: node.id, to: endNode.id, ...(on ? { on } : {}) })
      }
    }
    for (const approvalId of new Set(pendingRejected)) addEdge({ from: approvalId, to: endNode.id, on: 'rejected' })
  }

  // Agents whose output a condition reads return those fields, so the condition has something to read
  for (const agent of agents) {
    if (agent.kind !== 'native') continue
    const fields = conditionFields(edges, nodes, agent.id)
    if (fields.length === 0) continue
    const current = isRecord(agent.responseSchema) ? agent.responseSchema : {}
    const shortForm = Object.values(current).every((value) => typeof value === 'string')
    if (!shortForm || current.type) continue
    agent.responseSchema = { result: 'string', ...current, ...Object.fromEntries(fields.filter((field) => !(field in current)).map((field) => [field, 'string'])) }
  }

  // ---- Branch and join modes
  const nexts = (id: string) => edges.filter((edge) => edge.from === id && (edge.type ?? 'next') === 'next' && !edge.on)
  for (const node of nodes) {
    const out = nexts(node.id)
    if (out.length > 1 && node.type !== 'condition' && node.type !== 'approval') {
      node.next = chooseSources.has(node.id) || out.some((edge) => edge.when) ? 'choose' : 'all'
      if (node.next === 'all') allSources.add(node.id)
    }
  }
  for (const node of nodes) {
    const incoming = edges.filter((edge) => edge.to === node.id && ((edge.type ?? 'next') === 'next' || edge.type === 'error'))
    if (incoming.length < 2) continue
    const forks = incoming.map(
      (edge) => new Set(edges.filter((fork) => fork.to === edge.from && allSources.has(fork.from)).map((fork) => fork.from)),
    )
    const shared = [...forks[0]].some((fork) => forks.every((set) => set.has(fork)))
    node.join = joinAllTargets.has(node.id) || shared ? 'all' : 'any'
  }

  // ---- Document
  const now = new Date().toISOString()
  const defaultTriggers = (defaults.triggers ?? []).map(
    (trigger) => ({ id: stableUuid(`trigger:${String(trigger.type)}:${workflowId}`), ...trigger }) as TriggerV4,
  )
  return {
    $comment: 'Generated from the canvas. Workflow format 4.0: every id is a UUID; see docs/workflow-format.md.',
    schemaVersion: WORKFLOW_V4_VERSION,
    meta: {
      id: asUuid('workflow', workflowId),
      name: page?.name ?? 'Untitled workflow',
      description: '',
      version: doc.workflow?.version ?? 1,
      status: doc.workflow?.status === 'deployed' ? 'published' : 'draft',
      tags: [],
      migratedFrom: null,
      createdAt: now,
      updatedAt: now,
    },
    expressions: { language: 'cel', roots: defaults.expressionRoots ?? [] },
    triggers: triggers.length ? triggers : defaultTriggers,
    inputs: defaults.inputs ?? { type: 'object', properties: {} },
    outputs: defaults.outputs ?? { type: 'object', properties: {} },
    variables: [],
    state: (defaults.state ?? {}) as WorkflowV4Document['state'],
    connections: [...connections.values()],
    models: [...models.values()],
    middlewares: [],
    tools,
    knowledge: [...knowledge.values()],
    workspace: null,
    agents,
    subworkflows,
    graph: { startNodeId: startUuid, nodes, edges },
    limits: { timeoutSeconds: settings.timeoutSeconds, maxSteps: settings.maxIterations, ...defaults.limits },
    settings: {
      middlewareIds: [],
      checkpointing: { enabled: settings.checkpointingEnabled, storage: 'postgres' },
      streaming: workflowModel.stream,
      observability: {
        tracing: settings.tracingEnabled,
        captureSensitiveData: settings.captureSensitiveData,
        persistExecutionHistory: settings.persistExecutionHistory,
        logLevel: settings.logLevel,
        openTelemetry: {
          enabled: settings.openTelemetryEnabled,
          exporter: settings.otelExporter,
          endpoint: settings.otelEndpoint,
          serviceName: settings.otelServiceName,
          sampleRate: settings.traceSampleRate,
          metricsEnabled: settings.metricsEnabled,
        },
      },
    },
    tests: [],
    canvas: {
      pages: [{ id: asUuid('page', pageId), name: page?.name ?? 'Main', layout, groups, notes, diagram, workflowId }],
    },
  }
}
