import type { Diagram, DiagramDocument, DiagramNode } from '@/components/designer/diagram-types'
import { resolvedAgentHitl } from '@/components/agent-workflow/agent-hitl'
import { resolveAgentType } from '@/components/agent-workflow/agent-workflow-defaults'
import { inferWorkflowType } from '@/components/agent-workflow/validate-workflow'
import {
  childKindForPalette,
  isAgentNode,
  isExecutorNode,
  listAgentNodes,
  listToolsForAgent,
} from '@/components/agent-workflow/tool-agent-mapping'
import type { WorkflowExecutionType } from '@/types/agent-workflow'

function modeFor(type: WorkflowExecutionType): string {
  switch (type) {
    case 'parallel':
      return 'concurrent'
    case 'conditional':
      return 'handoff'
    case 'group-chat':
      return 'group-chat'
    case 'dependency':
      return 'magentic'
    case 'human-in-the-loop':
      return 'magentic'
    default:
      return 'sequential'
  }
}

function catalogId(node: DiagramNode): string {
  return node.id
}

function agentDefinition(node: DiagramNode, planner: boolean): Record<string, unknown> {
  const hitl = resolvedAgentHitl(node.agent)
  const enabled = Boolean(node.agent?.humanInTheLoop)
  return {
    id: catalogId(node),
    name: node.label,
    role: node.agent?.description || node.label,
    instructions: node.agent?.instructions ?? '',
    humanInTheLoop: enabled,
    ...(enabled
      ? {
          approvalKind: planner ? 'plan-review' : 'request-info',
          approver: hitl.approvalRole,
          approvalMessage: hitl.approvalMessage,
          approvalTimeoutMinutes: hitl.approvalTimeoutMinutes,
          feedbackRevisionsEnabled: hitl.feedbackRevisionsEnabled,
          maxFeedbackRevisions: hitl.maxFeedbackRevisions,
        }
      : {}),
  }
}

function humanApprovalSteps(diagram: Diagram, agents: DiagramNode[], planner: DiagramNode | undefined) {
  return agents.flatMap((node) => {
    const outgoing = diagram.edges.find(
      (edge) => edge.from === node.id && edge.connector?.humanApproval,
    )
    if (!node.agent?.humanInTheLoop && !outgoing) return []
    const hitl = resolvedAgentHitl(node.agent)
    const connector = outgoing?.connector
    return [
      {
        id: node.id,
        agentRef: catalogId(node),
        kind: planner?.id === node.id ? 'plan-review' : 'request-info',
        condition: '',
        approver: connector?.approvalRole || hitl.approvalRole,
        message: connector?.approvalMessage || hitl.approvalMessage,
        timeoutMinutes: connector?.approvalTimeoutMinutes || hitl.approvalTimeoutMinutes,
        feedbackRevisionsEnabled: Boolean(
          connector?.feedbackRevisionsEnabled ?? hitl.feedbackRevisionsEnabled,
        ),
        maxFeedbackRevisions: connector?.maxFeedbackRevisions ?? hitl.maxFeedbackRevisions,
      },
    ]
  })
}

function connectorRecord(diagram: Diagram, edge: Diagram['edges'][number]): Record<string, unknown> {
  const from = diagram.nodes.find((node) => node.id === edge.from)
  const approval = Boolean(edge.connector?.humanApproval || from?.agent?.humanInTheLoop)
  if (!approval) return { from: edge.from, to: edge.to }
  const hitl = resolvedAgentHitl(from?.agent)
  return {
    from: edge.from,
    to: edge.to,
    humanApproval: true,
    approver: edge.connector?.approvalRole || hitl.approvalRole,
    message: edge.connector?.approvalMessage || hitl.approvalMessage,
  }
}

function childRefs(diagram: Diagram, agentId: string, kind: 'tool' | 'skill' | 'mcp') {
  return listToolsForAgent(diagram, agentId)
    .filter((node) => {
      const child = childKindForPalette(node.paletteId ?? '')
      if (kind === 'tool') return child === 'tool' || child === 'integration' || child === null
      return child === kind
    })
    .map(catalogId)
}

export function buildOrchestrationDocument(input: {
  doc: DiagramDocument
  pageId: string
  diagram: Diagram
  workspaceId: string
  userId: string
}): Record<string, unknown> {
  const page = input.doc.pages.find((candidate) => candidate.id === input.pageId)
  const name = page?.name ?? 'Untitled workflow'
  const executionType = input.doc.workflow?.executionType ?? inferWorkflowType(input.diagram)
  const mode = modeFor(executionType)
  const agents = listAgentNodes(input.diagram)
  const planner =
    mode === 'magentic'
      ? agents.find(
          (node) =>
            resolveAgentType(node.paletteId ?? '') === 'planner' || node.agent?.agentType === 'planner',
        )
      : undefined
  const participants = planner ? agents.filter((node) => node.id !== planner.id) : agents
  const hitlSteps = humanApprovalSteps(input.diagram, agents, planner)
  const hitl =
    executionType === 'human-in-the-loop' ||
    hitlSteps.length > 0
  const primary = agents[0]?.agent
  const model = '${OPENAI_MODEL}'

  const placements = participants.map((node) => ({
    id: node.id,
    agentRef: catalogId(node),
    toolRefs: childRefs(input.diagram, node.id, 'tool'),
    skillRefs: childRefs(input.diagram, node.id, 'skill'),
    memoryRef: listToolsForAgent(input.diagram, node.id).find(
      (child) => childKindForPalette(child.paletteId ?? '') === 'memory',
    )?.id,
    plannerRef: '',
  }))

  const toolNodes = input.diagram.nodes.filter(
    (node) => !isAgentNode(node) && !isExecutorNode(node) && node.mappedAgentId,
  )

  return {
    schemaVersion: '4.0',
    metadata: {
      id: input.doc.workflow?.workflowId ?? `wf_${input.pageId}`,
      name,
      description: input.doc.workflow?.deployment?.endpointUrl ?? name,
      version: String(input.doc.workflow?.version ?? 1),
      owner: input.userId,
      businessUnit: input.workspaceId,
      tags: [],
      createdBy: input.userId,
      createdAt: new Date().toISOString(),
    },
    variableResolvers: {
      environment: '${}',
      runtime: '#{}',
      outputs: '@{}',
      inputs: '%{}',
      system: '!{}',
    },
    workflow: {
      type: 'orchestration',
      mode,
      executionPattern: mode,
      stateful: true,
      enabled: true,
    },
    runtime: {
      framework: 'Microsoft Agent Framework',
      environment: 'local',
      region: '',
      executionTimeoutSeconds: 1800,
      maxParallelExecutions: 4,
      checkpointing: true,
      resumeExecution: true,
      modelResolution: {
        strategy: 'app',
        defaultModelRef: 'app-default-model',
        fallbackToDefault: true,
      },
    },
    configuration: {
      defaultModel: model,
      defaultTemperature: primary?.temperature ?? 0.2,
      defaultMaxTokens: 8000,
      defaultTopP: 1,
      defaultFrequencyPenalty: 0,
      defaultPresencePenalty: 0,
    },
    modelConnections: [
      {
        id: 'app-default-model',
        client: '${MODEL_CLIENT}',
        provider: 'OpenAI',
        deployment: model,
        endpoint: '${OPENAI_BASE_URL}',
        authentication: { type: '${MODEL_AUTH_TYPE}', apiKey: '${OPENAI_API_KEY}' },
      },
    ],
    definitions: {
      agents: agents.map((node) => agentDefinition(node, planner?.id === node.id)),
      tools: toolNodes
        .filter((node) => childKindForPalette(node.paletteId ?? '') !== 'skill')
        .map((node) => ({
          id: catalogId(node),
          name: node.label,
          type: childKindForPalette(node.paletteId ?? '') ?? 'tool',
        })),
      skills: toolNodes
        .filter((node) => childKindForPalette(node.paletteId ?? '') === 'skill')
        .map((node) => ({ id: catalogId(node), name: node.label, type: 'skill' })),
      planners: planner ? [agentDefinition(planner, true)] : [],
    },
    ...(planner ? { planner: { ref: catalogId(planner), enabled: true } } : {}),
    agents: placements,
    executors: input.diagram.nodes.filter(isExecutorNode).map((node) => ({
      id: node.id,
      executorRef: node.agent?.executorId || node.id,
    })),
    connectors: input.diagram.edges
      .filter((edge) => agents.some((node) => node.id === edge.from) && agents.some((node) => node.id === edge.to))
      .map((edge) => connectorRecord(input.diagram, edge)),
    humanInTheLoop: {
      enabled: hitl,
      approvalProvider: hitlSteps[0]?.approver ?? '',
      steps: hitlSteps,
    },
  }
}
