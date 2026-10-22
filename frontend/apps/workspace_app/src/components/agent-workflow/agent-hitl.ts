import type { Diagram, DiagramEdge } from '@/components/designer/diagram-types'
import { defaultConnectorConfig } from '@/components/agent-workflow/agent-workflow-defaults'
import { isAgentNode } from '@/components/agent-workflow/tool-agent-mapping'
import type { AgentNodeConfig, ConnectorConfig } from '@/types/agent-workflow'

export const DEFAULT_AGENT_HITL = {
  approvalMessage: 'Please review and approve this step to continue.',
  approvalRole: 'reviewer',
  approvalTimeoutMinutes: 60,
  feedbackRevisionsEnabled: false,
  maxFeedbackRevisions: 5,
} as const

export type AgentHitlFields = Pick<
  AgentNodeConfig,
  | 'humanInTheLoop'
  | 'approvalMessage'
  | 'approvalRole'
  | 'approvalTimeoutMinutes'
  | 'feedbackRevisionsEnabled'
  | 'maxFeedbackRevisions'
>

export function isAgentHitlEnabled(agent: AgentNodeConfig | undefined): boolean {
  return Boolean(agent?.humanInTheLoop)
}

export function resolvedAgentHitl(agent: AgentNodeConfig | undefined): Required<AgentHitlFields> {
  return {
    humanInTheLoop: Boolean(agent?.humanInTheLoop),
    approvalMessage: agent?.approvalMessage?.trim() || DEFAULT_AGENT_HITL.approvalMessage,
    approvalRole: agent?.approvalRole?.trim() || DEFAULT_AGENT_HITL.approvalRole,
    approvalTimeoutMinutes:
      typeof agent?.approvalTimeoutMinutes === 'number' && agent.approvalTimeoutMinutes > 0
        ? agent.approvalTimeoutMinutes
        : DEFAULT_AGENT_HITL.approvalTimeoutMinutes,
    feedbackRevisionsEnabled: Boolean(agent?.feedbackRevisionsEnabled),
    maxFeedbackRevisions:
      typeof agent?.maxFeedbackRevisions === 'number' && agent.maxFeedbackRevisions > 0
        ? agent.maxFeedbackRevisions
        : DEFAULT_AGENT_HITL.maxFeedbackRevisions,
  }
}

export function connectorFromAgentHitl(agent: AgentNodeConfig | undefined): ConnectorConfig {
  const hitl = resolvedAgentHitl(agent)
  return {
    ...defaultConnectorConfig(),
    humanApproval: hitl.humanInTheLoop,
    approvalMessage: hitl.approvalMessage,
    approvalRole: hitl.approvalRole,
    approvalTimeoutMinutes: hitl.approvalTimeoutMinutes,
    feedbackRevisionsEnabled: hitl.humanInTheLoop ? hitl.feedbackRevisionsEnabled : false,
    maxFeedbackRevisions: hitl.maxFeedbackRevisions,
  }
}

function isAgentToAgentEdge(diagram: Diagram, edge: DiagramEdge): boolean {
  const from = diagram.nodes.find((node) => node.id === edge.from)
  const to = diagram.nodes.find((node) => node.id === edge.to)
  return Boolean(from && to && isAgentNode(from) && isAgentNode(to))
}

/** Agent-to-agent connectors that HITL will pause on (outbound handoff, inbound for review nodes). */
export function listAgentHitlHandoffEdges(
  diagram: Diagram,
  nodeId: string,
  direction: 'outgoing' | 'incoming' = 'outgoing',
): DiagramEdge[] {
  return diagram.edges.filter((edge) => {
    if (!isAgentToAgentEdge(diagram, edge)) return false
    return direction === 'incoming' ? edge.to === nodeId : edge.from === nodeId
  })
}

function applyHitlToConnector(
  connector: ConnectorConfig | undefined,
  hitl: Required<AgentHitlFields>,
): ConnectorConfig {
  const base = connector ?? defaultConnectorConfig()
  if (!hitl.humanInTheLoop) {
    return { ...base, humanApproval: false, feedbackRevisionsEnabled: false }
  }
  return {
    ...base,
    humanApproval: true,
    approvalMessage: hitl.approvalMessage,
    approvalRole: hitl.approvalRole,
    approvalTimeoutMinutes: hitl.approvalTimeoutMinutes,
    feedbackRevisionsEnabled: hitl.feedbackRevisionsEnabled,
    maxFeedbackRevisions: hitl.maxFeedbackRevisions,
  }
}

/** Enable or update HITL on an agent and stamp its outgoing handoff connectors. */
export function applyAgentHumanInTheLoop(
  diagram: Diagram,
  nodeId: string,
  patch: Partial<AgentHitlFields>,
): Diagram {
  const node = diagram.nodes.find((candidate) => candidate.id === nodeId)
  if (!node?.agent) return diagram

  const merged: AgentNodeConfig = { ...node.agent, ...patch }
  const hitl = resolvedAgentHitl(merged)
  const nextAgent: AgentNodeConfig = {
    ...merged,
    humanInTheLoop: hitl.humanInTheLoop,
    approvalMessage: hitl.approvalMessage,
    approvalRole: hitl.approvalRole,
    approvalTimeoutMinutes: hitl.approvalTimeoutMinutes,
    feedbackRevisionsEnabled: hitl.humanInTheLoop ? hitl.feedbackRevisionsEnabled : false,
    maxFeedbackRevisions: hitl.maxFeedbackRevisions,
  }

  const nodes = diagram.nodes.map((candidate) =>
    candidate.id === nodeId ? { ...candidate, agent: nextAgent } : candidate,
  )

  const stampIncoming = nextAgent.agentType === 'human'
  const edges = diagram.edges.map((edge) => {
    if (!isAgentToAgentEdge(diagram, edge)) return edge
    const matches = stampIncoming ? edge.to === nodeId : edge.from === nodeId
    if (!matches) return edge
    return {
      ...edge,
      connector: applyHitlToConnector(edge.connector, hitl),
    }
  })

  return { ...diagram, nodes, edges }
}
