/**
 * Tools in the exported JSON, in the Agent Framework function-tool shape:
 * `{ type, name, description, input_schema, approval_mode }`, plus the `handler` that runs a function
 * tool. Agents point at their tools by name.
 */

import { normalizeApprovalMode } from '@/types/agent-workflow'
import type { WorkflowBuildSpec } from '@/types/workflow-build-spec'

const EMPTY_SCHEMA = { type: 'object', properties: {}, required: [] as string[] }

/** The name the model calls a tool by: snake_case from its label. */
export function toolFunctionName(label: string, fallbackId: string): string {
  const name = label
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return name || `tool_${fallbackId.replace(/[^a-z0-9]/gi, '').slice(-6)}`
}

function parseSchema(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const parsed = (raw as { parsed?: unknown }).parsed
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
      return parsed as Record<string, unknown>
    }
  }
  return EMPTY_SCHEMA
}

/** The spec with its tools as Agent Framework function tools, and agents listing tools by name. */
export function withMafTools<Spec extends Pick<WorkflowBuildSpec, 'tools' | 'agents'>>(spec: Spec): Spec {
  const used = new Set<string>()
  const nameById = new Map<string, string>()
  const tools = spec.tools.map((tool) => {
    // Names must be unique for the model; repeat names get a number.
    let name = toolFunctionName(tool.displayName || tool.name, tool.id)
    for (let index = 2; used.has(name); index += 1) name = `${toolFunctionName(tool.displayName || tool.name, tool.id)}_${index}`
    used.add(name)
    nameById.set(tool.id, name)
    const configuration = tool.configuration as { approvalMode?: string; url?: string; handler?: string }
    const isMcp = tool.toolType === 'mcp'
    return {
      type: isMcp ? 'mcp' : 'function',
      name,
      description: tool.description,
      ...(isMcp
        ? { url: configuration.url ?? null }
        : {
            input_schema: parseSchema(tool.inputSchema),
            ...(configuration.handler ? { handler: configuration.handler } : {}),
          }),
      approval_mode: normalizeApprovalMode(configuration.approvalMode),
    }
  })
  const agents = spec.agents.map((agent) => ({
    ...agent,
    toolIds: agent.toolIds.map((id) => nameById.get(id) ?? id),
  }))
  return { ...spec, agents, tools } as unknown as Spec
}
