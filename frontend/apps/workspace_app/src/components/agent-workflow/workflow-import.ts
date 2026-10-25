import {
  createNodeId,
  createPage,
  normalizeDocument,
  type Diagram,
  type DiagramDocument,
  type DiagramNode,
  type DiagramPage,
} from '@/components/designer/diagram-types'
import { listAgentNodes, listToolsForAgent } from '@/components/agent-workflow/tool-agent-mapping'
import { isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import type { WorkflowConfiguration } from '@/services/workflow-configuration-store'
import type { WorkflowBuildSpec } from '@/types/workflow-build-spec'

function createEdgeId(): string {
  return `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export interface ImportedWorkflow {
  document: DiagramDocument
  /** Configuration tab settings, when the file is a build spec that carries them. */
  configuration?: Partial<WorkflowConfiguration>
}

function configurationFromSettings(settings: WorkflowBuildSpec['settings'] | undefined) {
  if (!settings?.observability && !settings?.runtime) return undefined
  const { tracing, openTelemetry } = settings.observability ?? {}
  const runtime = settings.runtime
  const configuration: Partial<WorkflowConfiguration> = {
    logLevel: settings.logging?.level,
    tracingEnabled: tracing?.enabled,
    captureSensitiveData: tracing?.captureSensitiveData,
    persistExecutionHistory: tracing?.persistExecutionHistory,
    openTelemetryEnabled: openTelemetry?.enabled,
    otelExporter: openTelemetry?.exporter,
    otelEndpoint: openTelemetry?.endpoint,
    otelServiceName: openTelemetry?.serviceName,
    otelHeaders: openTelemetry?.headers
      ? Object.entries(openTelemetry.headers)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n')
      : undefined,
    traceSampleRate: openTelemetry?.sampleRate,
    metricsEnabled: openTelemetry?.metricsEnabled,
    maxIterations: runtime?.maxIterations,
    timeoutSeconds: runtime?.timeoutSeconds,
    retryAttempts: runtime?.retryAttempts,
    checkpointingEnabled: runtime?.checkpointingEnabled,
  }
  return Object.fromEntries(
    Object.entries(configuration).filter(([, value]) => value !== undefined),
  ) as Partial<WorkflowConfiguration>
}

/**
 * Read a workflow file: the Code tab's build spec JSON (its `canvas` block holds the pages and
 * node positions) or a bare canvas document. Throws when the file holds no workflow.
 */
export function parseWorkflowFile(text: string): ImportedWorkflow {
  const parsed = JSON.parse(text) as Record<string, unknown>
  const spec =
    parsed && typeof parsed === 'object' && 'canvas' in parsed
      ? (parsed as unknown as WorkflowBuildSpec)
      : null
  const source = spec ? spec.canvas : parsed
  const hasCanvas =
    source &&
    typeof source === 'object' &&
    (Array.isArray((source as { pages?: unknown }).pages) ||
      Array.isArray((source as { nodes?: unknown }).nodes))
  if (!hasCanvas) {
    throw new Error(
      'agents' in (parsed ?? {})
        ? 'This build spec has no canvas block. Copy it again from the Code tab.'
        : 'This file is not a workflow export.',
    )
  }
  return {
    document: spec ? applyNodePositions(normalizeDocument(source), parsed) : normalizeDocument(source),
    configuration: spec ? configurationFromSettings(spec.settings) : undefined,
  }
}

export interface NodePosition {
  x: number
  y: number
  width?: number
  height?: number
}

function positionOf(node: DiagramNode): NodePosition {
  return {
    x: Math.round(node.x),
    y: Math.round(node.y),
    ...(node.width ? { width: node.width } : {}),
    ...(node.height ? { height: node.height } : {}),
  }
}

/** Tool nodes in the order the build spec lists them (each agent's tools in turn). */
function orderedTools(diagram: Diagram): DiagramNode[] {
  return listAgentNodes(diagram).flatMap((agent) => listToolsForAgent(diagram, agent.id))
}

/** Each agent and tool in the Code tab JSON with its canvas `position`; each tool with its node `id`. */
export function withNodePositions<Spec extends { agents: Array<{ id: string }>; tools: unknown[] }>(
  spec: Spec,
  diagram: Diagram,
): Spec {
  const nodesById = new Map(diagram.nodes.map((node) => [node.id, node]))
  const tools = orderedTools(diagram)
  return {
    ...spec,
    agents: spec.agents.map((agent) => {
      const node = nodesById.get(agent.id)
      return node ? { ...agent, position: positionOf(node) } : agent
    }),
    tools: spec.tools.map((tool, index) =>
      tools[index] ? { id: tools[index].id, ...(tool as object), position: positionOf(tools[index]) } : tool,
    ),
  }
}

/** Apply `position` edits made on agents and tools back onto the active canvas page. */
function applyNodePositions(document: DiagramDocument, parsed: Record<string, unknown>): DiagramDocument {
  const agents = Array.isArray(parsed.agents)
    ? (parsed.agents as Array<{ id?: string; position?: NodePosition }>)
    : []
  const tools = Array.isArray(parsed.tools) ? (parsed.tools as Array<{ position?: NodePosition }>) : []
  const page = document.pages.find((candidate) => candidate.id === document.activePageId) ?? document.pages[0]
  if (!page || (agents.length === 0 && tools.length === 0)) return document

  const positions = new Map<string, NodePosition>()
  for (const agent of agents) {
    if (agent.id && agent.position) positions.set(agent.id, agent.position)
  }
  orderedTools(page.diagram).forEach((node, index) => {
    const position = tools[index]?.position
    if (position) positions.set(node.id, position)
  })
  const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
  const nodes = page.diagram.nodes.map((node) => {
    const position = positions.get(node.id)
    if (!position) return node
    return {
      ...node,
      ...(isNumber(position.x) ? { x: position.x } : {}),
      ...(isNumber(position.y) ? { y: position.y } : {}),
      ...(isNumber(position.width) ? { width: position.width } : {}),
      ...(isNumber(position.height) ? { height: position.height } : {}),
    }
  })
  return {
    ...document,
    pages: document.pages.map((candidate) =>
      candidate === page ? { ...candidate, diagram: { ...candidate.diagram, nodes } } : candidate,
    ),
  }
}

/** A `workflowConfig` value with old node ids swapped for new ones (agent fields store node ids). */
function remapConfigValue(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === 'string') return idMap.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => remapConfigValue(item, idMap))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, remapConfigValue(item, idMap)]),
    )
  }
  return value
}

function remapDiagram(
  diagram: Diagram,
  idMap: Map<string, string>,
  pageIdMap: Map<string, string>,
  offset = { x: 0, y: 0 },
): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      x: node.x + offset.x,
      y: node.y + offset.y,
      ...(node.mappedAgentId ? { mappedAgentId: idMap.get(node.mappedAgentId) ?? node.mappedAgentId } : {}),
      ...(node.subWorkflowPageId
        ? { subWorkflowPageId: pageIdMap.get(node.subWorkflowPageId) ?? node.subWorkflowPageId }
        : {}),
      ...(node.agent?.workflowConfig
        ? {
            agent: {
              ...node.agent,
              workflowConfig: remapConfigValue(node.agent.workflowConfig, idMap) as Record<string, unknown>,
            },
          }
        : {}),
    })),
    edges: diagram.edges.map((edge) => ({
      ...edge,
      id: createEdgeId(),
      from: idMap.get(edge.from) ?? edge.from,
      to: idMap.get(edge.to) ?? edge.to,
    })),
  }
}

/** A tab with nothing on it yet but its default Start node counts as empty for import. */
export function isBlankDiagram(diagram: Diagram): boolean {
  return diagram.edges.length === 0 && diagram.nodes.every(isStartFlowNode)
}

/**
 * Copy an imported workflow into a page of `target`: its main page's nodes land on that page
 * (shifted by `offset`), and the sub-workflow pages it uses come along as new sub tabs. Node and
 * page ids are renewed so the same file can be imported more than once. Onto an empty page the
 * file also brings its flow direction, pattern and model.
 */
export function importIntoDocument(
  target: DiagramDocument,
  imported: DiagramDocument,
  targetPageId: string,
  offset: { x: number; y: number },
): { document: DiagramDocument; pageName: string } | null {
  const sourcePage = imported.pages.find((page) => page.id === imported.activePageId) ?? imported.pages[0]
  const targetPage = target.pages.find((page) => page.id === targetPageId)
  if (!sourcePage || !targetPage) return null

  // The sub-workflow pages the main page uses, and the ones those use in turn.
  const pagesById = new Map(imported.pages.map((page) => [page.id, page]))
  const subPages: DiagramPage[] = []
  const queue = [sourcePage]
  const seen = new Set([sourcePage.id])
  while (queue.length > 0) {
    for (const node of queue.shift()!.diagram.nodes) {
      const page = node.subWorkflowPageId ? pagesById.get(node.subWorkflowPageId) : undefined
      if (!page || seen.has(page.id)) continue
      seen.add(page.id)
      subPages.push(page)
      queue.push(page)
    }
  }

  const idMap = new Map<string, string>()
  for (const page of [sourcePage, ...subPages]) {
    for (const node of page.diagram.nodes) idMap.set(node.id, createNodeId())
  }
  const mainPageId =
    targetPage.kind === 'sub' && targetPage.parentPageId ? targetPage.parentPageId : targetPage.id
  const newSubPages = subPages.map((page) => ({
    ...createPage(page.name, { kind: 'sub', parentPageId: mainPageId }),
    sourceId: page.id,
  }))
  const pageIdMap = new Map(newSubPages.map((page) => [page.sourceId, page.id]))

  const startsEmpty = isBlankDiagram(targetPage.diagram)
  const inserted = remapDiagram(sourcePage.diagram, idMap, pageIdMap, offset)
  const pages = target.pages.map((page) => {
    if (page.id !== targetPageId) return page
    // A blank tab takes the file's canvas as is, its own Start included.
    if (startsEmpty) {
      return {
        ...page,
        name: sourcePage.name,
        diagram: { ...inserted, direction: sourcePage.diagram.direction ?? page.diagram.direction },
      }
    }
    // Otherwise one Start stays: the file's Start connectors move to the one already here.
    const existingStart = page.diagram.nodes.find(isStartFlowNode)
    const importedStartIds = new Set(inserted.nodes.filter(isStartFlowNode).map((node) => node.id))
    const merged =
      existingStart && importedStartIds.size > 0
        ? {
            nodes: inserted.nodes.filter((node) => !importedStartIds.has(node.id)),
            edges: inserted.edges
              .filter((edge) => !importedStartIds.has(edge.to))
              .map((edge) => (importedStartIds.has(edge.from) ? { ...edge, from: existingStart.id } : edge)),
          }
        : inserted
    return {
      ...page,
      diagram: {
        nodes: [...page.diagram.nodes, ...merged.nodes],
        edges: [...page.diagram.edges, ...merged.edges],
        direction: page.diagram.direction,
      },
    }
  })
  for (const { sourceId, ...page } of newSubPages) {
    pages.push({ ...page, diagram: remapDiagram(pagesById.get(sourceId)!.diagram, idMap, pageIdMap) })
  }

  // Onto an empty page the file's pattern and model come too; this workflow keeps its id and version.
  const workflow =
    startsEmpty && imported.workflow && target.workflow
      ? {
          ...target.workflow,
          executionType: imported.workflow.executionType ?? target.workflow.executionType,
          ...(imported.workflow.modelConfig ? { modelConfig: imported.workflow.modelConfig } : {}),
        }
      : target.workflow

  return { document: { ...target, pages, workflow }, pageName: sourcePage.name }
}
