import type { ReactNode } from 'react'
import { importWorkflowV4 } from '@/components/agent-workflow/import-workflow-v4'
import type { Diagram } from '@/components/designer/diagram-types'
import type { DraftDiff } from '@/services/workflow-assistant-api'
import type { WorkflowV4Document } from '@/types/workflow-v4'

/**
 * The assistant's draft as the canvas shows it before it is accepted: the draft's workflow with what it
 * removed still drawn, and every block and connector marked added, removed or changed.
 */

export type DiffState = 'added' | 'removed' | 'changed'

export interface DraftPreview {
  diagram: Diagram
  nodes: Record<string, DiffState>
  edges: Record<string, DiffState>
  counts: Record<DiffState, number>
  /** The draft started from an empty workflow (only its start and end). */
  isNew: boolean
}

/** A preview as the canvas shows it, with the review bar that floats over it. */
export interface CanvasDraftPreview {
  preview: DraftPreview
  bar: ReactNode
}

const diagramOf = (document: WorkflowV4Document): Diagram => {
  const imported = importWorkflowV4(document).document
  return (imported.pages.find((page) => page.id === imported.activePageId) ?? imported.pages[0]).diagram
}

const missingFrom = <T extends { id: string }>(items: T[] | undefined, kept: T[] | undefined): T[] => {
  const ids = new Set((kept ?? []).map((item) => item.id))
  return (items ?? []).filter((item) => !ids.has(item.id))
}

/** The draft plus what it removed from the base, so one layout places both. */
function mergedDocument(base: WorkflowV4Document, draft: WorkflowV4Document): WorkflowV4Document {
  return {
    ...draft,
    agents: [...(draft.agents ?? []), ...missingFrom(base.agents, draft.agents)],
    tools: [...(draft.tools ?? []), ...missingFrom(base.tools, draft.tools)],
    graph: {
      ...draft.graph,
      nodes: [...draft.graph.nodes, ...missingFrom(base.graph.nodes, draft.graph.nodes)],
      edges: [...(draft.graph.edges ?? []), ...missingFrom(base.graph.edges, draft.graph.edges)],
    },
  }
}

export function buildDraftPreview(base: WorkflowV4Document, draft: WorkflowV4Document, diff: DraftDiff): DraftPreview {
  const before = diagramOf(base)
  const after = diagramOf(draft)
  const diagram = diagramOf(mergedDocument(base, draft))

  const beforeNodes = new Set(before.nodes.map((node) => node.id))
  const afterNodes = new Set(after.nodes.map((node) => node.id))
  const changedNodes = new Set(diff.nodes.changed.map((item) => item.id))
  const changedAgents = new Set(((diff.agents as DraftDiff['nodes'] | undefined)?.changed ?? []).map((item) => item.id))
  const changedTools = new Set(((diff.tools as DraftDiff['nodes'] | undefined)?.changed ?? []).map((item) => item.id))
  const agentOfNode = new Map(
    draft.graph.nodes.flatMap((node) => (node.type === 'agent' ? [[node.id, node.agentId] as const] : [])),
  )

  const nodes: Record<string, DiffState> = {}
  for (const node of diagram.nodes) {
    if (!beforeNodes.has(node.id)) nodes[node.id] = 'added'
    else if (!afterNodes.has(node.id)) nodes[node.id] = 'removed'
    else {
      // Tool blocks are drawn per agent as `<agent node>:<tool id>`
      const toolId = node.mappedAgentId ? node.id.split(':').pop() : undefined
      const agentId = agentOfNode.get(node.id)
      if (changedNodes.has(node.id) || (agentId && changedAgents.has(agentId)) || (toolId && changedTools.has(toolId))) {
        nodes[node.id] = 'changed'
      }
    }
  }

  const beforeEdges = new Set(before.edges.map((edge) => edge.id))
  const afterEdges = new Set(after.edges.map((edge) => edge.id))
  const changedEdges = new Set(diff.edges.changed.map((item) => item.id))
  const edges: Record<string, DiffState> = {}
  for (const edge of diagram.edges) {
    if (!beforeEdges.has(edge.id)) edges[edge.id] = 'added'
    else if (!afterEdges.has(edge.id)) edges[edge.id] = 'removed'
    else if (changedEdges.has(edge.id)) edges[edge.id] = 'changed'
  }

  const counts: Record<DiffState, number> = { added: 0, removed: 0, changed: 0 }
  // Counted by step: a tool block under an agent goes with its agent
  for (const node of diagram.nodes) if (nodes[node.id] && !node.mappedAgentId) counts[nodes[node.id]] += 1
  const isNew = base.graph.nodes.every((node) => node.type === 'start' || node.type === 'end')
  return { diagram, nodes, edges, counts, isNew }
}
