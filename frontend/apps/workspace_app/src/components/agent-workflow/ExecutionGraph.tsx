import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bot, Coins, Cpu, Flag, Layers, Play, Timer, Wrench, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { resolveFlowDirection, type Diagram, type DiagramNode } from '@/components/designer/diagram-types'
import { AGENT_NODE_HEIGHT, AGENT_NODE_WIDTH } from '@/components/agent-workflow/agent-workflow-defaults'
import { isFlowBoundaryNode, isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import {
  ATTR,
  agentName,
  formatDuration,
  formatTokens,
  modelCallState,
  modelCallsOf,
  numberAttr,
  percent,
  useHoverTip,
  type AgentInsight,
  type RunTelemetry,
} from '@/components/agent-workflow/execution-telemetry'
import { Legend, ModelCalledBadge, SectionTitle } from '@/components/agent-workflow/ExecutionUi'

type HeatMetric = 'time' | 'tokens' | 'errors'

const HEAT_METRICS: Array<{ id: HeatMetric; label: string }> = [
  { id: 'time', label: 'Time' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'errors', label: 'Errors' },
]

/** Same hues as the waterfall and timeline. */
const MODEL = 'bg-[#0284c7]'
const TOOL = 'bg-[#db2777] dark:bg-[#ec4899]'
const OTHER = 'bg-foreground/25'
const TOKEN_IN = 'bg-sky-300 dark:bg-sky-700'
const TOKEN_OUT = 'bg-sky-600 dark:bg-sky-400'

/** Card size on the graph, in diagram units: the canvas card plus a metrics strip and bars. */
const CARD_WIDTH = AGENT_NODE_WIDTH + 24
const CARD_HEIGHT = 132
const BOUNDARY_SIZE = 56
const PADDING = 56

interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  boundary: 'start' | 'end' | null
  agent?: AgentInsight
  tools: Array<{ name: string; failed: boolean }>
}

interface GraphEdge {
  id: string
  from: string
  to: string
}

/** When an agent first started and last finished, from its spans. */
type Timing = { start: number; end: number }

function matches(agent: AgentInsight, node: DiagramNode): boolean {
  return agent.nodeId === node.id || agent.name === node.label || agent.name === node.id
}

function toolsOf(agent: AgentInsight | undefined, configured: string[]): Array<{ name: string; failed: boolean }> {
  const names = [...configured, ...(agent?.toolCalls.map((call) => call.name) ?? [])].filter((name, index, all) => all.indexOf(name) === index)
  return names.map((name) => ({ name, failed: Boolean(agent?.toolCalls.some((call) => call.name === name && call.failed)) }))
}

/** The run's graph: the workflow's own layout when it is loaded, else its agents in run order. */
function buildGraph(diagram: Diagram | undefined, agents: AgentInsight[]): { nodes: GraphNode[]; edges: GraphEdge[]; vertical: boolean } {
  if (diagram && diagram.nodes.some((node) => !isFlowBoundaryNode(node))) {
    const vertical = resolveFlowDirection(diagram.direction) === 'vertical'
    const steps = diagram.nodes.filter((node) => !node.mappedAgentId)
    // The graph cards are bigger than the canvas cards: spread the layout so they do not touch.
    const spreadX = vertical ? 1.15 : 1.35
    const spreadY = vertical ? 1.6 : 1.3
    const nodes = steps.map<GraphNode>((node) => {
      const boundary = isFlowBoundaryNode(node) ? (isStartFlowNode(node) ? 'start' : 'end') : null
      const width = boundary ? BOUNDARY_SIZE : CARD_WIDTH
      const height = boundary ? BOUNDARY_SIZE : CARD_HEIGHT
      const centreX = (node.x + (node.width ?? AGENT_NODE_WIDTH) / 2) * spreadX
      const centreY = (node.y + (node.height ?? AGENT_NODE_HEIGHT) / 2) * spreadY
      const agent = boundary ? undefined : agents.find((item) => matches(item, node))
      return {
        id: node.id,
        label: node.label?.trim() || (boundary === 'start' ? 'Start' : boundary === 'end' ? 'End' : 'Agent'),
        x: centreX - width / 2,
        y: centreY - height / 2,
        width,
        height,
        boundary,
        agent,
        tools: boundary
          ? []
          : toolsOf(agent, diagram.nodes.filter((child) => child.mappedAgentId === node.id).map((child) => child.label?.trim() || 'Tool')),
      }
    })
    const ids = new Set(nodes.map((node) => node.id))
    const edges = diagram.edges
      .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
      .map((edge) => ({ id: edge.id, from: edge.from, to: edge.to }))
    return { nodes, edges, vertical }
  }

  // No diagram: the agents in the order they ran, start to end.
  const gap = 96
  const nodes: GraphNode[] = [
    { id: '__start', label: 'Start', x: 0, y: (CARD_HEIGHT - BOUNDARY_SIZE) / 2, width: BOUNDARY_SIZE, height: BOUNDARY_SIZE, boundary: 'start', tools: [] },
    ...agents.map<GraphNode>((agent, index) => ({
      id: `agent-${index}`,
      label: agent.name,
      x: BOUNDARY_SIZE + gap + index * (CARD_WIDTH + gap),
      y: 0,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      boundary: null,
      agent,
      tools: toolsOf(agent, []),
    })),
  ]
  nodes.push({
    id: '__end',
    label: 'End',
    x: BOUNDARY_SIZE + gap + agents.length * (CARD_WIDTH + gap),
    y: (CARD_HEIGHT - BOUNDARY_SIZE) / 2,
    width: BOUNDARY_SIZE,
    height: BOUNDARY_SIZE,
    boundary: 'end',
    tools: [],
  })
  const edges = nodes.slice(1).map((node, index) => ({ id: `e${index}`, from: nodes[index].id, to: node.id }))
  return { nodes, edges, vertical: false }
}

function edgeGeometry(from: GraphNode, to: GraphNode, vertical: boolean) {
  if (vertical) {
    const a = { x: from.x + from.width / 2, y: from.y + from.height + (from.tools.length ? 30 : 0) }
    const b = { x: to.x + to.width / 2, y: to.y }
    const mid = (a.y + b.y) / 2
    return { d: `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`, label: { x: (a.x + b.x) / 2, y: mid } }
  }
  const a = { x: from.x + from.width, y: from.y + from.height / 2 }
  const b = { x: to.x, y: to.y + to.height / 2 }
  const mid = (a.x + b.x) / 2
  return { d: `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`, label: { x: mid, y: (a.y + b.y) / 2 } }
}

function heatValue(agent: AgentInsight, metric: HeatMetric): number {
  if (metric === 'time') return agent.durationMs
  if (metric === 'tokens') return agent.inputTokens + agent.outputTokens
  return agent.errors.length + agent.toolCalls.filter((call) => call.failed).length
}

/** Each agent's first start and last end, from its `invoke_agent` spans. */
function agentTimings(telemetry: RunTelemetry): Map<string, Timing> {
  const timings = new Map<string, Timing>()
  for (const span of telemetry.trace?.spans ?? []) {
    if (span.operation !== 'invoke_agent') continue
    const name = agentName(span)
    const start = Date.parse(span.start_time)
    const end = start + span.duration_ms
    const known = timings.get(name)
    timings.set(name, known ? { start: Math.min(known.start, start), end: Math.max(known.end, end) } : { start, end })
  }
  return timings
}

/** The workflow drawn with each agent's numbers on its card; pick an agent to focus on its telemetry. */
export function ExecutionGraph({ telemetry, diagram }: { telemetry: RunTelemetry; diagram?: Diagram }) {
  const { agents, tracked } = telemetry
  const [metric, setMetric] = useState<HeatMetric>('time')
  const graph = useMemo(() => buildGraph(diagram, agents), [diagram, agents])
  const timings = useMemo(() => agentTimings(telemetry), [telemetry])
  const [focus, setFocus] = useState<string | null>(null)
  const focused = agents.find((agent) => agent.name === focus)
  const { bind, node: tip } = useHoverTip()

  // Fit the whole graph to the frame's width.
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)
  useLayoutEffect(() => {
    const element = frameRef.current
    if (!element) return
    const update = () => setFrameWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const minX = Math.min(...graph.nodes.map((node) => node.x)) - PADDING
  const minY = Math.min(...graph.nodes.map((node) => node.y)) - PADDING
  const maxX = Math.max(...graph.nodes.map((node) => node.x + node.width)) + PADDING
  const maxY = Math.max(...graph.nodes.map((node) => node.y + node.height + (node.tools.length ? 30 : 0))) + PADDING
  const worldWidth = maxX - minX
  const worldHeight = maxY - minY
  const scale = frameWidth > 0 ? Math.min(1, frameWidth / worldWidth) : 1
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const ran = (node: GraphNode | undefined) => Boolean(node && (node.boundary || node.agent))
  const heatMax = Math.max(1, ...agents.map((agent) => heatValue(agent, metric)))
  const heatTotal = agents.reduce((sum, agent) => sum + heatValue(agent, metric), 0)
  const heatDisabled = metric === 'tokens' && !tracked
  const timeTotal = agents.reduce((sum, agent) => sum + agent.durationMs, 0)
  const tokenMax = Math.max(1, ...agents.map((agent) => agent.inputTokens + agent.outputTokens))
  const focusedNodeId = graph.nodes.find((node) => node.agent && node.agent.name === focus)?.id
  const order = (agent: AgentInsight) => agents.indexOf(agent) + 1

  return (
    <div className="space-y-3">
      {/* Whose telemetry: the whole run, or one agent */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Telemetry for" className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-[3px] border border-border bg-card p-0.5 [scrollbar-width:thin]">
          <button
            type="button"
            role="radio"
            aria-checked={focus === null}
            onClick={() => setFocus(null)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-[2px] px-2.5 py-1 text-[11.5px] font-medium transition-colors',
              focus === null ? 'bg-foreground/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Whole run
          </button>
          {agents.map((agent) => {
            const failed = agent.errors.length > 0
            return (
              <button
                key={agent.name}
                type="button"
                role="radio"
                aria-checked={focus === agent.name}
                onClick={() => setFocus(agent.name)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-[2px] px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                  focus === agent.name ? 'bg-foreground/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', failed ? 'bg-red-500' : 'bg-emerald-500')} aria-hidden />
                <span className="max-w-[10rem] truncate">{agent.name}</span>
              </button>
            )
          })}
        </div>
        <span className="flex-1" />
        <div role="radiogroup" aria-label="Colour cards by" className="inline-flex rounded-[3px] border border-border bg-card p-0.5">
          {HEAT_METRICS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={metric === item.id}
              onClick={() => setMetric(item.id)}
              className={cn(
                'rounded-[2px] px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                metric === item.id ? 'bg-foreground/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-2">
          <div
            ref={frameRef}
            className="relative overflow-hidden rounded-[3px] border border-border bg-[hsl(var(--canvas))] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            style={{
              height: Math.max(260, worldHeight * scale),
              backgroundImage: 'radial-gradient(circle, hsl(var(--canvas-grid)) 1px, transparent 1.1px)',
              backgroundSize: '20px 20px',
            }}
            onClick={() => setFocus(null)}
          >
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: worldWidth, height: worldHeight, transform: `scale(${scale})` }}>
              <svg className="absolute inset-0 overflow-visible" width={worldWidth} height={worldHeight} aria-hidden>
                <defs>
                  <marker id="exec-graph-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 8 4 L 0 8 z" className="fill-foreground/45" />
                  </marker>
                </defs>
                {graph.edges.map((edge) => {
                  const from = byId.get(edge.from)
                  const to = byId.get(edge.to)
                  if (!from || !to) return null
                  const shifted = (node: GraphNode) => ({ ...node, x: node.x - minX, y: node.y - minY })
                  const taken = ran(from) && ran(to)
                  const touches = focusedNodeId !== undefined && (edge.from === focusedNodeId || edge.to === focusedNodeId)
                  const dimmed = focusedNodeId !== undefined && !touches
                  return (
                    <path
                      key={edge.id}
                      d={edgeGeometry(shifted(from), shifted(to), graph.vertical).d}
                      fill="none"
                      className={cn(
                        'transition-opacity',
                        touches ? 'stroke-primary' : taken ? 'stroke-foreground/40' : 'stroke-foreground/15',
                        dimmed && 'opacity-25',
                      )}
                      strokeWidth={touches ? 2.25 : 1.75}
                      strokeDasharray={taken ? undefined : '5 5'}
                      markerEnd="url(#exec-graph-arrow)"
                    />
                  )
                })}
              </svg>

              {/* Hand-off time on each connection between two agents that ran */}
              {graph.edges.map((edge) => {
                const from = byId.get(edge.from)
                const to = byId.get(edge.to)
                const a = from?.agent ? timings.get(from.agent.name) : undefined
                const b = to?.agent ? timings.get(to.agent.name) : undefined
                if (!from || !to || !a || !b) return null
                const gap = b.start - a.end
                const { label } = edgeGeometry({ ...from, x: from.x - minX, y: from.y - minY }, { ...to, x: to.x - minX, y: to.y - minY }, graph.vertical)
                const dimmed = focusedNodeId !== undefined && edge.from !== focusedNodeId && edge.to !== focusedNodeId
                return (
                  <span
                    key={`gap-${edge.id}`}
                    className={cn(
                      'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground shadow-sm transition-opacity',
                      dimmed && 'opacity-30',
                    )}
                    style={{ left: label.x, top: label.y }}
                    {...bind([`${from.label} → ${to.label}`, gap >= 0 ? `Hand-off took ${formatDuration(gap)}` : `Overlapped by ${formatDuration(-gap)} (ran in parallel)`])}
                  >
                    {gap >= 0 ? `+${formatDuration(gap)}` : '∥ parallel'}
                  </span>
                )
              })}

              {graph.nodes.map((node) => {
                const left = node.x - minX
                const top = node.y - minY
                const dimmed = focusedNodeId !== undefined && node.id !== focusedNodeId
                if (node.boundary) {
                  const Icon = node.boundary === 'start' ? Play : Flag
                  return (
                    <div key={node.id} className={cn('absolute flex flex-col items-center transition-opacity', dimmed && 'opacity-40')} style={{ left, top, width: node.width }}>
                      <span
                        className="flex items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                        style={{ width: node.width, height: node.height }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="mt-1 text-[11px] font-medium text-muted-foreground">{node.label}</span>
                    </div>
                  )
                }
                const agent = node.agent
                const value = agent ? heatValue(agent, metric) : 0
                const heat = agent && !heatDisabled ? value / heatMax : 0
                const failed = Boolean(agent && agent.errors.length > 0)
                const isFocused = node.id === focusedNodeId
                const tokens = agent ? agent.inputTokens + agent.outputTokens : 0
                return (
                  <div key={node.id} className={cn('absolute transition-opacity', dimmed && 'opacity-40')} style={{ left, top, width: node.width }}>
                    <button
                      type="button"
                      disabled={!agent}
                      onClick={(event) => {
                        event.stopPropagation()
                        setFocus(isFocused ? null : agent!.name)
                      }}
                      className={cn(
                        'relative flex w-full flex-col overflow-hidden rounded-[3px] border bg-[hsl(var(--node))] text-left transition-[border-color,box-shadow]',
                        isFocused
                          ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15),0_8px_24px_-8px_rgba(16,24,40,0.25)]'
                          : failed
                            ? 'border-red-500/60'
                            : 'border-border shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-foreground/30',
                        !agent && 'opacity-55',
                      )}
                      style={{ height: node.height }}
                    >
                      {/* Heat tint for the chosen metric */}
                      <span
                        aria-hidden
                        className={cn('pointer-events-none absolute inset-0', metric === 'errors' ? 'bg-red-500' : 'bg-sky-500')}
                        style={{ opacity: heat * 0.16 }}
                      />
                      <span className="relative flex min-w-0 items-center gap-2 px-3 pt-2.5">
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px]',
                            failed ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-foreground/[0.06] text-foreground/70',
                          )}
                        >
                          {failed ? <XCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            {agent ? <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">#{order(agent)}</span> : null}
                            <span className="truncate text-[13px] font-semibold text-foreground">{node.label}</span>
                          </span>
                          <span className="block truncate text-[10.5px] text-muted-foreground">
                            {agent ? `${agent.model || (agent.kind === 'executor' ? 'Executor · no model' : 'Ran')}${agent.invocations > 1 ? ` · ${agent.invocations}×` : ''}` : 'Did not run'}
                          </span>
                        </span>
                        {agent && heatTotal > 0 && !heatDisabled ? (
                          <span className="shrink-0 rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
                            {metric === 'errors' ? value : `${percent(value, heatTotal)}%`}
                          </span>
                        ) : null}
                      </span>

                      {/* Share of time and token split */}
                      <span className="relative mt-2 grid gap-1 px-3">
                        <span className="flex items-center gap-2" {...(agent ? bind([node.label, `${formatDuration(agent.durationMs)} · ${percent(agent.durationMs, timeTotal)}% of agent time`]) : {})}>
                          <span className="w-9 shrink-0 text-[9.5px] text-muted-foreground">Time</span>
                          <span className="h-1.5 flex-1 rounded-full bg-foreground/[0.07]">
                            <span className="block h-full rounded-full bg-foreground/50" style={{ width: `${agent ? Math.max(2, percent(agent.durationMs, timeTotal)) : 0}%` }} />
                          </span>
                        </span>
                        <span
                          className="flex items-center gap-2"
                          {...(agent && tracked ? bind([node.label, `${agent.inputTokens.toLocaleString()} input`, `${agent.outputTokens.toLocaleString()} output`]) : {})}
                        >
                          <span className="w-9 shrink-0 text-[9.5px] text-muted-foreground">Tokens</span>
                          <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                            {agent && tracked && tokens > 0 ? (
                              <span className="flex h-full gap-[1px]" style={{ width: `${(tokens / tokenMax) * 100}%` }}>
                                <span className={TOKEN_IN} style={{ flexGrow: agent.inputTokens, flexBasis: 0 }} />
                                <span className={TOKEN_OUT} style={{ flexGrow: agent.outputTokens, flexBasis: 0 }} />
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </span>

                      <span className="relative mt-auto grid grid-cols-3 border-t border-border/60 text-[10.5px] tabular-nums">
                        <span className="flex items-center gap-1 px-2 py-1.5 text-foreground">
                          <Timer className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {agent ? formatDuration(agent.durationMs) : '—'}
                        </span>
                        <span className="flex items-center gap-1 border-l border-border/60 px-2 py-1.5 text-foreground">
                          <Coins className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {agent && tracked ? formatTokens(tokens) : '—'}
                        </span>
                        <span className="flex items-center gap-1 border-l border-border/60 px-2 py-1.5 text-foreground">
                          <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {agent && tracked ? agent.modelCalls : '—'}
                          {agent && agent.toolCalls.length ? (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground">
                              <Wrench className="h-3 w-3" />
                              {agent.toolCalls.length}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                    {node.tools.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                        {node.tools.slice(0, 4).map((tool) => (
                          <span
                            key={tool.name}
                            className={cn(
                              'inline-flex max-w-[7.5rem] items-center gap-1 truncate rounded-full border bg-card px-1.5 py-0.5 text-[9.5px]',
                              tool.failed ? 'border-red-500/50 text-red-700 dark:text-red-300' : 'border-border text-muted-foreground',
                            )}
                          >
                            {tool.failed ? <XCircle className="h-2.5 w-2.5 shrink-0" /> : <Wrench className="h-2.5 w-2.5 shrink-0" />}
                            <span className="truncate">{tool.name}</span>
                          </span>
                        ))}
                        {node.tools.length > 4 ? (
                          <span className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[9.5px] text-muted-foreground">+{node.tools.length - 4}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              {metric === 'errors' ? 'No errors' : 'Less'}
              <span
                className={cn('h-2 w-20 rounded-full', metric === 'errors' ? 'bg-gradient-to-r from-red-500/0 to-red-500/70' : 'bg-gradient-to-r from-sky-500/0 to-sky-500/70')}
                aria-hidden
              />
              {metric === 'errors' ? 'Most errors' : 'More'}
            </span>
            <span>Labels on connections: hand-off time between agents</span>
            <span>Dashed: not taken in this run</span>
            {!diagram ? <span>Workflow not open: agents shown in run order</span> : null}
          </div>
        </div>

        {focused ? (
          <AgentTelemetry agent={focused} telemetry={telemetry} timing={timings.get(focused.name)} order={order(focused)} />
        ) : (
          <RunTelemetryPanel telemetry={telemetry} onPick={setFocus} />
        )}
      </div>
      {tip}
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-[3px] border border-border/70 bg-background px-2.5 py-1.5">
      <div className="truncate text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={cn('truncate text-[14px] font-semibold tabular-nums text-foreground', tone)}>{value}</div>
    </div>
  )
}

/** One agent in depth: its numbers, where its time went, each model call, its tools, input and output. */
function AgentTelemetry({ agent, telemetry, timing, order }: { agent: AgentInsight; telemetry: RunTelemetry; timing?: Timing; order: number }) {
  const { tracked, agents } = telemetry
  const { bind, node: tip } = useHoverTip()
  const calls = useMemo(() => modelCallsOf(telemetry, agent), [telemetry, agent])
  const modelTime = Math.min(agent.durationMs, calls.reduce((sum, span) => sum + span.duration_ms, 0))
  const toolTime = Math.min(Math.max(0, agent.durationMs - modelTime), agent.toolCalls.reduce((sum, call) => sum + call.durationMs, 0))
  const otherTime = Math.max(0, agent.durationMs - modelTime - toolTime)
  const timeTotal = agents.reduce((sum, item) => sum + item.durationMs, 0)
  const callMax = Math.max(1, ...calls.map((span) => span.duration_ms))
  const failedTools = agent.toolCalls.filter((call) => call.failed).length
  const outputRate = modelTime > 0 ? Math.round((agent.outputTokens / modelTime) * 1000) : 0

  return (
    <aside className="min-w-0 space-y-4 rounded-[3px] border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex min-w-0 items-start gap-2">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px]',
            agent.errors.length ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-foreground/[0.06] text-foreground/70',
          )}
        >
          {agent.errors.length ? <XCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Agent #{order} telemetry</span>
            <ModelCalledBadge state={modelCallState(agent, tracked)} calls={agent.modelCalls} />
          </div>
          <div className="truncate text-[14px] font-semibold text-foreground">{agent.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {agent.model || 'Model not recorded'}
            {timing ? ` · ${new Date(timing.start).toLocaleTimeString()} → ${new Date(timing.end).toLocaleTimeString()}` : ''}
          </div>
        </div>
      </div>

      {agent.errors.length ? (
        <p className="rounded-[3px] border border-red-500/25 bg-red-500/[0.05] px-2.5 py-1.5 text-[11.5px] text-red-700 dark:text-red-300">{agent.errors[0]}</p>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5">
        <Kpi label="Time" value={formatDuration(agent.durationMs)} />
        <Kpi label="Share" value={`${percent(agent.durationMs, timeTotal)}%`} />
        <Kpi label="Runs" value={String(agent.invocations)} />
        <Kpi
          label="Model called"
          value={tracked ? (agent.modelCalls > 0 ? 'Yes' : 'No') : '—'}
          tone={tracked && agent.modelCalls > 0 ? 'text-sky-700 dark:text-sky-300' : undefined}
        />
        <Kpi label="Input tok." value={tracked ? formatTokens(agent.inputTokens) : '—'} />
        <Kpi label="Output tok." value={tracked ? formatTokens(agent.outputTokens) : '—'} />
        <Kpi label="Tok./s" value={tracked && outputRate ? String(outputRate) : '—'} />
        <Kpi label="Model calls" value={tracked ? String(agent.modelCalls) : '—'} />
        <Kpi label="Slowest" value={tracked && agent.slowestCallMs ? formatDuration(agent.slowestCallMs) : '—'} />
        <Kpi label="Tool calls" value={tracked ? String(agent.toolCalls.length) : '—'} tone={failedTools ? 'text-red-600 dark:text-red-400' : undefined} />
      </div>

      {tracked ? (
        <div className="space-y-1.5">
          <SectionTitle aside={<Legend items={[{ label: 'Model', swatch: MODEL }, { label: 'Tools', swatch: TOOL }, { label: 'Other', swatch: OTHER }]} />}>
            Where its time went
          </SectionTitle>
          <div
            className="flex h-3 gap-[2px]"
            {...bind([
              agent.name,
              `Model ${formatDuration(modelTime)} (${percent(modelTime, agent.durationMs)}%)`,
              `Tools ${formatDuration(toolTime)} (${percent(toolTime, agent.durationMs)}%)`,
              `Other ${formatDuration(otherTime)} (${percent(otherTime, agent.durationMs)}%)`,
            ])}
          >
            {modelTime > 0 ? <span className={cn('h-full first:rounded-l-[3px] last:rounded-r-[3px]', MODEL)} style={{ flexGrow: modelTime, flexBasis: 0 }} /> : null}
            {toolTime > 0 ? <span className={cn('h-full first:rounded-l-[3px] last:rounded-r-[3px]', TOOL)} style={{ flexGrow: toolTime, flexBasis: 0 }} /> : null}
            {otherTime > 0 ? <span className={cn('h-full first:rounded-l-[3px] last:rounded-r-[3px]', OTHER)} style={{ flexGrow: otherTime, flexBasis: 0 }} /> : null}
          </div>
        </div>
      ) : null}

      {calls.length > 0 ? (
        <div className="space-y-1.5">
          <SectionTitle aside={<Legend items={[{ label: 'Input', swatch: TOKEN_IN }, { label: 'Output', swatch: TOKEN_OUT }]} />}>Model calls</SectionTitle>
          <ul className="space-y-1">
            {calls.map((span, index) => {
              const input = numberAttr(span, ATTR.inputTokens)
              const output = numberAttr(span, ATTR.outputTokens)
              const failed = span.status === 'ERROR'
              return (
                <li
                  key={span.span_id}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[10.5px]"
                  {...bind([`Call #${index + 1}`, formatDuration(span.duration_ms), `${input.toLocaleString()} in · ${output.toLocaleString()} out`, failed ? `Error: ${span.status_message}` : ''].filter(Boolean))}
                >
                  <span className={cn('tabular-nums', failed ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>#{index + 1}</span>
                  <span className="grid gap-[3px]">
                    <span className="h-1.5 rounded-full bg-foreground/[0.07]">
                      <span className={cn('block h-full rounded-full', failed ? 'bg-red-500' : 'bg-foreground/50')} style={{ width: `${(span.duration_ms / callMax) * 100}%` }} />
                    </span>
                    <span className="flex h-1 gap-[1px] overflow-hidden rounded-full">
                      <span className={TOKEN_IN} style={{ flexGrow: input, flexBasis: 0 }} />
                      <span className={TOKEN_OUT} style={{ flexGrow: output, flexBasis: 0 }} />
                    </span>
                  </span>
                  <span className="text-right tabular-nums text-foreground">{formatDuration(span.duration_ms)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {agent.toolCalls.length > 0 ? (
        <div className="space-y-1.5">
          <SectionTitle>Tool calls</SectionTitle>
          <ul className="space-y-1">
            {agent.toolCalls.map((call) => (
              <li key={call.id} className="flex items-center gap-2 rounded-[3px] border border-border/70 px-2 py-1 text-[11px]">
                {call.failed ? <XCircle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" /> : <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />}
                <span className="truncate font-medium text-foreground">{call.name}</span>
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{formatDuration(call.durationMs)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {[
        ['Input', agent.input],
        ['Output', agent.output],
      ].map(([label, text]) =>
        text.trim() ? (
          <div key={label}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
            <p className="line-clamp-5 rounded-[3px] border border-border/70 bg-background px-2.5 py-1.5 text-[11.5px] leading-snug text-muted-foreground">
              {text.replace(/\*\*\w+\*\*\s*/g, '').replace(/\s+/g, ' ')}
            </p>
          </div>
        ) : null,
      )}
      {tip}
    </aside>
  )
}

/** The whole run beside the graph, with every agent ranked by time so one can be picked. */
function RunTelemetryPanel({ telemetry, onPick }: { telemetry: RunTelemetry; onPick: (name: string) => void }) {
  const { agents, tracked, totalMs, trace } = telemetry
  const timeTotal = agents.reduce((sum, agent) => sum + agent.durationMs, 0)
  const errors = agents.reduce((sum, agent) => sum + agent.errors.length, 0)
  const ranked = [...agents].sort((a, b) => b.durationMs - a.durationMs)
  return (
    <aside className="min-w-0 space-y-4 rounded-[3px] border border-border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Run telemetry</div>
        <div className="text-[14px] font-semibold text-foreground">Whole run</div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Kpi label="Total time" value={formatDuration(totalMs)} />
        <Kpi label="Agents" value={String(agents.length)} />
        <Kpi label="Errors" value={String(errors)} tone={errors ? 'text-red-600 dark:text-red-400' : undefined} />
        <Kpi label="Input tok." value={tracked && trace ? formatTokens(trace.input_tokens) : '—'} />
        <Kpi label="Output tok." value={tracked && trace ? formatTokens(trace.output_tokens) : '—'} />
        <Kpi label="Spans" value={trace ? String(trace.spans.length) : '—'} />
      </div>
      <div className="space-y-1.5">
        <SectionTitle>Agents by time</SectionTitle>
        <ul className="space-y-0.5">
          {ranked.map((agent) => (
            <li key={agent.name}>
              <button
                type="button"
                onClick={() => onPick(agent.name)}
                className="grid w-full grid-cols-[minmax(0,1fr)_5rem_3.25rem] items-center gap-2 rounded-[2px] px-1.5 py-1 text-left text-[11.5px] hover:bg-foreground/[0.04]"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {agent.errors.length ? (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
                  ) : (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  )}
                  <span className="truncate font-medium text-foreground">{agent.name}</span>
                </span>
                <span className="h-1.5 rounded-full bg-foreground/[0.07]">
                  <span className="block h-full rounded-full bg-foreground/50" style={{ width: `${Math.max(2, percent(agent.durationMs, timeTotal))}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{formatDuration(agent.durationMs)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[11px] text-muted-foreground">Pick an agent above, on the graph, or in this list to see its own telemetry.</p>
    </aside>
  )
}
