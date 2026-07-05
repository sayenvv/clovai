import type { AgentNodeConfig, AgentType, ConnectorConfig } from '@/types/agent-workflow'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import agentLibrary from '../../../config/agent-workflow-library.json'

const PALETTE_AGENT_TYPE: Record<string, AgentType> = {
  'aw-agent': 'llm',
  'aw-tool': 'tool',
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

/** Default canvas size for agent cards — fits header, description, and tools footer. */
export const AGENT_NODE_WIDTH = 240
export const AGENT_NODE_HEIGHT = 156
export const TOOL_NODE_WIDTH = 200
export const TOOL_NODE_HEIGHT = 108
export const TOOL_PALETTE_ID = 'aw-tool'
export const AGENT_PALETTE_ID = 'aw-agent'

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
  const isTool = node.paletteId === TOOL_PALETTE_ID
  return {
    ...node,
    width: node.width ?? (isTool ? TOOL_NODE_WIDTH : AGENT_NODE_WIDTH),
    height: node.height ?? (isTool ? TOOL_NODE_HEIGHT : AGENT_NODE_HEIGHT),
    agent: defaultAgentConfig(node.paletteId, node.label || item.label),
  }
}

export function enrichDiagram(diagram: Diagram, paletteById: Map<string, PaletteItem>): Diagram {
  return {
    nodes: diagram.nodes.map((node) => {
      if (!node.paletteId?.startsWith('aw-')) return node
      const isTool = node.paletteId === TOOL_PALETTE_ID
      const minW = isTool ? TOOL_NODE_WIDTH : AGENT_NODE_WIDTH
      const minH = isTool ? TOOL_NODE_HEIGHT : AGENT_NODE_HEIGHT
      if (node.agent) {
        return {
          ...node,
          width: !node.width || (!isTool && node.width < minW) ? minW : node.width,
          height: !node.height || (!isTool && node.height < minH) ? minH : node.height,
        }
      }
      const item = paletteById.get(node.paletteId)
      if (!item) return node
      return enrichAgentNode({ ...node, width: minW, height: minH }, item)
    }),
    edges: diagram.edges.map((edge) =>
      edge.connector ? edge : { ...edge, connector: defaultConnectorConfig() },
    ),
  }
}

export function createWorkflowId(): string {
  return `wf_${Date.now().toString(36)}`
}
