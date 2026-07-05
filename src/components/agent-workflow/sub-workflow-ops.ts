import {
  createNodeId,
  createPage,
  type Diagram,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
  defaultAgentConfig,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { isAgentNode } from '@/components/agent-workflow/tool-agent-mapping'

export const SUB_WORKFLOW_PALETTE_ID = 'aw-sub-workflow'

function createEdgeId(): string {
  return `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function collectAgentCluster(diagram: Diagram, agentIds: string[]): Set<string> {
  const ids = new Set<string>()
  for (const agentId of agentIds) {
    ids.add(agentId)
    for (const node of diagram.nodes) {
      if (node.mappedAgentId === agentId) ids.add(node.id)
    }
  }
  return ids
}

function nodeBounds(nodes: DiagramNode[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  centerX: number
  centerY: number
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 120, centerY: 80 }
  }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const node of nodes) {
    const width = node.width ?? AGENT_NODE_WIDTH
    const height = node.height ?? AGENT_NODE_HEIGHT
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + width)
    maxY = Math.max(maxY, node.y + height)
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}

export function isSubWorkflowNode(node: DiagramNode): boolean {
  return node.paletteId === SUB_WORKFLOW_PALETTE_ID || Boolean(node.subWorkflowPageId)
}

export function remapDiagramIds(source: Diagram): Diagram {
  const idMap = new Map<string, string>()
  for (const node of source.nodes) {
    idMap.set(node.id, createNodeId())
  }

  const nodes = source.nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id)!,
    mappedAgentId:
      node.mappedAgentId && idMap.has(node.mappedAgentId)
        ? idMap.get(node.mappedAgentId)
        : node.mappedAgentId,
  }))

  const edges = source.edges.map((edge) => ({
    ...edge,
    id: createEdgeId(),
    from: idMap.get(edge.from) ?? edge.from,
    to: idMap.get(edge.to) ?? edge.to,
  }))

  return { nodes, edges }
}

export function insertDiagramAt(
  target: Diagram,
  source: Diagram,
  offset: { x: number; y: number },
): Diagram {
  const remapped = remapDiagramIds(source)
  const positionedNodes = remapped.nodes.map((node) => ({
    ...node,
    x: node.x + offset.x,
    y: node.y + offset.y,
  }))
  return {
    nodes: [...target.nodes, ...positionedNodes],
    edges: [...target.edges, ...remapped.edges],
  }
}

export function createSubWorkflowNode(
  pageId: string,
  label: string,
  position: { x: number; y: number },
): DiagramNode {
  return {
    id: createNodeId(),
    paletteId: SUB_WORKFLOW_PALETTE_ID,
    label,
    x: position.x - AGENT_NODE_WIDTH / 2,
    y: position.y - AGENT_NODE_HEIGHT / 2,
    width: AGENT_NODE_WIDTH,
    height: AGENT_NODE_HEIGHT,
    subWorkflowPageId: pageId,
    agent: {
      ...defaultAgentConfig(SUB_WORKFLOW_PALETTE_ID, label),
      agentType: 'control',
      description: 'Nested workflow mounted as a single agent.',
      instructions: 'Run the linked sub-workflow and return its output to the parent flow.',
    },
  }
}

export interface ConvertToSubWorkflowResult {
  doc: DiagramDocument
  subWorkflowNodeId: string
  subWorkflowPageId: string
}

export function convertAgentsToSubWorkflow(
  doc: DiagramDocument,
  activePageId: string,
  agentIds: string[],
  subWorkflowName: string,
): ConvertToSubWorkflowResult | { error: string } {
  const page = doc.pages.find((candidate) => candidate.id === activePageId)
  if (!page) return { error: 'Active page not found.' }

  const uniqueAgentIds = [
    ...new Set(
      agentIds.filter((id) => {
        const node = page.diagram.nodes.find((candidate) => candidate.id === id)
        return node && isAgentNode(node) && !isSubWorkflowNode(node)
      }),
    ),
  ]

  if (uniqueAgentIds.length < 2) {
    return { error: 'Select at least two agents to convert into a sub-workflow.' }
  }

  const clusterIds = collectAgentCluster(page.diagram, uniqueAgentIds)
  const clusterNodes = page.diagram.nodes.filter((node) => clusterIds.has(node.id))
  const clusterEdges = page.diagram.edges.filter(
    (edge) => clusterIds.has(edge.from) && clusterIds.has(edge.to),
  )

  const bounds = nodeBounds(clusterNodes)
  const normalizedNodes = clusterNodes.map((node) => ({
    ...node,
    x: node.x - bounds.minX + 48,
    y: node.y - bounds.minY + 48,
  }))

  const subPage = createPage(subWorkflowName.trim() || 'Sub-workflow')
  subPage.diagram = {
    nodes: normalizedNodes,
    edges: clusterEdges.map((edge) => ({ ...edge })),
  }

  const subNode = createSubWorkflowNode(subPage.id, subWorkflowName.trim() || 'Sub-workflow', {
    x: bounds.centerX,
    y: bounds.centerY,
  })

  const remainingNodes = page.diagram.nodes.filter((node) => !clusterIds.has(node.id))
  const remainingEdges: DiagramEdge[] = []

  for (const edge of page.diagram.edges) {
    const fromIn = clusterIds.has(edge.from)
    const toIn = clusterIds.has(edge.to)
    if (fromIn && toIn) continue
    if (!fromIn && !toIn) {
      remainingEdges.push(edge)
      continue
    }
    if (fromIn && !toIn) {
      remainingEdges.push({ ...edge, id: createEdgeId(), from: subNode.id })
      continue
    }
    remainingEdges.push({ ...edge, id: createEdgeId(), to: subNode.id })
  }

  const updatedDiagram: Diagram = {
    nodes: [...remainingNodes, subNode],
    edges: remainingEdges,
  }

  const updatedPages = doc.pages.map((candidate) =>
    candidate.id === activePageId ? { ...candidate, diagram: updatedDiagram } : candidate,
  )

  return {
    doc: { ...doc, pages: [...updatedPages, subPage] },
    subWorkflowNodeId: subNode.id,
    subWorkflowPageId: subPage.id,
  }
}

export function mountPageAsSubWorkflow(
  doc: DiagramDocument,
  activePageId: string,
  sourcePageId: string,
  position: { x: number; y: number },
): ConvertToSubWorkflowResult | { error: string } {
  const sourcePage = doc.pages.find((page) => page.id === sourcePageId)
  if (!sourcePage) return { error: 'Workflow page not found.' }
  if (sourcePageId === activePageId) {
    return { error: 'Cannot mount the active page into itself.' }
  }

  const subNode = createSubWorkflowNode(sourcePage.id, sourcePage.name, position)
  const page = doc.pages.find((candidate) => candidate.id === activePageId)
  if (!page) return { error: 'Active page not found.' }

  const updatedPages = doc.pages.map((candidate) =>
    candidate.id === activePageId
      ? {
          ...candidate,
          diagram: {
            ...candidate.diagram,
            nodes: [...candidate.diagram.nodes, subNode],
          },
        }
      : candidate,
  )

  return {
    doc: { ...doc, pages: updatedPages },
    subWorkflowNodeId: subNode.id,
    subWorkflowPageId: sourcePage.id,
  }
}

/** Bounding box center for placing inserted content. */
export function diagramContentCenter(diagram: Diagram): { x: number; y: number } {
  if (diagram.nodes.length === 0) return { x: 160, y: 120 }
  const bounds = nodeBounds(diagram.nodes)
  return { x: bounds.centerX, y: bounds.centerY }
}

export function offsetToPlaceDiagram(
  _target: Diagram,
  source: Diagram,
  anchor: { x: number; y: number },
): { x: number; y: number } {
  const sourceCenter = diagramContentCenter(source)
  return {
    x: anchor.x - sourceCenter.x,
    y: anchor.y - sourceCenter.y,
  }
}

export function countAgentsInPage(doc: DiagramDocument, pageId: string): number {
  const page = doc.pages.find((candidate) => candidate.id === pageId)
  if (!page) return 0
  return page.diagram.nodes.filter(isAgentNode).length
}

export function subWorkflowAgentCount(doc: DiagramDocument, node: DiagramNode): number {
  if (!node.subWorkflowPageId) return 0
  return countAgentsInPage(doc, node.subWorkflowPageId)
}

export function mergeImportedDocument(
  doc: DiagramDocument,
  imported: DiagramDocument,
): { doc: DiagramDocument; firstPageId: string | null } {
  if (imported.pages.length === 0) {
    return { doc, firstPageId: null }
  }

  const newPages = imported.pages.map((page) => {
    const created = createPage(page.name)
    return {
      ...created,
      diagram: remapDiagramIds(page.diagram),
    }
  })

  return {
    doc: { ...doc, pages: [...doc.pages, ...newPages] },
    firstPageId: newPages[0]?.id ?? null,
  }
}
