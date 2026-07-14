import type { AgentNodeConfig, AgentType, ConnectorConfig } from '@/types/agent-workflow'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import agentLibrary from '../../../config/agent-workflow-library.json'

const PALETTE_AGENT_TYPE: Record<string, AgentType> = {
  'aw-agent': 'llm',
  'aw-tool': 'tool',
  'aw-mcp-tool': 'tool',
  'aw-skill': 'tool',
  'aw-integration': 'tool',
  'aw-executor': 'executor',
  'aw-start': 'trigger',
  'aw-event': 'trigger',
  'aw-schedule': 'trigger',
  'aw-llm-agent': 'llm',
  'aw-specialist': 'specialist',
  'aw-tool-agent': 'tool',
  'aw-planner': 'planner',
  'aw-sub-workflow': 'control',
  'aw-reviewer': 'human',
  'aw-router': 'router',
  'aw-parallel': 'control',
  'aw-merge': 'control',
  'aw-memory': 'memory',
  'aw-vector': 'memory',
  'aw-output': 'output',
  'aw-end': 'output',
  'aw-ext-langgraph': 'specialist',
  'aw-ext-crewai': 'specialist',
  'aw-ext-autogen': 'llm',
  'aw-ext-bedrock': 'specialist',
  'aw-ext-vertex': 'llm',
  'aw-ext-copilot': 'specialist',
  'aw-ext-databricks': 'specialist',
  'aw-ext-agentforce': 'specialist',
  'aw-ext-openai': 'llm',
  'aw-ext-anthropic': 'llm',
  'aw-ext-llamaindex': 'specialist',
  'aw-ext-huggingface': 'llm',
}

export interface SidebarBlock {
  id: string
  paletteId: string
  label: string
  description: string
  agentType: AgentType
  toolCount?: number
}

export interface ExternalAgentBlock extends SidebarBlock {
  provider: string
  logo?: string
  featured?: boolean
}

export interface AgentImportSource {
  id: string
  label: string
  provider: string
  logo?: string
  enabled: boolean
  description?: string
}

export const SIDEBAR_BLOCKS = agentLibrary.blocks as SidebarBlock[]
export const EXTERNAL_AGENT_BLOCKS = (agentLibrary.externalAgents ?? []) as ExternalAgentBlock[]
export const AGENT_IMPORT_SOURCES = (agentLibrary.importSources ?? []) as AgentImportSource[]
export const SIDEBAR_PREVIEW_LIMIT =
  (agentLibrary as { defaults?: { sidebarPreviewLimit?: number } }).defaults?.sidebarPreviewLimit ?? 3

export function primaryImportSource(): AgentImportSource | undefined {
  return AGENT_IMPORT_SOURCES.find((source) => source.enabled)
}

export function isExternalAgentPalette(paletteId: string): boolean {
  return paletteId.startsWith('aw-ext-')
}

export function resolveExternalAgent(paletteId: string): ExternalAgentBlock | undefined {
  return EXTERNAL_AGENT_BLOCKS.find((item) => item.paletteId === paletteId)
}

function findLibraryBlock(paletteId: string): SidebarBlock | undefined {
  return (
    SIDEBAR_BLOCKS.find((item) => item.paletteId === paletteId) ??
    EXTERNAL_AGENT_BLOCKS.find((item) => item.paletteId === paletteId)
  )
}

/** Compact agent card body (docks hang below). */
export const AGENT_NODE_WIDTH = 240
export const AGENT_NODE_HEIGHT = 64
export const TOOL_NODE_WIDTH = 180
export const TOOL_NODE_HEIGHT = 56
export const TOOL_PALETTE_ID = 'aw-tool'
export const MCP_TOOL_PALETTE_ID = 'aw-mcp-tool'
export const SKILL_PALETTE_ID = 'aw-skill'
export const INTEGRATION_PALETTE_ID = 'aw-integration'
export const MEMORY_PALETTE_ID = 'aw-memory'
export const EXECUTOR_PALETTE_ID = 'aw-executor'
export const AGENT_PALETTE_ID = 'aw-agent'

/** Palettes that always render as child strips (even before mapping). */
const ALWAYS_CHILD_PALETTE_IDS = new Set([
  TOOL_PALETTE_ID,
  MCP_TOOL_PALETTE_ID,
  SKILL_PALETTE_ID,
  INTEGRATION_PALETTE_ID,
])

/** Palettes that attach under an agent when added from the library. */
const MAPPED_CHILD_PALETTE_IDS = new Set([
  ...ALWAYS_CHILD_PALETTE_IDS,
  MEMORY_PALETTE_ID,
])

export function isAlwaysChildPalette(paletteId: string): boolean {
  return ALWAYS_CHILD_PALETTE_IDS.has(paletteId)
}

export function isMappedToolPalette(paletteId: string): boolean {
  return MAPPED_CHILD_PALETTE_IDS.has(paletteId)
}

export function childKindForPalette(
  paletteId: string,
): 'tool' | 'mcp' | 'skill' | 'integration' | 'memory' | null {
  switch (paletteId) {
    case TOOL_PALETTE_ID:
      return 'tool'
    case MCP_TOOL_PALETTE_ID:
      return 'mcp'
    case SKILL_PALETTE_ID:
      return 'skill'
    case INTEGRATION_PALETTE_ID:
      return 'integration'
    case MEMORY_PALETTE_ID:
      return 'memory'
    default:
      return null
  }
}

function slugifyExecutorId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'custom_executor'
}

export function defaultExecutorSource(kind: 'class' | 'function'): string {
  return kind === 'function' ? DEFAULT_EXECUTOR_FUNCTION_SOURCE : DEFAULT_EXECUTOR_CLASS_SOURCE
}

const DEFAULT_EXECUTOR_CLASS_SOURCE = `from elevennodes import Executor, WorkflowContext, handler


class CustomExecutor(Executor):
    """Process typed messages and forward results to connected executors."""

    @handler
    async def handle(self, message: str, ctx: WorkflowContext[str]) -> None:
        # Forward transformed message to downstream executors
        await ctx.send_message(message.strip())
        # Optionally expose workflow output
        # await ctx.yield_output(message)
`

const DEFAULT_EXECUTOR_FUNCTION_SOURCE = `from elevennodes import WorkflowContext, executor


@executor(id="custom_executor")
async def custom_executor(message: str, ctx: WorkflowContext[str]) -> None:
    await ctx.send_message(message.strip())
`

function defaultToolsForPalette(paletteId: string): string[] {
  const block = findLibraryBlock(paletteId)
  const count = block?.toolCount ?? 0
  if (count === 0) return []
  const presets = ['web_search', 'code_runner', 'file_reader', 'api_call', 'slack_notify']
  return Array.from({ length: count }, (_, index) => presets[index] ?? `tool_${index + 1}`)
}

export function resolveAgentType(paletteId: string): AgentType {
  const block = findLibraryBlock(paletteId)
  if (block) return block.agentType
  return PALETTE_AGENT_TYPE[paletteId] ?? 'llm'
}

export function defaultAgentConfig(paletteId: string, label: string): AgentNodeConfig {
  const agentType = resolveAgentType(paletteId)
  const block = findLibraryBlock(paletteId)

  if (isAlwaysChildPalette(paletteId)) {
    const isMcp = paletteId === MCP_TOOL_PALETTE_ID
    const kind = childKindForPalette(paletteId)
    return {
      agentType: 'tool',
      description: block?.description ?? '',
      instructions: isMcp
        ? `Connect to the ${label} MCP server and use its tools during workflow execution.`
        : kind === 'skill'
          ? `Apply the ${label} skill during agent reasoning.`
          : kind === 'integration'
            ? `Use the ${label} integration for this agent.`
            : `Execute ${label} for the mapped agent.`,
      model: 'gpt-4.1',
      temperature: 0.2,
      tools: isMcp ? [] : defaultToolsForPalette(paletteId),
      inputSchema: '{\n  "input": "string"\n}',
      outputSchema: '{\n  "result": "string"\n}',
      approvalMode: 'never_required',
      mcpUrl: isMcp ? 'https://' : undefined,
      memoryEnabled: false,
      memoryScope: 'workflow',
      retryCount: 2,
      timeoutSeconds: 120,
      status: 'draft',
    }
  }

  if (paletteId === EXECUTOR_PALETTE_ID) {
    return {
      agentType: 'executor',
      description:
        'Eleven Nodes executor — receives typed messages, runs handler logic, and can send_message or yield_output.',
      instructions:
        'Use @handler on executor classes or @executor for functions. Import from elevennodes only.',
      model: '',
      temperature: 0,
      tools: [],
      inputSchema: '{\n  "type": "string",\n  "description": "Handler input message"\n}',
      outputSchema: '{\n  "type": "string",\n  "description": "Message sent via ctx.send_message"\n}',
      executorId: slugifyExecutorId(label),
      executorHandlerKind: 'class',
      executorInputType: 'str',
      executorOutputType: 'str',
      executorWorkflowOutputType: '',
      executorSource: DEFAULT_EXECUTOR_CLASS_SOURCE,
      contributesToWorkflowOutput: false,
      contributesToIntermediateOutput: false,
      executorResettable: false,
      memoryEnabled: false,
      memoryScope: 'workflow',
      retryCount: 1,
      timeoutSeconds: 120,
      status: 'draft',
    }
  }

  return {
    agentType,
    description: block?.description ?? '',
    instructions: `You are ${label}. Complete your task using the workflow context provided.`,
    model: 'gpt-4.1',
    temperature: 0.2,
    tools: defaultToolsForPalette(paletteId),
    inputSchema: '{\n  "input": "string"\n}',
    outputSchema: '{\n  "result": "string"\n}',
    memoryEnabled: agentType === 'llm' || agentType === 'specialist',
    memoryScope: 'workflow',
    retryCount: 2,
    timeoutSeconds: 120,
    status: 'draft',
  }
}

export function defaultConnectorConfig(): ConnectorConfig {
  return {
    condition: '',
    executionOrder: 1,
    inputMapping: '',
    outputMapping: '',
    humanApproval: false,
    approvalMessage: 'Please review and approve this step to continue.',
    approvalRole: 'reviewer',
    approvalTimeoutMinutes: 60,
    fallbackPath: '',
    errorPath: '',
  }
}

export function enrichAgentNode(node: DiagramNode, item: PaletteItem): DiagramNode {
  if (node.agent) return node
  if (!node.paletteId.startsWith('aw-')) return node
  const isTool = isAlwaysChildPalette(node.paletteId) || Boolean(node.mappedAgentId)
  return {
    ...node,
    width: node.width ?? (isTool ? TOOL_NODE_WIDTH : AGENT_NODE_WIDTH),
    height: node.height ?? (isTool ? TOOL_NODE_HEIGHT : AGENT_NODE_HEIGHT),
    agent: defaultAgentConfig(node.paletteId, node.label || item.label),
  }
}

export function enrichDiagram(diagram: Diagram, paletteById: Map<string, PaletteItem>): Diagram {
  let nodesChanged = false
  const nodes = diagram.nodes.map((node) => {
    if (!node.paletteId?.startsWith('aw-')) return node
    const isTool = isAlwaysChildPalette(node.paletteId) || Boolean(node.mappedAgentId)
    const minW = isTool ? TOOL_NODE_WIDTH : AGENT_NODE_WIDTH
    const minH = isTool ? TOOL_NODE_HEIGHT : AGENT_NODE_HEIGHT
    if (node.agent) {
      // Keep agent bodies on the compact card size (docks hang outside the box).
      const width = isTool
        ? !node.width || node.width < minW
          ? minW
          : node.width
        : AGENT_NODE_WIDTH
      const height = isTool
        ? !node.height || node.height < minH
          ? minH
          : node.height
        : AGENT_NODE_HEIGHT
      if (width === node.width && height === node.height) return node
      nodesChanged = true
      return { ...node, width, height }
    }
    const item = paletteById.get(node.paletteId)
    if (!item) return node
    const next = enrichAgentNode({ ...node, width: minW, height: minH }, item)
    if (next === node) return node
    nodesChanged = true
    return next
  })

  let edgesChanged = false
  const edges = diagram.edges.map((edge) => {
    if (edge.connector) return edge
    edgesChanged = true
    return { ...edge, connector: defaultConnectorConfig() }
  })

  if (!nodesChanged && !edgesChanged) return diagram
  return {
    nodes: nodesChanged ? nodes : diagram.nodes,
    edges: edgesChanged ? edges : diagram.edges,
  }
}

export function createWorkflowId(): string {
  return `wf_${Date.now().toString(36)}`
}
