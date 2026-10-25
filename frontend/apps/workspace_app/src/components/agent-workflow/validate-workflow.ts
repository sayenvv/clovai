import { isSwitchNode } from '@/components/agent-workflow/workflow-edge-groups'
import type { Diagram, DiagramEdge } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { WorkflowExecutionType, WorkflowValidationIssue } from '@/types/agent-workflow'
import { resolveAgentType } from './agent-workflow-defaults'
import { isAgentNode, isToolNode } from './tool-agent-mapping'

export { autoLayoutNodes, layoutWorkflowAgents } from './workflow-layout'

export function inferWorkflowType(diagram: Diagram): WorkflowExecutionType {
  const hasHumanEdge = diagram.edges.some((edge) => edge.connector?.humanApproval)
  const hasAgentHitl = diagram.nodes.some((node) => node.agent?.humanInTheLoop)
  if (hasHumanEdge || hasAgentHitl) return 'human-in-the-loop'

  const hasRouter = diagram.nodes.some((node) => resolveAgentType(node.paletteId) === 'router')
  if (hasRouter) return 'conditional'

  const outDegree = new Map<string, number>()
  const inDegree = new Map<string, number>()
  diagram.edges.forEach((edge) => {
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  })
  const agentNodes = diagram.nodes.filter(isAgentNode)
  const hasJoin = agentNodes.some((node) => (inDegree.get(node.id) ?? 0) > 1)
  const hasMagenticManager = agentNodes.some(
    (node) =>
      (resolveAgentType(node.paletteId ?? '') === 'planner' || node.agent?.agentType === 'planner') &&
      (outDegree.get(node.id) ?? 0) > 1,
  )
  if (hasMagenticManager && !hasJoin) return 'dependency'

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
    if (node.agent?.humanInTheLoop && !node.agent.approvalRole?.trim()) {
      issues.push({
        id: `hitl-role-${node.id}`,
        severity: 'error',
        message: `${node.label} has human-in-the-loop enabled but no approval role.`,
        nodeId: node.id,
      })
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

  // A Switch routes one node's output by its outgoing connectors: cases have a condition, the default has none
  diagram.nodes.filter(isSwitchNode).forEach((node) => {
    const outgoing = diagram.edges.filter((edge) => edge.from === node.id)
    const defaults = outgoing.filter((edge) => !edge.connector?.condition?.trim()).length
    const problems = [
      !diagram.edges.some((edge) => edge.to === node.id) && 'has no source node',
      outgoing.length === defaults && 'has no cases',
      defaults === 0 && 'needs a default path (one connector without a condition)',
      defaults > 1 && `has ${defaults} default paths; keep one connector without a condition`,
    ].filter(Boolean)
    problems.forEach((problem, index) =>
      issues.push({ id: `switch-${node.id}-${index}`, severity: 'error', message: `${node.label} ${problem}.`, nodeId: node.id }),
    )

    // A case with no value (`text == ""`) never matches a real reply
    outgoing
      .filter((edge) => /^\s*[\w.]+\s*(==|=|!=|contains)\s*(""|'')\s*$/.test(edge.connector?.condition ?? ''))
      .forEach((edge) =>
        issues.push({
          id: `switch-empty-case-${edge.id}`,
          severity: 'warning',
          message: `${node.label}: the case for ${nodesById.get(edge.to)?.label ?? 'a node'} has no value, so it never matches.`,
          edgeId: edge.id,
        }),
      )

    // The source also wired straight to a Switch target is the same edge twice (Agent Framework rejects it)
    for (const input of diagram.edges.filter((edge) => edge.to === node.id)) {
      for (const output of outgoing) {
        const direct = diagram.edges.find((edge) => edge.from === input.from && edge.to === output.to)
        if (!direct) continue
        issues.push({
          id: `switch-duplicate-${direct.id}`,
          severity: 'error',
          message: `${nodesById.get(input.from)?.label ?? 'A node'} connects to ${nodesById.get(output.to)?.label ?? 'a node'} both directly and through ${node.label}. Remove the direct connector.`,
          edgeId: direct.id,
        })
      }
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

export function edgeNeedsApprovalStyle(edge: DiagramEdge, fromAgentHitl = false): boolean {
  return Boolean(edge.connector?.humanApproval || fromAgentHitl)
}
