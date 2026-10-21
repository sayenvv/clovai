import type { DiagramPage } from '@/components/designer/diagram-types'
import { isExecutorNode, listAgentNodes, listToolsForAgent } from '@/components/agent-workflow/tool-agent-mapping'
import { findStartNode } from '@/components/agent-workflow/workflow-start'
import { findEndNode } from '@/components/agent-workflow/workflow-flow-nodes'

const MAX_INSTRUCTIONS_CHARS = 1500

/**
 * Compact Markdown description of a workflow tab for the Workflow AI chat:
 * agents with their role, model, tools and instructions, plus how they connect.
 */
export function describeWorkflowTab(page: DiagramPage): string {
  const { diagram } = page
  const agents = listAgentNodes(diagram)
  // Only flow nodes are named in connections; tools are listed under their agent.
  const labels = new Map(agents.map((node) => [node.id, node.label || 'Untitled']))
  const start = findStartNode(diagram)
  const end = findEndNode(diagram)
  if (start) labels.set(start.id, 'Start')
  if (end) labels.set(end.id, 'End')

  const lines = [
    `# Workflow tab: ${page.name}`,
    `Kind: ${page.kind === 'sub' ? 'sub-workflow' : 'main workflow'} · Direction: ${diagram.direction ?? 'horizontal'}`,
    '',
  ]

  if (agents.length === 0) {
    lines.push('This tab has no agents yet.')
    return lines.join('\n')
  }

  lines.push(`## Agents (${agents.length})`)
  agents.forEach((node, index) => {
    const config = node.agent
    const tools = listToolsForAgent(diagram, node.id).map((tool) => tool.label).filter(Boolean)
    lines.push('', `### ${index + 1}. ${node.label || 'Untitled'}`)
    lines.push(`- Type: ${isExecutorNode(node) ? 'executor' : config?.agentType ?? 'agent'}`)
    if (config?.description?.trim()) lines.push(`- Role: ${config.description.trim()}`)
    if (config?.model?.trim()) lines.push(`- Model: ${config.model.trim()}`)
    if (tools.length > 0) lines.push(`- Tools: ${tools.join(', ')}`)
    if (config?.humanInTheLoop) lines.push('- Requires human approval before handing off')
    const instructions = config?.instructions?.trim()
    if (instructions) {
      const clipped =
        instructions.length > MAX_INSTRUCTIONS_CHARS
          ? `${instructions.slice(0, MAX_INSTRUCTIONS_CHARS)}\n[truncated]`
          : instructions
      lines.push('- Instructions:', '', clipped.replace(/^/gm, '  > '))
    }
  })

  const connections = diagram.edges.filter((edge) => labels.has(edge.from) && labels.has(edge.to))
  if (connections.length > 0) {
    lines.push('', '## Connections')
    connections.forEach((edge) => {
      const notes = [
        edge.label?.trim(),
        edge.connector?.humanApproval ? 'human approval' : '',
      ].filter(Boolean)
      lines.push(
        `- ${labels.get(edge.from)} → ${labels.get(edge.to)}${notes.length ? ` (${notes.join(', ')})` : ''}`,
      )
    })
  }

  return lines.join('\n')
}
