import type { Diagram, DiagramDocument, DiagramNode } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { AgentNodeConfig, WorkflowExecutionType } from '@/types/agent-workflow'
import type {
  SchemaBlock,
  WorkflowBuildAgent,
  WorkflowBuildEdge,
  WorkflowBuildSpec,
  WorkflowBuildTool,
  WorkflowExecutionMode,
  WorkflowModelConfig,
  WorkflowSchemaStatus,
  WorkflowSchemaType,
  WorkflowSettings,
  WorkflowSubWorkflowExport,
} from '@/types/workflow-build-spec'
import { WORKFLOW_BUILD_SPEC_VERSION } from '@/types/workflow-build-spec'
import {
  isExternalAgentPalette,
  resolveExternalAgent,
} from '@/components/agent-workflow/agent-workflow-defaults'
import {
  listAgentNodes,
  listToolsForAgent,
} from '@/components/agent-workflow/tool-agent-mapping'
import { isSubWorkflowNode } from '@/components/agent-workflow/sub-workflow-ops'
import {
  DEFAULT_WORKFLOW_MODEL_CONFIG,
  resolveWorkflowModelConfig,
} from '@/components/agent-workflow/workflow-model-config'
import { slugifyIdentifier } from '@/utils/slug'

function toSchemaBlock(raw: string | undefined): SchemaBlock {
  const value = raw?.trim() ?? ''
  if (!value) return { raw: '', parsed: {} }
  try {
    return { raw: value, parsed: JSON.parse(value) as Record<string, unknown> }
  } catch {
    return { raw: value, parsed: {} }
  }
}

function mapWorkflowType(executionType: WorkflowExecutionType): WorkflowSchemaType {
  switch (executionType) {
    case 'group-chat':
      return 'groupchat'
    case 'parallel':
      return 'parallel'
    case 'conditional':
      return 'handoff'
    case 'dependency':
      return 'magnetic'
    default:
      return 'sequential'
  }
}

function mapStatus(status: string | undefined): WorkflowSchemaStatus {
  switch (status) {
    case 'validated':
      return 'validated'
    case 'deployed':
      return 'deployed'
    case 'failed':
      return 'archived'
    default:
      return 'draft'
  }
}

function buildModelConfigFromAgents(agents: DiagramNode[]): WorkflowModelConfig {
  const primary = agents.find((node) => node.agent)?.agent
  if (!primary) return { ...DEFAULT_WORKFLOW_MODEL_CONFIG }

  const { provider, model } = parseModelString(primary.model)
  return {
    ...DEFAULT_WORKFLOW_MODEL_CONFIG,
    provider,
    model,
    temperature: primary.temperature ?? DEFAULT_WORKFLOW_MODEL_CONFIG.temperature,
  }
}

function resolveModelConfig(
  doc: DiagramDocument,
  agents: DiagramNode[],
  serverModelConfig?: WorkflowModelConfig,
): WorkflowModelConfig {
  if (serverModelConfig) return resolveWorkflowModelConfig(serverModelConfig)
  const stored = doc.workflow?.modelConfig
  if (stored) return resolveWorkflowModelConfig(stored)
  return buildModelConfigFromAgents(agents)
}

function parseModelString(model: string): Pick<WorkflowModelConfig, 'provider' | 'model'> {
  const trimmed = model.trim()
  if (!trimmed) {
    return {
      provider: DEFAULT_WORKFLOW_MODEL_CONFIG.provider,
      model: DEFAULT_WORKFLOW_MODEL_CONFIG.model,
    }
  }
  if (trimmed.includes('/')) {
    const [provider, ...rest] = trimmed.split('/')
    return { provider, model: rest.join('/') || DEFAULT_WORKFLOW_MODEL_CONFIG.model }
  }
  return { provider: DEFAULT_WORKFLOW_MODEL_CONFIG.provider, model: trimmed }
}

function buildSettings(
  agents: DiagramNode[],
  subWorkflows: WorkflowSubWorkflowExport[],
  modelConfig: WorkflowModelConfig,
): WorkflowSettings {
  const configs = agents.map((node) => node.agent).filter(Boolean) as AgentNodeConfig[]
  const maxTimeout = configs.reduce((max, config) => Math.max(max, config.timeoutSeconds ?? 0), 0)
  const maxRetries = configs.reduce((max, config) => Math.max(max, config.retryCount ?? 0), 0)

  return {
    timeoutSeconds: maxTimeout > 0 ? maxTimeout : 120,
    streamResponse: modelConfig.stream,
    retryPolicy: {
      maxRetries: maxRetries > 0 ? maxRetries : 2,
      retryDelaySeconds: 3,
    },
    logging: {
      enabled: true,
      level: 'info',
    },
    metadata: {
      subWorkflows,
    },
  }
}

function agentMetadata(node: DiagramNode): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    paletteId: node.paletteId,
    agentType: node.agent?.agentType,
  }

  if (isSubWorkflowNode(node) && node.subWorkflowPageId) {
    metadata.isSubWorkflow = true
    metadata.subWorkflowPageId = node.subWorkflowPageId
  }

  if (isExternalAgentPalette(node.paletteId)) {
    const external = resolveExternalAgent(node.paletteId)
    if (external) metadata.externalProvider = external.provider
  }

  return metadata
}

function buildAgentSpec(diagram: Diagram, node: DiagramNode): WorkflowBuildAgent {
  const config = node.agent!
  const slug = slugifyIdentifier(node.label, node.id.replace(/[^a-z0-9]/gi, '_'))
  const toolIds = listToolsForAgent(diagram, node.id).map((tool) => tool.id)

  return {
    id: node.id,
    name: slug,
    displayName: node.label,
    description: config.description ?? '',
    instructions: config.instructions ?? '',
    systemPrompt: config.instructions ?? '',
    userPrompt: '',
    isManager: node.paletteId.includes('manager') ? true : null,
    isOrchestrator: node.paletteId.includes('orchestrat') ? true : null,
    toolIds,
    responseSchema: toSchemaBlock(config.outputSchema),
    metadata: agentMetadata(node),
  }
}

function inferToolType(config: AgentNodeConfig): WorkflowBuildTool['toolType'] {
  const integrations = config.tools.map((item) => item.toLowerCase())
  if (integrations.some((item) => item.includes('api'))) return 'api'
  if (integrations.some((item) => item.includes('webhook'))) return 'webhook'
  if (integrations.some((item) => item.includes('database') || item.includes('db'))) {
    return 'database'
  }
  if (integrations.some((item) => item.includes('function'))) return 'function'
  return 'custom'
}

function buildToolSpecs(diagram: Diagram): WorkflowBuildTool[] {
  const tools: WorkflowBuildTool[] = []

  for (const agent of listAgentNodes(diagram)) {
    for (const tool of listToolsForAgent(diagram, agent.id)) {
      const config = tool.agent!
      const slug = slugifyIdentifier(tool.label, tool.id.replace(/[^a-z0-9]/gi, '_'))
      tools.push({
        id: tool.id,
        agentId: agent.id,
        name: slug,
        displayName: tool.label,
        description: config.description ?? '',
        toolType: inferToolType(config),
        configuration: {
          integrations: [...config.tools],
          paletteId: tool.paletteId,
        },
        inputSchema: toSchemaBlock(config.inputSchema),
        metadata: {
          mappedAgentId: agent.id,
          mappedAgentName: agent.label,
        },
      })
    }
  }

  return tools
}

function buildEdgeSpecs(diagram: Diagram): WorkflowBuildEdge[] {
  const agentIds = new Set(listAgentNodes(diagram).map((agent) => agent.id))

  return diagram.edges
    .filter((edge) => agentIds.has(edge.from) && agentIds.has(edge.to))
    .map((edge) => ({
      id: edge.id,
      fromAgentId: edge.from,
      toAgentId: edge.to,
      label: edge.label ?? '',
      humanApproval: Boolean(edge.connector?.humanApproval),
      approvalRole: edge.connector?.approvalRole ?? 'reviewer',
      approvalMessage:
        edge.connector?.approvalMessage ??
        'Please review and approve this step to continue.',
    }))
}

function resolveExecutionMode(
  executionType: WorkflowExecutionType,
  edges: WorkflowBuildEdge[],
): WorkflowExecutionMode {
  if (executionType === 'human-in-the-loop' || edges.some((edge) => edge.humanApproval)) {
    return 'human-in-the-loop'
  }
  return 'standard'
}

function buildSubWorkflowExports(
  doc: DiagramDocument,
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
  visited: Set<string>,
): WorkflowSubWorkflowExport[] {
  const exports: WorkflowSubWorkflowExport[] = []

  for (const node of diagram.nodes) {
    if (!isSubWorkflowNode(node) || !node.subWorkflowPageId) continue
    const page = doc.pages.find((candidate) => candidate.id === node.subWorkflowPageId)
    if (!page) continue

    const entry: WorkflowSubWorkflowExport = {
      mountAgentId: node.id,
      pageId: page.id,
      pageName: page.name,
      workflowType: mapWorkflowType(doc.workflow?.executionType ?? 'sequential'),
      agents: [],
      tools: [],
      edges: [],
      subWorkflows: [],
    }

    if (!visited.has(page.id)) {
      const nestedVisited = new Set(visited)
      nestedVisited.add(page.id)
      const nested = buildWorkflowBody(doc, page.id, page.diagram, paletteById, nestedVisited)
      entry.agents = nested.agents
      entry.tools = nested.tools
      entry.edges = nested.edges
      entry.subWorkflows = nested.subWorkflows
    }

    exports.push(entry)
  }

  return exports
}

interface WorkflowBody {
  agents: WorkflowBuildAgent[]
  tools: WorkflowBuildTool[]
  edges: WorkflowBuildEdge[]
  subWorkflows: WorkflowSubWorkflowExport[]
}

function buildWorkflowBody(
  doc: DiagramDocument,
  pageId: string,
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
  visited: Set<string>,
): WorkflowBody {
  visited.add(pageId)
  const agentNodes = listAgentNodes(diagram)

  return {
    agents: agentNodes.map((node) => buildAgentSpec(diagram, node)),
    tools: buildToolSpecs(diagram),
    edges: buildEdgeSpecs(diagram),
    subWorkflows: buildSubWorkflowExports(doc, diagram, paletteById, visited),
  }
}

export interface BuildWorkflowSpecOptions {
  doc: DiagramDocument
  pageId: string
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  workspaceId: string
  createdAt?: string
  visited?: Set<string>
  serverModelConfig?: WorkflowModelConfig
}

/** Serialize the canvas into the agent workflow JSON schema. */
export function buildWorkflowSpec({
  doc,
  pageId,
  diagram,
  paletteById,
  workspaceId,
  createdAt,
  visited = new Set<string>(),
  serverModelConfig,
}: BuildWorkflowSpecOptions): WorkflowBuildSpec {
  const page = doc.pages.find((candidate) => candidate.id === pageId)
  const workflowMeta = doc.workflow
  const workflowName = page?.name ?? 'Untitled workflow'
  const agentNodes = listAgentNodes(diagram)
  const body = buildWorkflowBody(doc, pageId, diagram, paletteById, visited)
  const executionType = workflowMeta?.executionType ?? 'sequential'
  const modelConfig = resolveModelConfig(doc, agentNodes, serverModelConfig)
  const now = new Date().toISOString()

  return {
    meta: {
      schemaVersion: WORKFLOW_BUILD_SPEC_VERSION,
      workspaceId,
      pageId,
      pageName: workflowName,
      workflowId: workflowMeta?.workflowId ?? `wf_${pageId}`,
      workflowName,
      workflowVersion: workflowMeta?.version ?? 1,
      workflowType: mapWorkflowType(executionType),
      executionMode: resolveExecutionMode(executionType, body.edges),
      status: mapStatus(workflowMeta?.status),
      description: workflowMeta?.deployment?.endpointUrl
        ? `Deployed at ${workflowMeta.deployment.endpointUrl}`
        : '',
      createdAt: createdAt ?? now,
      updatedAt: now,
    },
    modelConfig,
    agents: body.agents,
    tools: body.tools,
    edges: body.edges,
    settings: buildSettings(agentNodes, body.subWorkflows, modelConfig),
  }
}
