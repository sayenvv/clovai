/**
 * A workflow format 4.0 document as a canvas tab, the reverse of `build-workflow-v4.ts`, so an accepted
 * assistant draft lands on the canvas like File → Import.
 *
 * End nodes are left out: a canvas workflow finishes at its last step, and saving adds the End back.
 * The result is laid out with the canvas's own layered layout (as Auto layout does): positions in a draft
 * come from adding and rewiring nodes one batch at a time and do not make a readable picture.
 * Agents keep their instructions, model, tools and response schema; teams become orchestrator blocks
 * (Magentic, group chat) or a router (handoff); approvals become Human review blocks; conditions become
 * Switch blocks. Node types the canvas has no block for yet (transform, emit, delay, ask user, wait for
 * event, loop, subworkflow, code, tool steps) become Executor blocks named after the node and are listed
 * in `losses`, since saving them from the canvas does not keep their 4.0 settings.
 */

import { WORKFLOW_CONNECTION_NAME, WORKFLOW_MODEL_PRESET } from '@/components/agent-workflow/workflow-model-config'
import { defaultAgentConfig, defaultConnectorConfig } from '@/components/agent-workflow/agent-workflow-defaults'
import { layoutWorkflowDiagram } from '@/components/agent-workflow/workflow-layout'
import type { ImportedWorkflow } from '@/components/agent-workflow/workflow-import'
import type { Diagram, DiagramEdge, DiagramNode, DiagramPage } from '@/components/designer/diagram-types'
import type { AgentNodeConfig, HttpToolConfig } from '@/types/agent-workflow'
import type { AgentV4, EdgeV4, NodeV4, ToolV4, WorkflowV4Document } from '@/types/workflow-v4'

const MAGENTIC_PROMPT_KEYS: Record<string, string> = {
  taskLedgerFacts: 'task_ledger_facts_prompt',
  taskLedgerPlan: 'task_ledger_plan_prompt',
  taskLedgerFull: 'task_ledger_full_prompt',
  taskLedgerFactsUpdate: 'task_ledger_facts_update_prompt',
  taskLedgerPlanUpdate: 'task_ledger_plan_update_prompt',
  progressLedger: 'progress_ledger_prompt',
  finalAnswer: 'final_answer_prompt',
}

export interface ImportedV4Workflow extends ImportedWorkflow {
  /** What the canvas cannot represent yet, one line each. */
  losses: string[]
}

/** `{{ x }}` as the canvas's plain condition text. */
function conditionText(expression: unknown): string {
  return typeof expression === 'string' ? expression.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '') : ''
}

/** 4.0 step types drawn as the canvas's Flow blocks (the generation spec maps them back). */
const FLOW_STEP_PALETTE: Record<string, string> = { ask_user: 'aw-ask-user', delay: 'aw-delay', wait_event: 'aw-wait-event' }

export function importWorkflowV4(document: WorkflowV4Document): ImportedV4Workflow {
  const losses: string[] = []
  const pageId = `page-v4-${document.meta.id}`
  // Loop bodies, each as a steps tab under the main one
  const extraPages: DiagramPage[] = []
  // Only meta and graph are required; every other section may be missing
  const graph = { ...document.graph, edges: document.graph.edges ?? [] }
  const agents = new Map((document.agents ?? []).map((agent) => [agent.id, agent]))
  const tools = new Map((document.tools ?? []).map((tool) => [tool.id, tool]))
  const models = new Map((document.models ?? []).map((model) => [model.id, model]))
  const connections = new Map((document.connections ?? []).map((connection) => [connection.id, connection]))
  const layout = document.canvas?.pages?.[0]?.layout ?? {}
  const edgesFrom = (id: string) => graph.edges.filter((edge) => edge.from === id)
  const hasFlowInto = (id: string) => graph.edges.some((edge) => edge.to === id && (edge.type ?? 'next') !== 'handoff')

  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []
  const position = (id: string, index: number) => layout[id] ?? { x: 220 * index, y: 0 }

  const agentConfig = (paletteId: string, label: string, agent: AgentV4 | undefined): AgentNodeConfig => {
    const config = defaultAgentConfig(paletteId, label)
    if (!agent) return config
    config.description = agent.description ?? ''
    if (agent.kind === 'native') {
      config.instructions = agent.instructions
      const model = agent.modelId ? models.get(agent.modelId) : undefined
      const connection = model ? connections.get(model.connectionId) : undefined
      // Its own model only on a model client of its own; otherwise it inherits the workflow's model
      if (model && model.name !== WORKFLOW_MODEL_PRESET && connection?.credentialId && connection.name !== WORKFLOW_CONNECTION_NAME) {
        config.model = model.model
        config.modelConnectionId = connection.credentialId
        if (typeof model.params?.temperature === 'number') config.temperature = model.params.temperature
      }
      if (agent.responseSchema) config.outputSchema = JSON.stringify(agent.responseSchema, null, 2)
      config.memoryEnabled = Boolean(agent.memory?.conversation)
      if (agent.contextProviderIds?.length) config.contextProviderIds = [...agent.contextProviderIds]
    }
    return config
  }

  graph.nodes.forEach((node, index) => {
    const at = position(node.id, index)
    const base = { id: node.id, label: node.name || node.type, x: at.x, y: at.y }
    // Flow steps the canvas draws as their own blocks; the block's name carries the question or event
    const step = node as unknown as {
      type: string
      question?: unknown
      seconds?: number
      source?: { event?: string }
      output?: unknown
      over?: unknown
      as?: string
      mode?: 'sequential' | 'parallel'
      body?: WorkflowV4Document['graph']
    }
    if (step.type === 'transform') {
      const config = defaultAgentConfig('aw-transform', base.label)
      config.transformOutput = typeof step.output === 'string' ? step.output : JSON.stringify(step.output ?? '', null, 2)
      nodes.push({ ...base, paletteId: 'aw-transform', agent: config })
      return
    }
    if (step.type === 'loop') {
      const config = defaultAgentConfig('aw-loop', base.label)
      config.loopOver = typeof step.over === 'string' ? step.over : JSON.stringify(step.over ?? '')
      config.loopItem = step.as ?? 'item'
      config.loopMode = step.mode ?? 'sequential'
      // The body becomes the loop's steps tab: its steps after a Start, imported the same way
      let stepsPageId: string | undefined
      if (step.body?.nodes?.length) {
        const startId = `${node.id}:start`
        const body = importWorkflowV4({
          ...document,
          meta: { ...document.meta, id: `${document.meta.id}:${node.id}`, name: `${base.label} steps` },
          canvas: undefined,
          graph: {
            startNodeId: startId,
            nodes: [{ id: startId, name: 'Start', type: 'start' } as NodeV4, ...step.body.nodes],
            edges: [{ id: `${startId}:edge`, from: startId, to: step.body.startNodeId } as EdgeV4, ...(step.body.edges ?? [])],
          },
        } as unknown as WorkflowV4Document)
        const bodyPage = body.document.pages[0]
        stepsPageId = `page-loop-${node.id}`
        extraPages.push({ ...bodyPage, id: stepsPageId, name: `${base.label} steps`, kind: 'sub', parentPageId: pageId }, ...body.document.pages.slice(1))
        losses.push(...body.losses)
      }
      nodes.push({ ...base, paletteId: 'aw-loop', agent: config, ...(stepsPageId ? { subWorkflowPageId: stepsPageId } : {}) })
      return
    }
    const flowPalette = FLOW_STEP_PALETTE[step.type]
    if (flowPalette) {
      const label =
        step.type === 'ask_user' && typeof step.question === 'string' && !step.question.includes('{{')
          ? step.question
          : step.type === 'wait_event' && step.source?.event
            ? step.source.event
            : base.label
      const config = defaultAgentConfig(flowPalette, label)
      if (step.type === 'delay' && typeof step.seconds === 'number') config.timeoutSeconds = step.seconds
      nodes.push({ ...base, label, paletteId: flowPalette, agent: config })
      return
    }
    switch (node.type) {
      case 'start':
        nodes.push({ ...base, paletteId: 'aw-start' })
        return
      case 'end':
        // Not drawn; a custom output is the one thing the canvas cannot keep
        if (node.output !== undefined && node.output !== '{{ last.output }}') losses.push(`${base.label}: its output setting is not shown on the canvas`)
        return
      case 'agent': {
        const agent = agents.get(node.agentId)
        const team = node.team
        const handoffEntry = Boolean(node.handoff) && hasFlowInto(node.id)
        const paletteId = team?.strategy === 'magentic'
          ? 'aw-orchestrator'
          : team?.strategy === 'group_chat'
            ? 'aw-group-manager'
            : handoffEntry
              ? 'aw-router'
              : 'aw-agent'
        const config = agentConfig(paletteId, base.label, agent)
        if (team?.strategy === 'magentic') {
          config.workflowConfig = {
            max_round_count: team.maxRounds,
            max_stall_count: team.maxStalls,
            max_reset_count: team.maxResets,
            enable_plan_review: team.planReview,
            ...Object.fromEntries(
              Object.entries(team.prompts ?? {})
                .filter(([, value]) => value)
                .map(([key, value]) => [MAGENTIC_PROMPT_KEYS[key] ?? key, value]),
            ),
          }
        } else if (team?.strategy === 'group_chat') {
          config.workflowConfig = { max_rounds: team.maxRounds, selection_func: team.selection === 'round_robin' ? 'round_robin' : null }
        } else if (handoffEntry) {
          config.workflowConfig = { max_handoffs: node.handoff?.maxHandoffs }
        }
        if (node.retry?.maxAttempts) config.retryCount = node.retry.maxAttempts
        nodes.push({ ...base, paletteId, agent: config })
        if (agent?.kind === 'native') {
          // Library agents carry their tools in overrides; a missing list means none
          ;(agent.toolIds ?? []).forEach((toolId, toolIndex) => {
            const tool = tools.get(toolId)
            if (tool) nodes.push(toolNode(tool, node.id, at, toolIndex))
          })
        }
        return
      }
      case 'approval': {
        const config = defaultAgentConfig('aw-reviewer', base.label)
        config.humanInTheLoop = true
        config.approvalRole = node.approvers?.roles?.[0] ?? 'reviewer'
        config.approvalMessage = typeof node.message === 'string' ? node.message : config.approvalMessage
        config.approvalTimeoutMinutes = Math.round((node.timeoutSeconds ?? 3600) / 60)
        const backLoop = edgesFrom(node.id).find((edge) => edge.on === 'rejected' && edge.maxTraversals)
        if (backLoop) {
          config.feedbackRevisionsEnabled = true
          config.maxFeedbackRevisions = backLoop.maxTraversals
        }
        nodes.push({ ...base, paletteId: 'aw-reviewer', agent: config })
        return
      }
      case 'condition':
        nodes.push({ ...base, paletteId: 'aw-switch' })
        return
      default: {
        const config = defaultAgentConfig('aw-executor', base.label)
        config.description = `Workflow 4.0 ${node.type.replace('_', ' ')} node`
        nodes.push({ ...base, paletteId: 'aw-executor', agent: config })
        losses.push(`${base.label}: ${node.type.replace('_', ' ')} nodes show as Executor blocks for now`)
      }
    }
  })

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const drawn = new Set(nodes.map((node) => node.id))
  const routers = new Set(graph.nodes.filter((node) => node.type === 'agent' && node.handoff && hasFlowInto(node.id)).map((node) => node.id))
  for (const edge of graph.edges) {
    const kept = canvasEdge(edge, nodeById, routers)
    if (kept && drawn.has(kept.from) && drawn.has(kept.to)) edges.push(kept)
    else if (edge.type === 'error') losses.push(`An error path from ${nodeById.get(edge.from)?.name ?? 'a node'} is not shown`)
  }

  const diagram = layoutWorkflowDiagram({ nodes, edges } satisfies Diagram, 'horizontal')
  return {
    document: {
      pages: [{ id: pageId, name: document.meta.name, diagram, kind: 'main', workflowId: document.meta.id }, ...extraPages],
      activePageId: pageId,
    },
    losses: [...new Set(losses)],
  }
}

function toolNode(tool: ToolV4, agentId: string, at: { x: number; y: number }, index: number): DiagramNode {
  const paletteId = tool.kind === 'mcp' ? 'aw-mcp-tool' : 'aw-tool'
  const config = defaultAgentConfig(paletteId, tool.name)
  config.description = tool.description ?? config.description
  config.approvalMode = tool.approval === 'always' ? 'always_require' : 'never_require'
  if (tool.kind === 'mcp') config.mcpUrl = tool.server.url
  if (tool.kind === 'function') config.handler = tool.handler
  if (tool.kind === 'http') {
    config.tools = ['api_call']
    config.http = httpConfig(tool)
    if (tool.inputSchema) config.inputSchema = JSON.stringify(tool.inputSchema, null, 2)
  }
  // One block per agent that uses the tool, so a shared tool gets an id per agent
  return { id: `${agentId}:${tool.id}`, paletteId, label: tool.name, x: at.x + 170 * index, y: at.y + 112, agent: config, mappedAgentId: agentId }
}

/** The canvas connector for a 4.0 edge, or null when the canvas shows it another way (or not at all). */
function canvasEdge(edge: EdgeV4, nodes: Map<string, NodeV4>, routers: Set<string>): DiagramEdge | null {
  const source = nodes.get(edge.from)
  const type = edge.type ?? 'next'
  if (type === 'error') return null
  // The router connects to its peers once; the way back is implied.
  if (type === 'handoff' && !routers.has(edge.from)) return null
  // A rejected approval either loops back (feedback revisions, kept on the reviewer) or ends the run.
  if (source?.type === 'approval' && edge.on === 'rejected') return null
  const connector = defaultConnectorConfig()
  if (source?.type === 'condition' && edge.on === 'true') connector.condition = conditionText(source.if)
  else if (edge.when) connector.condition = conditionText(edge.when)
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    fromSide: 'right',
    toSide: 'left',
    ...(connector.condition ? { connector } : {}),
  }
}


/** A 4.0 http tool's request, auth and long-running settings, as the HTTP tool panel edits them. */
function httpConfig(tool: Extract<ToolV4, { kind: 'http' }>): HttpToolConfig {
  const request = tool.request as Record<string, unknown>
  const auth = (tool as { auth?: Record<string, unknown> }).auth
  const job = (tool as { longRunning?: Record<string, unknown> }).longRunning
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined)
  const json = (value: unknown) => (value && typeof value === 'object' ? JSON.stringify(value, null, 2) : undefined)
  const number = (value: unknown) => (typeof value === 'number' ? value : undefined)
  const method = String(request.method ?? 'GET').toUpperCase()
  return {
    method: (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? method : 'GET') as HttpToolConfig['method'],
    url: text(request.url) ?? '',
    headers: json(request.headers),
    query: json(request.query),
    body: json(request.body),
    timeoutSeconds: number(request.timeoutSeconds),
    ...(auth
      ? { authType: (text(auth.type) ?? 'bearer') as HttpToolConfig['authType'], authVariable: text(auth.variable) ?? '', authHeader: text(auth.header) }
      : {}),
    ...(job
      ? {
          longRunning: true,
          statusUrl: text(job.statusUrl),
          intervalSeconds: number(job.intervalSeconds),
          jobTimeoutSeconds: number(job.timeoutSeconds),
          doneWhen: text(job.doneWhen),
          failedWhen: text(job.failedWhen),
          result: text(job.result),
        }
      : {}),
  }
}
