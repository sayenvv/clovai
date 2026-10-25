import type { DiagramDocument } from '@/components/designer/diagram-types'
import { createWorkflowId, isWorkflowId } from '@/components/agent-workflow/agent-workflow-defaults'

/**
 * Every tab is its own workflow with its own unique id: the build spec's `meta.workflowId` and the
 * `workflow_id` column it is saved under. Read it through here, never from `doc.workflow`.
 */
export function pageWorkflowId(doc: DiagramDocument, pageId: string): string {
  return (
    doc.pages.find((page) => page.id === pageId)?.workflowId ?? doc.workflow?.workflowId ?? `wf_${pageId}`
  )
}

/**
 * `doc` with a workflow id on every tab; the same object when nothing was missing. Tabs saved before
 * ids were per tab: the main tab keeps the document's id (so its saved row and deployments stay
 * linked) and the others get new ones. A tab copied with another's id, or with an id that is
 * not a UUID, gets a new one.
 */
export function withPageWorkflowIds(doc: DiagramDocument): DiagramDocument {
  const seen = new Set<string>()
  // Only UUIDs are kept; older `wf_…` ids are replaced.
  const legacyId = isWorkflowId(doc.workflow?.workflowId) ? doc.workflow?.workflowId : undefined
  const legacyOwner =
    legacyId && !doc.pages.some((page) => page.workflowId === legacyId)
      ? (doc.pages.find((page) => page.id === doc.activeMainPageId) ??
          doc.pages.find((page) => page.kind !== 'sub' && !page.parentPageId) ??
          doc.pages[0])?.id
      : undefined

  let changed = false
  const pages = doc.pages.map((page) => {
    let workflowId = isWorkflowId(page.workflowId) ? page.workflowId : undefined
    if (!workflowId) workflowId = page.id === legacyOwner ? legacyId : undefined
    if (!workflowId || seen.has(workflowId)) workflowId = createWorkflowId()
    seen.add(workflowId)
    if (workflowId === page.workflowId) return page
    changed = true
    return { ...page, workflowId }
  })
  return changed ? { ...doc, pages } : doc
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A node-config value with old node ids swapped for new ones (agent fields store node ids). */
function remapIds(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === 'string') return idMap.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => remapIds(item, idMap))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapIds(item, idMap)]))
  }
  return value
}

/**
 * `doc` with a UUID id on every node (agents, tools and the rest); the same object when all
 * already have one. Older `node-…` ids are replaced, along with every reference to them:
 * connectors, a tool's agent, and orchestrator settings that name agents.
 */
export function withUuidNodeIds(doc: DiagramDocument): DiagramDocument {
  const idMap = new Map<string, string>()
  for (const page of doc.pages) {
    for (const node of page.diagram.nodes) {
      if (!UUID_PATTERN.test(node.id)) idMap.set(node.id, crypto.randomUUID())
    }
  }
  if (idMap.size === 0) return doc
  const swap = (id: string) => idMap.get(id) ?? id
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      diagram: {
        ...page.diagram,
        nodes: page.diagram.nodes.map((node) => ({
          ...node,
          id: swap(node.id),
          ...(node.mappedAgentId ? { mappedAgentId: swap(node.mappedAgentId) } : {}),
          ...(node.agent?.workflowConfig
            ? {
                agent: {
                  ...node.agent,
                  workflowConfig: remapIds(node.agent.workflowConfig, idMap) as Record<string, unknown>,
                },
              }
            : {}),
        })),
        edges: page.diagram.edges.map((edge) => ({ ...edge, from: swap(edge.from), to: swap(edge.to) })),
      },
    })),
  }
}
