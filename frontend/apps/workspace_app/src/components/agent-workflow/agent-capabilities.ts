import {
  INTEGRATION_PALETTE_ID,
  MCP_TOOL_PALETTE_ID,
  MEMORY_PALETTE_ID,
  SKILL_PALETTE_ID,
  TOOL_PALETTE_ID,
} from '@/components/agent-workflow/agent-workflow-defaults'

export type AgentCapabilityKind = 'tool' | 'skill' | 'integration' | 'mcp' | 'memory'

export interface AgentCapability {
  id: string
  kind: AgentCapabilityKind
  label: string
  description: string
  badge: string
  provider: 'Microsoft' | 'OpenAI' | 'Eleven Nodes' | 'MCP'
  /** Always creates a mapped child node under the agent. */
  paletteId: string
  nodeLabel?: string
  mcpUrl?: string
  featured?: boolean
}

/** Curated capabilities — every attach becomes a child node on the canvas. */
export const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    id: 'web_search',
    kind: 'tool',
    label: 'Web search',
    description: 'Ground answers with live web results via Agent Framework tool calling.',
    badge: 'Search',
    provider: 'Eleven Nodes',
    paletteId: TOOL_PALETTE_ID,
    nodeLabel: 'Web search',
    featured: true,
  },
  {
    id: 'code_interpreter',
    kind: 'tool',
    label: 'Code interpreter',
    description: 'Run sandboxed code for analysis, transforms, and calculations.',
    badge: 'Code',
    provider: 'Microsoft',
    paletteId: TOOL_PALETTE_ID,
    nodeLabel: 'Code interpreter',
    featured: true,
  },
  {
    id: 'file_search',
    kind: 'tool',
    label: 'File search',
    description: 'Retrieve and ground answers from uploaded documents and knowledge files.',
    badge: 'Files',
    provider: 'Microsoft',
    paletteId: TOOL_PALETTE_ID,
    nodeLabel: 'File search',
    featured: true,
  },
  {
    id: 'function_calling',
    kind: 'tool',
    label: 'Function calling',
    description: 'Invoke typed functions and APIs declared for this agent.',
    badge: 'Functions',
    provider: 'OpenAI',
    paletteId: TOOL_PALETTE_ID,
    nodeLabel: 'Functions',
  },
  {
    id: 'api_call',
    kind: 'tool',
    label: 'HTTP / API',
    description: 'Call REST endpoints as Agent Framework tools with structured I/O.',
    badge: 'API',
    provider: 'Eleven Nodes',
    paletteId: TOOL_PALETTE_ID,
    nodeLabel: 'HTTP API',
  },
  {
    id: 'mcp_server',
    kind: 'mcp',
    label: 'MCP server',
    description: 'Connect a Model Context Protocol server and expose its tools to the agent.',
    badge: 'MCP',
    provider: 'MCP',
    paletteId: MCP_TOOL_PALETTE_ID,
    nodeLabel: 'MCP server',
    featured: true,
  },
  {
    id: 'mcp_filesystem',
    kind: 'mcp',
    label: 'MCP filesystem',
    description: 'Filesystem MCP server for reading and writing workspace files.',
    badge: 'FS',
    provider: 'MCP',
    paletteId: MCP_TOOL_PALETTE_ID,
    nodeLabel: 'MCP filesystem',
    mcpUrl: 'stdio://filesystem',
  },
  {
    id: 'skill_planning',
    kind: 'skill',
    label: 'Planning',
    description: 'Break goals into ordered steps before acting — planner-style skill.',
    badge: 'Plan',
    provider: 'Microsoft',
    paletteId: SKILL_PALETTE_ID,
    nodeLabel: 'Planning',
    featured: true,
  },
  {
    id: 'skill_summarization',
    kind: 'skill',
    label: 'Summarization',
    description: 'Compress long context into crisp executive summaries.',
    badge: 'Summary',
    provider: 'Microsoft',
    paletteId: SKILL_PALETTE_ID,
    nodeLabel: 'Summarization',
  },
  {
    id: 'skill_rag',
    kind: 'skill',
    label: 'RAG retrieval',
    description: 'Retrieve-then-generate over enterprise knowledge and indexes.',
    badge: 'RAG',
    provider: 'Microsoft',
    paletteId: SKILL_PALETTE_ID,
    nodeLabel: 'RAG retrieval',
    featured: true,
  },
  {
    id: 'skill_critique',
    kind: 'skill',
    label: 'Self-critique',
    description: 'Review drafts for accuracy, risk, and policy alignment before handoff.',
    badge: 'Review',
    provider: 'Eleven Nodes',
    paletteId: SKILL_PALETTE_ID,
    nodeLabel: 'Self-critique',
  },
  {
    id: 'skill_routing',
    kind: 'skill',
    label: 'Intent routing',
    description: 'Classify intent and select the next specialist or tool path.',
    badge: 'Route',
    provider: 'Microsoft',
    paletteId: SKILL_PALETTE_ID,
    nodeLabel: 'Intent routing',
  },
  {
    id: 'memory_workflow',
    kind: 'memory',
    label: 'Workflow memory',
    description: 'Shared conversation and state memory scoped to this workflow run.',
    badge: 'Workflow',
    provider: 'Eleven Nodes',
    paletteId: MEMORY_PALETTE_ID,
    nodeLabel: 'Workflow memory',
    featured: true,
  },
  {
    id: 'memory_thread',
    kind: 'memory',
    label: 'Thread memory',
    description: 'Persist context across turns for a single conversation thread.',
    badge: 'Thread',
    provider: 'Microsoft',
    paletteId: MEMORY_PALETTE_ID,
    nodeLabel: 'Thread memory',
  },
  {
    id: 'memory_vector',
    kind: 'memory',
    label: 'Vector memory',
    description: 'Long-term retrieval memory backed by embeddings.',
    badge: 'Vector',
    provider: 'Microsoft',
    paletteId: MEMORY_PALETTE_ID,
    nodeLabel: 'Vector memory',
    featured: true,
  },
  {
    id: 'azure_ai_search',
    kind: 'integration',
    label: 'Azure AI Search',
    description: 'Ground agents with Azure AI Search indexes and hybrid retrieval.',
    badge: 'Search',
    provider: 'Microsoft',
    paletteId: INTEGRATION_PALETTE_ID,
    nodeLabel: 'Azure AI Search',
    featured: true,
  },
  {
    id: 'microsoft_graph',
    kind: 'integration',
    label: 'Microsoft Graph',
    description: 'Read mail, calendar, and files through Graph with least-privilege scopes.',
    badge: 'Graph',
    provider: 'Microsoft',
    paletteId: INTEGRATION_PALETTE_ID,
    nodeLabel: 'Microsoft Graph',
    featured: true,
  },
  {
    id: 'teams_notify',
    kind: 'integration',
    label: 'Microsoft Teams',
    description: 'Post messages and approvals into Teams channels.',
    badge: 'Teams',
    provider: 'Microsoft',
    paletteId: INTEGRATION_PALETTE_ID,
    nodeLabel: 'Microsoft Teams',
  },
  {
    id: 'outlook_mail',
    kind: 'integration',
    label: 'Outlook mail',
    description: 'Draft and send email via Outlook / Graph mail APIs.',
    badge: 'Mail',
    provider: 'Microsoft',
    paletteId: INTEGRATION_PALETTE_ID,
    nodeLabel: 'Outlook mail',
  },
  {
    id: 'sharepoint',
    kind: 'integration',
    label: 'SharePoint',
    description: 'Read and publish documents from SharePoint libraries.',
    badge: 'SPO',
    provider: 'Microsoft',
    paletteId: INTEGRATION_PALETTE_ID,
    nodeLabel: 'SharePoint',
  },
  {
    id: 'azure_openai',
    kind: 'integration',
    label: 'Azure OpenAI',
    description: 'Route model calls through Azure OpenAI deployments.',
    badge: 'AOAI',
    provider: 'Microsoft',
    paletteId: INTEGRATION_PALETTE_ID,
    nodeLabel: 'Azure OpenAI',
    featured: true,
  },
]

export function capabilitiesForKind(kind: AgentCapabilityKind): AgentCapability[] {
  return AGENT_CAPABILITIES.filter((item) => item.kind === kind)
}

export function findCapability(id: string): AgentCapability | undefined {
  return AGENT_CAPABILITIES.find((item) => item.id === id)
}

export function paletteForCapabilityKind(kind: AgentCapabilityKind): string {
  switch (kind) {
    case 'skill':
      return SKILL_PALETTE_ID
    case 'integration':
      return INTEGRATION_PALETTE_ID
    case 'mcp':
      return MCP_TOOL_PALETTE_ID
    case 'memory':
      return MEMORY_PALETTE_ID
    case 'tool':
    default:
      return TOOL_PALETTE_ID
  }
}
