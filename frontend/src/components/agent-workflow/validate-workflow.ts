import type { Diagram, DiagramEdge, DiagramNode } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { WorkflowExecutionType, WorkflowValidationIssue } from '@/types/agent-workflow'
import { resolveAgentType } from './agent-workflow-defaults'
import { isAgentNode, isToolNode } from './tool-agent-mapping'

export { autoLayoutNodes, layoutWorkflowAgents } from './workflow-layout'

export function inferWorkflowType(diagram: Diagram): WorkflowExecutionType {
  const hasHumanEdge = diagram.edges.some((edge) => edge.connector?.humanApproval)
  if (hasHumanEdge) return 'human-in-the-loop'

  const hasRouter = diagram.nodes.some((node) => resolveAgentType(node.paletteId) === 'router')
  if (hasRouter) return 'conditional'

  const outDegree = new Map<string, number>()
  diagram.edges.forEach((edge) => {
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1)
  })
  const hasParallel = [...outDegree.values()].some((count) => count > 1)
  if (hasParallel) return 'parallel'

  return 'sequential'
}

export function validateWorkflow(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = []
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]))

  if (diagram.nodes.length === 0) {
    issues.push({ id: 'empty', severity: 'warning', message: 'Add at least one agent to the workflow.' })
    return issues
  }

  const agentNodes = diagram.nodes.filter(isAgentNode)

  if (agentNodes.length === 0) {
    issues.push({
      id: 'no-agent',
      severity: 'error',
      message: 'Workflow must include at least one Agent node.',
    })
  }

  diagram.nodes.forEach((node) => {
    if (!paletteById.has(node.paletteId)) {
      issues.push({
        id: `unknown-${node.id}`,
        severity: 'error',
        message: `Unknown block: ${node.label}`,
        nodeId: node.id,
      })
    }
    if (isToolNode(node)) {
      if (!node.mappedAgentId || !nodesById.has(node.mappedAgentId)) {
        issues.push({
          id: `tool-unmapped-${node.id}`,
          severity: 'error',
          message: `${node.label} must be mapped to an agent.`,
          nodeId: node.id,
        })
      } else if (!isAgentNode(nodesById.get(node.mappedAgentId)!)) {
        issues.push({
          id: `tool-invalid-map-${node.id}`,
          severity: 'error',
          message: `${node.label} is mapped to an invalid agent.`,
          nodeId: node.id,
        })
      }
      return
    }
    if (node.agent?.status === 'inactive') {
      issues.push({
        id: `inactive-${node.id}`,
        severity: 'warning',
        message: `${node.label} is inactive and will be skipped at runtime.`,
        nodeId: node.id,
      })
    }
  })

  diagram.edges.forEach((edge) => {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      issues.push({
        id: `dangling-${edge.id}`,
        severity: 'error',
        message: 'Connector references a missing agent.',
        edgeId: edge.id,
      })
    }
    if (edge.connector?.humanApproval && !edge.connector.approvalRole.trim()) {
      issues.push({
        id: `approval-role-${edge.id}`,
        severity: 'error',
        message: 'Human approval connector requires an approval role.',
        edgeId: edge.id,
      })
    }
  })

  const connected = new Set<string>()
  diagram.edges.forEach((edge) => {
    connected.add(edge.from)
    connected.add(edge.to)
  })
  diagram.nodes.forEach((node) => {
    if (isToolNode(node)) return
    if (agentNodes.length > 1 && !connected.has(node.id)) {
      issues.push({
        id: `isolated-${node.id}`,
        severity: 'warning',
        message: `${node.label} is not connected to the workflow.`,
        nodeId: node.id,
      })
    }
  })

  return issues
}

export function isAgentPaletteId(paletteId: string): boolean {
  return paletteId.startsWith('aw-')
}

export function edgeNeedsApprovalStyle(edge: DiagramEdge): boolean {
  return Boolean(edge.connector?.humanApproval)
}
