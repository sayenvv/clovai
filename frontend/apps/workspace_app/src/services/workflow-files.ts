import type {
  GeneratedWorkflowEdge,
  WorkflowGenerationExecutionType,
  WorkflowGenerationPlan,
} from '@/types/workflow-generation'

/** The four files a stored workflow is made of, as the workflow builder's agents return them. */
export interface WorkflowFiles {
  workflow: Record<string, unknown>
  agents: { agents?: Array<Record<string, unknown>> }
  tools?: { tools?: Array<Record<string, unknown>> }
  middlewares?: unknown
}

/**
 * The workflow assistant's final answer, as its workflow definition asks for it:
 * `{"mode": "create" | "update" | "answer", "summary": "...", "files": {...}}`.
 * `mode` and `summary` are whatever the agents said; nothing is inferred here.
 */
export interface RunAnswer {
  mode?: string
  summary?: string
  files: WorkflowFiles | null
}

/** Read the final answer. Text that is not that JSON object is the summary itself. */
export function readRunAnswer(text: string): RunAnswer {
  for (const candidate of jsonCandidates(text)) {
    const data = record(candidate)
    if (typeof data.mode === 'string' || typeof data.summary === 'string') {
      return {
        mode: typeof data.mode === 'string' ? data.mode : undefined,
        summary: typeof data.summary === 'string' ? data.summary : undefined,
        files: asFiles(data.files),
      }
    }
  }
  // An answer that is not in the envelope: files anywhere in it, and the text as the reply.
  const files = extractWorkflowFiles(text)
  return { files, summary: files ? undefined : text.trim() || undefined }
}

/** Orchestration pattern -> the canvas execution type that draws it best. */
const EXECUTION_TYPES: Record<string, WorkflowGenerationExecutionType> = {
  magentic: 'group-chat',
  groupchat: 'group-chat',
  sequential: 'sequential',
  concurrent: 'parallel',
  graph: 'conditional',
  handoff: 'conditional',
}

/** Palette entry the canvas uses for a plain AI agent. */
const AGENT_PALETTE_ID = 'aw-agent'

/**
 * Find the workflow files in an agent's final answer: the whole text as JSON, a fenced
 * ```json block, or the first JSON object in the text. Returns null when there are none
 * (for example when the answer is a reply to a question).
 */
export function extractWorkflowFiles(text: string): WorkflowFiles | null {
  for (const candidate of jsonCandidates(text)) {
    const files = asFiles(candidate)
    if (files) return files
  }
  return null
}

/** Draw the files on the canvas: agents, their tools by name, and the edges between them. */
export function filesToPlan(files: WorkflowFiles): WorkflowGenerationPlan {
  const workflow = files.workflow
  const orchestration = record(workflow.orchestration)
  const pattern = String(orchestration.pattern ?? '').toLowerCase()
  const settings = record(orchestration[pattern])
  const toolNames = new Map(
    (files.tools?.tools ?? []).map((tool) => [String(tool.id), String(tool.name ?? tool.id)]),
  )
  const agents = files.agents.agents ?? []

  return {
    workflowName: String(workflow.name ?? 'Workflow'),
    description: String(workflow.description ?? ''),
    executionType: EXECUTION_TYPES[pattern] ?? 'sequential',
    agents: agents.map((agent) => ({
      key: String(agent.id),
      name: String(agent.name ?? agent.id),
      description: String(agent.description ?? ''),
      paletteId: AGENT_PALETTE_ID,
      instructions: String(agent.instructions ?? ''),
      tools: list(agent.tools)
        .map((entry) => toolNames.get(String(record(entry).toolId)) ?? '')
        .filter(Boolean),
    })),
    edges: edgesFor(pattern, settings, orchestration, agents.map((agent) => String(agent.id))),
  }
}

function edgesFor(
  pattern: string,
  settings: Record<string, unknown>,
  orchestration: Record<string, unknown>,
  agentIds: string[],
): GeneratedWorkflowEdge[] {
  const edge = (fromKey: string, toKey: string, label = ''): GeneratedWorkflowEdge => ({
    fromKey,
    toKey,
    label,
    humanApproval: false,
  })
  // Magentic: the manager hands work to each participant.
  const manager = typeof settings.managerAgentId === 'string' ? settings.managerAgentId : ''
  if (manager) {
    const participants = list(settings.participants).map(String)
    return (participants.length ? participants : agentIds.filter((id) => id !== manager)).map((id) =>
      edge(manager, id),
    )
  }
  const declared = list(orchestration.edges).map(record)
  if (declared.length) {
    return declared.map((item) => edge(String(item.from), String(item.to), String(item.condition ?? '')))
  }
  // Sequential without edges: each agent hands over to the next.
  return pattern === 'sequential' ? agentIds.slice(1).map((id, index) => edge(agentIds[index], id)) : []
}

function asFiles(value: unknown): WorkflowFiles | null {
  const data = record(value)
  // The files may sit at the top or under one key, such as { "files": {...} }.
  for (const candidate of [data, ...Object.values(data).map(record)]) {
    const agents = record(candidate.agents)
    if (Object.keys(record(candidate.workflow)).length && Array.isArray(agents.agents)) {
      return candidate as unknown as WorkflowFiles
    }
  }
  return null
}

function* jsonCandidates(text: string): Generator<unknown> {
  const trimmed = text.trim()
  yield tryParse(trimmed)
  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) yield tryParse(match[1])
  const start = trimmed.indexOf('{')
  const end = start >= 0 ? matchingBrace(trimmed, start) : -1
  if (end > start) yield tryParse(trimmed.slice(start, end + 1))
}

/** Index of the brace closing the one at ``open``, ignoring braces inside strings; -1 if none. */
function matchingBrace(text: string, open: number): number {
  let depth = 0
  let inString = false
  for (let i = open; i < text.length; i += 1) {
    const char = text[i]
    if (inString) {
      if (char === '\\') i += 1
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}' && --depth === 0) return i
  }
  return -1
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
