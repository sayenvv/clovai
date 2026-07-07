import { CODE_EXPORT_PREVIEW_BANNER } from '@/constants/designer'
import { slugifyIdentifier } from '@/utils/slug'
import type { WorkflowBuildAgent, WorkflowBuildSpec } from '@/types/workflow-build-spec'

export type WorkflowCodeFormat = 'json' | 'python'

export const WORKFLOW_CODE_FORMATS: Array<{
  id: WorkflowCodeFormat
  label: string
  extension: string
}> = [
  { id: 'json', label: 'JSON', extension: 'json' },
  { id: 'python', label: 'Python', extension: 'py' },
]

interface AgentStep {
  fnName: string
  agentName: string
  tools: string[]
  humanApproval: boolean
  approvalMessage: string
  approvalRole: string
}

function orderedAgents(spec: WorkflowBuildSpec): WorkflowBuildAgent[] {
  const { agents, edges } = spec
  if (agents.length === 0) return []

  const inDegree = new Map<string, number>()
  agents.forEach((agent) => inDegree.set(agent.id, 0))
  edges.forEach((edge) => inDegree.set(edge.toAgentId, (inDegree.get(edge.toAgentId) ?? 0) + 1))

  const queue = agents.filter((agent) => (inDegree.get(agent.id) ?? 0) === 0)
  if (queue.length === 0) return agents

  const visited = new Set<string>()
  const ordered: WorkflowBuildAgent[] = []

  const visit = (agent: WorkflowBuildAgent) => {
    if (visited.has(agent.id)) return
    visited.add(agent.id)
    ordered.push(agent)

    edges
      .filter((edge) => edge.fromAgentId === agent.id)
      .forEach((edge) => {
        const next = agents.find((candidate) => candidate.id === edge.toAgentId)
        if (next) visit(next)
      })
  }

  queue.forEach(visit)
  agents.forEach((agent) => {
    if (!visited.has(agent.id)) ordered.push(agent)
  })

  return ordered
}

function extractSteps(spec: WorkflowBuildSpec): AgentStep[] {
  const toolsByAgent = new Map<string, string[]>()
  for (const tool of spec.tools) {
    const list = toolsByAgent.get(tool.agentId) ?? []
    list.push(tool.displayName)
    toolsByAgent.set(tool.agentId, list)
  }

  const sequence = orderedAgents(spec)

  return sequence.map((agent, index) => {
    const next = sequence[index + 1]
    const edge =
      (next
        ? spec.edges.find(
            (candidate) => candidate.fromAgentId === agent.id && candidate.toAgentId === next.id,
          )
        : undefined) ?? spec.edges.find((candidate) => candidate.fromAgentId === agent.id)

    return {
      fnName: slugifyIdentifier(agent.name, agent.id.replace(/[^a-z0-9]/gi, '_')),
      agentName: agent.displayName,
      tools: toolsByAgent.get(agent.id) ?? [],
      humanApproval: edge?.humanApproval ?? false,
      approvalMessage: edge?.approvalMessage ?? '',
      approvalRole: edge?.approvalRole ?? 'reviewer',
    }
  })
}

function emptyMessage(pageName: string): string {
  return [
    `# ${pageName}`,
    `# ${CODE_EXPORT_PREVIEW_BANNER}`,
    '',
    '# Add agents to the canvas to generate workflow code.',
  ].join('\n')
}

function toolsLine(step: AgentStep): string {
  if (step.tools.length === 0) return ''
  return `# tools: ${step.tools.join(', ')}`
}

function approvalBlock(
  step: AgentStep,
  emit: (role: string, message: string) => string[],
): string[] {
  if (!step.humanApproval) return []
  return emit(step.approvalRole, step.approvalMessage).map((line) => `    ${line}`)
}

function generatePython(spec: WorkflowBuildSpec, steps: AgentStep[]): string {
  const pageName = spec.meta.workflowName
  if (steps.length === 0) return emptyMessage(pageName)

  const helpers = steps.map((step) => {
    const tools = toolsLine(step)
    return [
      `def ${step.fnName}(ctx: dict) -> dict:`,
      `    """Agent: ${step.agentName}"""`,
      tools ? `    ${tools}` : '',
      `    print("Running ${step.agentName.replace(/"/g, '\\"')}")`,
      '    return ctx',
    ]
      .filter(Boolean)
      .join('\n')
  })

  const runBody: string[] = ['    ctx = {}']
  steps.forEach((step) => {
    runBody.push(`    # ${step.agentName}`)
    runBody.push(`    ctx = ${step.fnName}(ctx)`)
    runBody.push(
      ...approvalBlock(step, (role, message) => [
        `# Human approval (${role}): ${message}`,
        `wait_for_approval(role=${JSON.stringify(role)}, message=${JSON.stringify(message)})`,
      ]),
    )
  })
  runBody.push('    return ctx')

  return [
    `# ${pageName}`,
    `# workflow_id: ${spec.meta.workflowId}`,
    `# workflow_type: ${spec.meta.workflowType}`,
    `# execution_mode: ${spec.meta.executionMode}`,
    `# ${CODE_EXPORT_PREVIEW_BANNER}`,
    '',
    'def wait_for_approval(role: str, message: str) -> None:',
    '    print(f"[approval] {role}: {message}")',
    '',
    ...helpers,
    '',
    'def run_workflow() -> dict:',
    ...runBody,
    '',
    'if __name__ == "__main__":',
    '    output = run_workflow()',
    '    print("Workflow output:", output)',
  ].join('\n')
}

/** Generate Python debug / integration code from a workflow build spec. */
export function generateWorkflowCode(spec: WorkflowBuildSpec): string {
  return generatePython(spec, extractSteps(spec))
}
