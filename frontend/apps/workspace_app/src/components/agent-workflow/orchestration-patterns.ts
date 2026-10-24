/**
 * Orchestrator blocks: placing one sets the workflow's pattern, and the agents it connects to
 * directly become its team (the participants the backend's Magentic / group-chat / handoff builders run).
 */

import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import type { WorkflowExecutionType } from '@/types/agent-workflow'
import { isAgentNode } from '@/components/agent-workflow/tool-agent-mapping'
import { builderConfig } from '@/components/agent-workflow/workflow-builder-config'

export const ORCHESTRATOR_PALETTE_ID = 'aw-orchestrator'
export const PLANNER_PALETTE_ID = 'aw-planner'
export const GROUP_MANAGER_PALETTE_ID = 'aw-group-manager'
export const ROUTER_PALETTE_ID = 'aw-router'
export const SEQUENTIAL_PALETTE_ID = 'aw-sequential'
export const CONCURRENT_PALETTE_ID = 'aw-concurrent'

export type OrchestrationPattern = 'sequential' | 'concurrent' | 'magentic' | 'group-chat' | 'handoff'

export const PATTERN_META: Record<
  OrchestrationPattern,
  { label: string; executionType: WorkflowExecutionType; teamLabel: string }
> = {
  sequential: { label: 'Sequential', executionType: 'sequential', teamLabel: 'Sequential step' },
  concurrent: { label: 'Concurrent', executionType: 'parallel', teamLabel: 'Concurrent branch' },
  magentic: { label: 'Magentic', executionType: 'dependency', teamLabel: 'Magentic team' },
  'group-chat': { label: 'Group chat', executionType: 'group-chat', teamLabel: 'Group chat member' },
  handoff: { label: 'Handoff', executionType: 'conditional', teamLabel: 'Handoff target' },
}

const PATTERN_BY_PALETTE: Record<string, OrchestrationPattern> = {
  [ORCHESTRATOR_PALETTE_ID]: 'magentic',
  [PLANNER_PALETTE_ID]: 'magentic',
  [GROUP_MANAGER_PALETTE_ID]: 'group-chat',
  [ROUTER_PALETTE_ID]: 'handoff',
  [SEQUENTIAL_PALETTE_ID]: 'sequential',
  [CONCURRENT_PALETTE_ID]: 'concurrent',
}

/** The pattern a node orchestrates, when it is an orchestrator block. */
export function orchestratorPattern(node: DiagramNode): OrchestrationPattern | undefined {
  return PATTERN_BY_PALETTE[node.paletteId] ?? (node.agent?.agentType === 'planner' ? 'magentic' : undefined)
}

export interface OrchestrationInfo {
  orchestratorId: string
  pattern: OrchestrationPattern
  /** Agents the orchestrator connects to directly (its team), in edge order. */
  participantIds: string[]
}

/** The agents the orchestrator connects to directly: its team (tools and other nodes skipped). */
function teamOf(diagram: Diagram, orchestratorId: string): string[] {
  const agentIds = new Set(diagram.nodes.filter(isAgentNode).map((node) => node.id))
  const team: string[] = []
  for (const edge of diagram.edges) {
    if (edge.from === orchestratorId && agentIds.has(edge.to) && !team.includes(edge.to)) team.push(edge.to)
  }
  return team
}

/** Every orchestrator on the canvas with its team, in canvas order. */
export function findOrchestrations(diagram: Diagram): OrchestrationInfo[] {
  return diagram.nodes
    .filter((node) => isAgentNode(node) && orchestratorPattern(node))
    .map((orchestrator) => ({
      orchestratorId: orchestrator.id,
      pattern: orchestratorPattern(orchestrator)!,
      participantIds: teamOf(diagram, orchestrator.id),
    }))
}

/** The workflow's first orchestrator and its team (it decides the run's pattern). */
export function findOrchestration(diagram: Diagram): OrchestrationInfo | undefined {
  return findOrchestrations(diagram)[0]
}

/** The pattern the workflow runs: an orchestrator on the canvas decides it, else the chosen type. */
export function resolveExecutionType(
  chosen: WorkflowExecutionType | undefined,
  diagram: Diagram,
): WorkflowExecutionType {
  const orchestration = findOrchestration(diagram)
  if (orchestration) return PATTERN_META[orchestration.pattern].executionType
  return chosen ?? 'sequential'
}

/** An orchestrator and its team, shown as one workflow in the exported JSON. */
/**
 * A workflow in the exported JSON: its Agent Framework builder (e.g. `MagenticBuilder`) and that
 * builder's whole configuration (participants, manager, outputs and settings), each said once.
 */
export interface SpecWorkflow {
  id: string
  name: string
  builder: string
  config: Record<string, unknown>
}

/**
 * The build spec with each orchestrator and its team grouped into `workflows[]`: edges into or
 * out of the team connect to the workflow instead of its agents, and edges inside the team are
 * dropped (the pattern decides the team's turns). For the Code view and export; the spec the
 * backend runs stays flat.
 */
export function groupSpecWorkflows<
  Spec extends { edges: Array<{ id: string; fromAgentId: string; toAgentId: string }> },
>(spec: Spec, diagram: Diagram): Spec & { workflows: SpecWorkflow[] } {
  const orchestrations = findOrchestrations(diagram)
  if (orchestrations.length === 0) return { ...withoutBuilderMetadata(spec), workflows: [] }
  // Each agent maps to the workflow it belongs to (an orchestrator or one of its team).
  const workflowOf = new Map<string, string>()
  const workflows = orchestrations.map((orchestration) => {
    const id = `wf_${orchestration.orchestratorId}`
    for (const member of [orchestration.orchestratorId, ...orchestration.participantIds]) {
      if (!workflowOf.has(member)) workflowOf.set(member, id)
    }
    const manager = diagram.nodes.find((node) => node.id === orchestration.orchestratorId)
    const { builder, config } = manager
      ? builderConfig(orchestration.pattern, manager, orchestration.participantIds, diagram)
      : { builder: '', config: {} }
    return {
      id,
      name: manager?.label?.trim() || `${PATTERN_META[orchestration.pattern].label} workflow`,
      builder,
      config,
    }
  })
  const seen = new Set<string>()
  const edges = spec.edges.flatMap((edge) => {
    const from = workflowOf.get(edge.fromAgentId) ?? edge.fromAgentId
    const to = workflowOf.get(edge.toAgentId) ?? edge.toAgentId
    // Turns inside a workflow are the pattern's business, not an edge.
    if (from === to && workflowOf.has(edge.fromAgentId)) return []
    const key = `${from}->${to}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...edge, fromAgentId: from, toAgentId: to }]
  })
  return { ...withoutBuilderMetadata(spec), edges, workflows }
}

/** The run spec keeps a copy of the builders in settings.metadata for the backend; drop it here. */
function withoutBuilderMetadata<Spec>(spec: Spec): Spec {
  const settings = (spec as { settings?: { metadata?: Record<string, unknown> } }).settings
  if (!settings?.metadata || !('workflowBuilders' in settings.metadata)) return spec
  const { workflowBuilders: _builders, ...metadata } = settings.metadata
  return { ...spec, settings: { ...settings, metadata } }
}
