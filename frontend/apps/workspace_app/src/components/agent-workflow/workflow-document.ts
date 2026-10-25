/**
 * The workflow JSON as shown in the Code tab, saved to the database and shared as a file.
 * `meta.orchestrationPattern` names the pattern, and a top-level object under that same key holds
 * everything that pattern needs (its connections, team, manager, approvals). Agents and tools are
 * shared at the top level; nothing is said twice.
 */

import type { Diagram } from '@/components/designer/diagram-types'
import { withMafTools } from '@/components/agent-workflow/maf-tool'
import { withAgentModelConfigs } from '@/components/agent-workflow/maf-agent'
import { withNodePositions } from '@/components/agent-workflow/workflow-import'
import { findOrchestrations } from '@/components/agent-workflow/orchestration-patterns'
import type { WorkflowBuildSpec, WorkflowSchemaType } from '@/types/workflow-build-spec'

export type OrchestrationPatternKey =
  'workflowBuilder' | 'sequential' | 'concurrent' | 'groupChat' | 'magentic' | 'handoff'

const PATTERN_KEYS: Record<WorkflowSchemaType, OrchestrationPatternKey> = {
  workflow: 'workflowBuilder',
  sequential: 'sequential',
  parallel: 'concurrent',
  groupchat: 'groupChat',
  magnetic: 'magentic',
  handoff: 'handoff',
}

export interface ConnectionApproval {
  source: string
  target: string
  approvalRole: string
  approvalMessage: string
  feedbackRevisionsEnabled: boolean
  maxFeedbackRevisions: number
}

/** The Code tab / database / share-file JSON for a build spec. */
export function buildWorkflowDocument(spec: WorkflowBuildSpec, diagram: Diagram): Record<string, unknown> {
  const pattern = PATTERN_KEYS[spec.meta.workflowType]
  const shared = withNodePositions(withAgentModelConfigs(withMafTools(spec), diagram), diagram) as Record<
    string,
    unknown
  >
  const { workflowType: _type, ...meta } = spec.meta
  const { orchestration, metadata, ...settings } = spec.settings
  const { workflowBuilders, ...settingsMetadata } = metadata as Record<string, unknown>
  const { edges: _edges, workflowBuilder, settings: _settings, meta: _meta, canvas, ...rest } = shared
  // Agents list their tools by the tools' ids (UUIDs), not by function name.
  const toolIdsByAgent = new Map(spec.agents.map((agent) => [agent.id, agent.toolIds]))
  rest.agents = (rest.agents as Array<Record<string, unknown> & { id: string }>).map((agent) => ({
    ...agent,
    toolIds: toolIdsByAgent.get(agent.id) ?? [],
  }))

  // Approval gates on connections, said once per connection.
  const approvals: ConnectionApproval[] = spec.edges
    .filter((edge) => edge.humanApproval)
    .map((edge) => ({
      source: edge.fromAgentId,
      target: edge.toAgentId,
      approvalRole: edge.approvalRole,
      approvalMessage: edge.approvalMessage,
      feedbackRevisionsEnabled: Boolean(edge.feedbackRevisionsEnabled),
      maxFeedbackRevisions: edge.maxFeedbackRevisions ?? 5,
    }))

  let implementation: Record<string, unknown>
  if (pattern === 'workflowBuilder') {
    implementation = { ...(workflowBuilder as object) }
  } else {
    // The orchestrator, its builder configuration (team, manager, outputs), and the connections
    // into or out of the team; the team's own turns are the pattern's business.
    const orchestration_ = findOrchestrations(diagram)[0]
    const builder = (
      workflowBuilders as Array<{ workflowId: string; builder: string; config: unknown }> | undefined
    )?.[0]
    const teamEdge = (source: string, target: string) =>
      orchestration_ &&
      source === orchestration_.orchestratorId &&
      orchestration_.participantIds.includes(target)
    implementation = {
      ...(orchestration_ ? { orchestratorId: orchestration_.orchestratorId } : {}),
      ...(builder ? { builder: builder.builder, config: builder.config } : {}),
      ...(orchestration ?? {}),
      connections: spec.edges
        .filter((edge) => !teamEdge(edge.fromAgentId, edge.toAgentId))
        .map((edge) => ({ source: edge.fromAgentId, target: edge.toAgentId })),
    }
  }
  if (approvals.length > 0) implementation.approvals = approvals

  return {
    meta: { ...meta, orchestrationPattern: pattern },
    // The workflow's default model; agents carry their own in `agents[].modelConfig`.
    modelConfig: spec.modelConfig,
    ...rest,
    [pattern]: implementation,
    settings: { ...settings, metadata: settingsMetadata },
    canvas,
  }
}
