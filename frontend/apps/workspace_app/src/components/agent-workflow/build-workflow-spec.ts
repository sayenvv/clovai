import { pageWorkflowId } from '@/components/agent-workflow/page-workflow-id'
import { findOrchestrations, resolveExecutionType } from '@/components/agent-workflow/orchestration-patterns'
import { BUILDER_SPECS, builderConfig } from '@/components/agent-workflow/workflow-builder-config'
import { knownContextProviders } from '@/components/agent-workflow/hooks/use-context-providers'
import type { Diagram, DiagramDocument, DiagramEdge, DiagramNode } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import { normalizeExecutorSource } from '@/components/agent-workflow/executor-source'
import { normalizeApprovalMode, type AgentNodeConfig, type WorkflowExecutionType } from '@/types/agent-workflow'
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
  WorkflowBuildContextProvider,
} from '@/types/workflow-build-spec'
import { WORKFLOW_BUILD_SPEC_VERSION } from '@/types/workflow-build-spec'
import {
  isExternalAgentPalette,
  normalizeAgentType,
  resolveExternalAgent,
} from '@/components/agent-workflow/agent-workflow-defaults'
import {
  listAgentNodes,
  listToolsForAgent,
  isMcpToolNode,
} from '@/components/agent-workflow/tool-agent-mapping'
import { isSubWorkflowNode } from '@/components/agent-workflow/sub-workflow-ops'
import { isExecutorNode } from '@/components/agent-workflow/tool-agent-mapping'
import {
  DEFAULT_WORKFLOW_MODEL_CONFIG,
  resolveWorkflowModelConfig,
} from '@/components/agent-workflow/workflow-model-config'
import { slugifyIdentifier } from '@/utils/slug'
import {
  buildWorkflowBuilderGraph,
  isGraphWorkflow,
  isSwitchNode,
  listExecutorNodes,
} from '@/components/agent-workflow/workflow-edge-groups'
import { getWorkflowConfiguration, type WorkflowConfiguration } from '@/services/workflow-configuration-store'

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
  const stored = doc.workflow?.modelConfig
  if (stored?.provider === 'ollama' && stored.model?.trim()) {
    return resolveWorkflowModelConfig(stored)
  }
  if (serverModelConfig) return resolveWorkflowModelConfig(serverModelConfig)
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

/**
 * The run's orchestration settings from its first workflow node (the one that sets the pattern),
 * plus every workflow node's Agent Framework builder block in metadata for the backend to read.
 */
function orchestrationSettings(diagram: Diagram) {
  const orchestrations = findOrchestrations(diagram)
  const builders = orchestrations.flatMap((orchestration) => {
    const node = diagram.nodes.find((candidate) => candidate.id === orchestration.orchestratorId)
    return node
      ? [{ workflowId: `wf_${node.id}`, ...builderConfig(orchestration.pattern, node, orchestration.participantIds, diagram) }]
      : []
  })
  const first = orchestrations[0]
  if (!first) return { orchestration: undefined, builders }
  const values = diagram.nodes.find((node) => node.id === first.orchestratorId)?.agent?.workflowConfig
  const maxRounds = Number(values?.max_round_count ?? values?.max_rounds)
  const startAgent = typeof values?.start_agent === 'string' ? values.start_agent : null
  return {
    orchestration: {
      managerAgentId: BUILDER_SPECS[first.pattern].managerKey ? first.orchestratorId : null,
      ...(first.pattern === 'handoff' ? { startAgentId: startAgent ?? first.orchestratorId } : {}),
      // The backend accepts 1–100 rounds.
      ...(Number.isFinite(maxRounds) && maxRounds > 0 ? { maxRounds: Math.min(100, Math.round(maxRounds)) } : {}),
    },
    builders,
  }
}

/** `Authorization=Bearer x` lines from the Configuration tab into a header map. */
function parseHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const index = line.indexOf('=')
    if (index <= 0) continue
    headers[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return headers
}

function buildSettings(
  agents: DiagramNode[],
  subWorkflows: WorkflowSubWorkflowExport[],
  modelConfig: WorkflowModelConfig,
  diagram: Diagram,
  configuration: WorkflowConfiguration,
): WorkflowSettings {
  const { orchestration, builders } = orchestrationSettings(diagram)
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
      level: configuration.logLevel,
    },
    metadata: {
      subWorkflows,
      ...(builders.length > 0 ? { workflowBuilders: builders } : {}),
    },
    ...(orchestration ? { orchestration } : {}),
    observability: {
      tracing: {
        enabled: configuration.tracingEnabled,
        captureSensitiveData: configuration.captureSensitiveData,
        persistExecutionHistory: configuration.persistExecutionHistory,
      },
      openTelemetry: {
        enabled: configuration.openTelemetryEnabled,
        exporter: configuration.otelExporter,
        endpoint: configuration.otelEndpoint,
        serviceName: configuration.otelServiceName,
        headers: parseHeaders(configuration.otelHeaders),
        sampleRate: configuration.traceSampleRate,
        metricsEnabled: configuration.metricsEnabled,
      },
    },
    runtime: {
      maxIterations: configuration.maxIterations,
      timeoutSeconds: configuration.timeoutSeconds,
      retryAttempts: configuration.retryAttempts,
      checkpointingEnabled: configuration.checkpointingEnabled,
    },
  }
}

function agentMetadata(node: DiagramNode): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    paletteId: node.paletteId,
    agentType: normalizeAgentType(node),
    // The user's own saved model: the server builds this agent's chat client from it.
    ...(node.agent?.modelConnectionId ? { modelConnectionId: node.agent.modelConnectionId } : {}),
  }

  if (isSubWorkflowNode(node) && node.subWorkflowPageId) {
    metadata.isSubWorkflow = true
    metadata.subWorkflowPageId = node.subWorkflowPageId
  }

  if (isExternalAgentPalette(node.paletteId)) {
    const external = resolveExternalAgent(node.paletteId)
    if (external) metadata.externalProvider = external.provider
  }

  if (node.agent?.humanInTheLoop) {
    metadata.humanInTheLoop = true
    metadata.approvalRole = node.agent.approvalRole ?? 'reviewer'
    metadata.approvalMessage =
      node.agent.approvalMessage ?? 'Please review and approve this step to continue.'
    metadata.approvalTimeoutMinutes = node.agent.approvalTimeoutMinutes ?? 60
    metadata.feedbackRevisionsEnabled = Boolean(node.agent.feedbackRevisionsEnabled)
    metadata.maxFeedbackRevisions = node.agent.maxFeedbackRevisions ?? 5
  }

  if (isExecutorNode(node)) {
    const executor = node.agent
    metadata.isExecutor = true
    metadata.executorId = executor?.executorId ?? node.id
    metadata.executorHandlerKind = executor?.executorHandlerKind ?? 'class'
    metadata.executorInputType = executor?.executorInputType ?? 'str'
    metadata.executorOutputType = executor?.executorOutputType ?? 'str'
    metadata.executorWorkflowOutputType = executor?.executorWorkflowOutputType ?? ''
    metadata.executorSource = normalizeExecutorSource(executor?.executorSource ?? '')
    metadata.contributesToWorkflowOutput = executor?.contributesToWorkflowOutput ?? false
    metadata.contributesToIntermediateOutput = executor?.contributesToIntermediateOutput ?? false
    metadata.executorResettable = executor?.executorResettable ?? false
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
    ...(config.contextProviderIds?.length ? { contextProviderIds: config.contextProviderIds } : {}),
    responseSchema: toSchemaBlock(config.outputSchema),
    metadata: agentMetadata(node),
  }
}

function inferToolType(tool: DiagramNode, config: AgentNodeConfig): WorkflowBuildTool['toolType'] {
  if (isMcpToolNode(tool)) return 'mcp'
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
        toolType: inferToolType(tool, config),
        configuration: {
          integrations: [...config.tools],
          paletteId: tool.paletteId,
          approvalMode: normalizeApprovalMode(config.approvalMode),
          ...(isMcpToolNode(tool) && config.mcpUrl ? { url: config.mcpUrl } : {}),
          ...(!isMcpToolNode(tool) && config.handler ? { handler: config.handler } : {}),
        },
        inputSchema: toSchemaBlock(config.inputSchema),
        metadata: {
          mappedAgentId: agent.id,
          mappedAgentName: agent.label,
          isMcp: isMcpToolNode(tool),
        },
      })
    }
  }

  return tools
}

/** Agent → Switch → agent connectors as direct agent → agent ones (the case rules are in workflowBuilder). */
function bridgeSwitchEdges(diagram: Diagram): DiagramEdge[] {
  const switchIds = new Set(diagram.nodes.filter(isSwitchNode).map((node) => node.id))
  const direct = diagram.edges.filter((edge) => !switchIds.has(edge.from) && !switchIds.has(edge.to))
  const bridged = diagram.edges
    .filter((edge) => switchIds.has(edge.to))
    .flatMap((input) =>
      diagram.edges
        .filter((edge) => edge.from === input.to)
        .map((output) => ({ ...output, id: `${input.id}__${output.id}`, from: input.from })),
    )
  return [...direct, ...bridged]
}

function buildEdgeSpecs(diagram: Diagram): WorkflowBuildEdge[] {
  const agentIds = new Set(listExecutorNodes(diagram).map((agent) => agent.id))
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]))

  return bridgeSwitchEdges(diagram)
    .filter((edge) => agentIds.has(edge.from) && agentIds.has(edge.to))
    .map((edge) => {
      const fromAgent = nodesById.get(edge.from)?.agent
      const humanApproval =
        Boolean(edge.connector?.humanApproval) || Boolean(fromAgent?.humanInTheLoop)
      return {
        id: edge.id,
        fromAgentId: edge.from,
        toAgentId: edge.to,
        label: edge.label ?? '',
        humanApproval,
        approvalRole:
          edge.connector?.approvalRole || fromAgent?.approvalRole || 'reviewer',
        approvalMessage:
          edge.connector?.approvalMessage ||
          fromAgent?.approvalMessage ||
          'Please review and approve this step to continue.',
        feedbackRevisionsEnabled:
          Boolean(edge.connector?.feedbackRevisionsEnabled) ||
          Boolean(fromAgent?.feedbackRevisionsEnabled),
        maxFeedbackRevisions:
          edge.connector?.maxFeedbackRevisions ?? fromAgent?.maxFeedbackRevisions ?? 5,
      }
    })
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

/** `{ contextProviders }` for the providers the agents name, in first-use order; nothing when none. */
function contextProvidersOf(agents: WorkflowBuildAgent[]): { contextProviders?: WorkflowBuildContextProvider[] } {
  const ids = [...new Set(agents.flatMap((agent) => agent.contextProviderIds ?? []))]
  if (ids.length === 0) return {}
  const known = knownContextProviders()
  return {
    contextProviders: ids.map((id) => {
      const provider = known.find((item) => item.id === id)
      // Not (or no longer) offered: kept by id, so the run reports it clearly instead of losing it
      return provider ? { ...provider } : { id, name: '', description: '', slot: 'memory' as const }
    }),
  }
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
  const agentNodes = listExecutorNodes(diagram)

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
  /** Configuration tab settings; read from the store when not passed. */
  configuration?: WorkflowConfiguration
}

/** This tab and the sub-workflow pages it uses (and theirs), not the document's other tabs. */
function canvasPages(doc: DiagramDocument, pageId: string, diagram: Diagram): DiagramDocument['pages'] {
  const pagesById = new Map(doc.pages.map((page) => [page.id, page]))
  const current = pagesById.get(pageId)
  const pages = [current ? { ...current, diagram } : { id: pageId, name: 'Untitled workflow', diagram }]
  for (let index = 0; index < pages.length; index++) {
    for (const node of pages[index].diagram.nodes) {
      const sub = node.subWorkflowPageId ? pagesById.get(node.subWorkflowPageId) : undefined
      if (sub && !pages.some((page) => page.id === sub.id)) pages.push(sub)
    }
  }
  return pages
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
  configuration,
}: BuildWorkflowSpecOptions): WorkflowBuildSpec {
  const page = doc.pages.find((candidate) => candidate.id === pageId)
  const workflowMeta = doc.workflow
  const workflowName = page?.name ?? 'Untitled workflow'
  const agentNodes = listAgentNodes(diagram)
  const body = buildWorkflowBody(doc, pageId, diagram, paletteById, visited)
  // An orchestrator block on the canvas decides the pattern; otherwise the workflow's chosen type.
  const executionType = resolveExecutionType(workflowMeta?.executionType, diagram)
  const modelConfig = resolveModelConfig(doc, agentNodes, serverModelConfig)
  const now = new Date().toISOString()
  const workflowId = pageWorkflowId(doc, pageId)
  // Agents wired with connectors and nothing deciding a team pattern: a WorkflowBuilder graph.
  const graphWorkflow = isGraphWorkflow(diagram)

  return {
    meta: {
      schemaVersion: WORKFLOW_BUILD_SPEC_VERSION,
      workspaceId,
      pageId,
      pageName: workflowName,
      workflowId,
      workflowName,
      workflowVersion: workflowMeta?.version ?? 1,
      workflowType: graphWorkflow ? 'workflow' : mapWorkflowType(executionType),
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
    ...contextProvidersOf(body.agents),
    edges: body.edges,
    ...(graphWorkflow ? { workflowBuilder: buildWorkflowBuilderGraph(diagram) } : {}),
    settings: buildSettings(
      agentNodes,
      body.subWorkflows,
      modelConfig,
      diagram,
      configuration ?? getWorkflowConfiguration(workflowId),
    ),
    canvas: {
      activePageId: pageId,
      activeMainPageId: pageId,
      pages: canvasPages(doc, pageId, diagram),
      workflow: workflowMeta ? { ...workflowMeta, workflowId } : workflowMeta,
    },
  }
}
