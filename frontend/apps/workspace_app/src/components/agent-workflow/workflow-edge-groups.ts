/**
 * Graph workflows (no orchestrator on the canvas): the connectors between agents as Agent Framework
 * WorkflowBuilder calls. One agent → several is `add_fan_out_edges`, several → one is
 * `add_fan_in_edges`, one → one is `add_edge`, and a Switch node between an agent and its targets is
 * `add_switch_case_edge_group` (its connectors' conditions are the cases, the one without is the default).
 */

import type { Diagram, DiagramEdge, DiagramNode } from '@/components/designer/diagram-types'
import { listAgentNodes } from '@/components/agent-workflow/tool-agent-mapping'
import { findOrchestrations } from '@/components/agent-workflow/orchestration-patterns'
import { isEndFlowNode, isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import type { EdgeCondition, WorkflowBuilderGraph, WorkflowEdgeGroup } from '@/types/workflow-build-spec'

export const SWITCH_PALETTE_ID = 'aw-switch'

export function isSwitchNode(node: DiagramNode): boolean {
  return node.paletteId === SWITCH_PALETTE_ID
}

/** Agents that run (Switch nodes route between agents and are not agents themselves). */
export function listExecutorNodes(diagram: Diagram): DiagramNode[] {
  return listAgentNodes(diagram).filter((node) => !isSwitchNode(node))
}

/** Every canvas without an orchestrator block is a WorkflowBuilder graph (`workflowType: "workflow"`). */
export function isGraphWorkflow(diagram: Diagram): boolean {
  return findOrchestrations(diagram).length === 0
}

const OPERATORS: Array<[RegExp, NonNullable<EdgeCondition['op']>]> = [
  [/^(>=)$/, 'gte'],
  [/^(<=)$/, 'lte'],
  [/^(==|=|equals|is)$/i, 'equals'],
  [/^(!=|not_equals|is not)$/i, 'not_equals'],
  [/^(>)$/, 'gt'],
  [/^(<)$/, 'lt'],
  [/^(contains|includes)$/i, 'contains'],
  [/^(in)$/i, 'in'],
]

function parseValue(raw: string): string | number | boolean | Array<string | number> {
  const value = raw.trim()
  if (/^\[.*\]$/.test(value)) {
    try {
      return JSON.parse(value.replace(/'/g, '"')) as Array<string | number>
    } catch {
      return value
    }
  }
  if (/^(['"]).*\1$/.test(value)) return value.slice(1, -1)
  if (value === 'true' || value === 'false') return value === 'true'
  const number = Number(value)
  return value !== '' && Number.isFinite(number) ? number : value
}

/** `category == "billing"`, `score >= 0.8`, `text contains "refund"`, `approved`… → a condition. */
export function parseCondition(expression: string): EdgeCondition | undefined {
  const trimmed = expression.trim()
  if (!trimmed) return undefined
  const match = trimmed.match(
    /^([A-Za-z_][\w.]*)\s*(>=|<=|==|!=|=|>|<|\bnot_equals\b|\bequals\b|\bis not\b|\bis\b|\bcontains\b|\bincludes\b|\bin\b)\s*(.+)$/i,
  )
  if (match) {
    const op = OPERATORS.find(([pattern]) => pattern.test(match[2].trim()))?.[1]
    if (op) return { expression: trimmed, field: match[1], op, value: parseValue(match[3]) }
  }
  if (/^[A-Za-z_][\w.]*$/.test(trimmed)) return { expression: trimmed, field: trimmed, op: 'exists' }
  return { expression: trimmed }
}

const byOrder = (a: DiagramEdge, b: DiagramEdge) =>
  (a.connector?.executionOrder ?? 0) - (b.connector?.executionOrder ?? 0)

/** The WorkflowBuilder graph for a canvas of agents wired with connectors. */
export function buildWorkflowBuilderGraph(diagram: Diagram): WorkflowBuilderGraph {
  const agents = listExecutorNodes(diagram)
  const agentIds = new Set(agents.map((node) => node.id))
  const switches = diagram.nodes.filter(isSwitchNode)
  let counter = 0
  const nextId = () => `eg_${++counter}`
  const groups: WorkflowEdgeGroup[] = []

  // Switch node: each agent feeding it gets one switch-case group over the Switch's connectors.
  for (const node of switches) {
    const out = diagram.edges.filter((edge) => edge.from === node.id && agentIds.has(edge.to)).sort(byOrder)
    const cases = out.filter((edge) => edge.connector?.condition?.trim())
    const fallback = out.find((edge) => !edge.connector?.condition?.trim())
    if (cases.length === 0 && !fallback) continue
    for (const input of diagram.edges.filter((edge) => edge.to === node.id && agentIds.has(edge.from))) {
      groups.push({
        id: nextId(),
        type: 'switch_case',
        method: 'add_switch_case_edge_group',
        source: input.from,
        switchNodeId: node.id,
        cases: cases.map((edge) => ({
          target: edge.to,
          condition: parseCondition(edge.connector!.condition)!,
        })),
        ...(fallback ? { default: fallback.to } : {}),
        connectorIds: [input.id, ...out.map((edge) => edge.id)],
      })
    }
  }

  // Agent → agent connectors: several into one is fan-in, one into several is fan-out, else one edge.
  const edges = diagram.edges.filter((edge) => agentIds.has(edge.from) && agentIds.has(edge.to))
  const claimed = new Set<string>()
  const groupBy = (key: 'from' | 'to') => {
    const map = new Map<string, DiagramEdge[]>()
    for (const edge of edges)
      if (!claimed.has(edge.id)) map.set(edge[key], [...(map.get(edge[key]) ?? []), edge])
    return map
  }
  for (const [target, arriving] of groupBy('to')) {
    if (arriving.length < 2) continue
    arriving.forEach((edge) => claimed.add(edge.id))
    groups.push({
      id: nextId(),
      type: 'fan_in',
      method: 'add_fan_in_edges',
      sources: arriving.map((edge) => edge.from),
      target,
      connectorIds: arriving.map((edge) => edge.id),
    })
  }
  for (const [source, leaving] of groupBy('from')) {
    if (leaving.length < 2) continue
    leaving.forEach((edge) => claimed.add(edge.id))
    groups.push({
      id: nextId(),
      type: 'fan_out',
      method: 'add_fan_out_edges',
      source,
      targets: leaving.map((edge) => edge.to),
      connectorIds: leaving.map((edge) => edge.id),
    })
  }
  for (const edge of edges) {
    if (claimed.has(edge.id)) continue
    const condition = parseCondition(edge.connector?.condition ?? '')
    groups.push({
      id: nextId(),
      type: 'edge',
      method: 'add_edge',
      source: edge.from,
      target: edge.to,
      ...(condition ? { condition } : {}),
      connectorIds: [edge.id],
    })
  }

  // Start: what the Start node connects to, else the agents nothing leads to.
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]))
  const reached = new Set(
    diagram.edges
      .filter((edge) => agentIds.has(edge.from) || nodesById.get(edge.from)?.paletteId === SWITCH_PALETTE_ID)
      .map((edge) => edge.to),
  )
  const fromStart = diagram.edges.filter((edge) => {
    const node = nodesById.get(edge.from)
    return node && isStartFlowNode(node) && agentIds.has(edge.to)
  })
  const startExecutorIds = fromStart.length
    ? [...new Set(fromStart.map((edge) => edge.to))]
    : agents.filter((node) => !reached.has(node.id)).map((node) => node.id)
  // Outputs: what connects to End, else the agents that lead nowhere.
  const leads = new Set(
    diagram.edges
      .filter((edge) => agentIds.has(edge.to) || nodesById.get(edge.to)?.paletteId === SWITCH_PALETTE_ID)
      .map((edge) => edge.from),
  )
  const toEnd = diagram.edges.filter((edge) => {
    const node = nodesById.get(edge.to)
    return node && isEndFlowNode(node) && agentIds.has(edge.from)
  })
  const outputExecutorIds = toEnd.length
    ? [...new Set(toEnd.map((edge) => edge.from))]
    : agents.filter((node) => !leads.has(node.id)).map((node) => node.id)

  return { builder: 'WorkflowBuilder', startExecutorIds, outputExecutorIds, edgeGroups: groups }
}
