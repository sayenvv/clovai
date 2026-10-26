import { memo, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import { findOrchestration, PATTERN_META } from '@/components/agent-workflow/orchestration-patterns'
import { listAgentNodes, orderedToolsForAgent } from '@/components/agent-workflow/tool-agent-mapping'
import type { MonitoredWorkflow } from '@/services/activity-api'
import { DEFAULT_MAP_FILTERS, type MapFilters } from '@/components/agent-workflow/WorkflowOutlinePanel'

type Health = 'ok' | 'warning' | 'error'

const RING: Record<Health, string> = {
  ok: 'hsl(142 45% 62%)',
  warning: 'hsl(33 95% 52%)',
  error: 'hsl(0 72% 42%)',
}

const AGENT_R = 30
const TOOL_R = 22
const CENTER_R = 42
/** A canvas-coloured outline behind labels, so lines passing under them don't cut through. */
const HALO = { stroke: 'hsl(var(--canvas))', strokeWidth: 3, paintOrder: 'stroke' } as const

interface MapAgent {
  node: DiagramNode
  tools: DiagramNode[]
  health: Health
  calls: number | null
  problem?: string
}

function agentHealth(node: DiagramNode, calls: number | null, hasRuns: boolean): { health: Health; problem?: string } {
  const agent = node.agent
  if (!agent?.modelConnectionId && !agent?.model) return { health: 'error', problem: 'No model' }
  if (!agent?.instructions?.trim()) return { health: 'warning', problem: 'No instructions' }
  if (hasRuns && calls === 0) return { health: 'warning', problem: 'Never called' }
  return { health: 'ok' }
}

function shorten(text: string, max = 18): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

interface WorkflowMapViewProps {
  diagram: Diagram
  workflowName: string
  activity?: MonitoredWorkflow
  filters?: MapFilters
  zoom: number
  onZoomChange: (zoom: number) => void
  /** An agent or tool on the map was clicked. */
  onOpenNode: (nodeId: string) => void
  onOpenCanvas: () => void
}

/**
 * The workflow as a radial map: the orchestrator (or the workflow) in the centre, its agents on a
 * ring around it and each agent's tools further out. Rings are coloured by health, problems drawn
 * strongly and healthy nodes faded, as on a service map.
 */
export const WorkflowMapView = memo(function WorkflowMapView({
  diagram,
  workflowName,
  activity,
  filters = DEFAULT_MAP_FILTERS,
  zoom,
  onZoomChange,
  onOpenNode,
  onOpenCanvas,
}: WorkflowMapViewProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const { center, agents } = useMemo(() => {
    const orchestration = findOrchestration(diagram)
    const orchestrator = orchestration
      ? diagram.nodes.find((node) => node.id === orchestration.orchestratorId)
      : undefined
    const team = orchestration
      ? orchestration.participantIds
          .map((id) => diagram.nodes.find((node) => node.id === id))
          .filter((node): node is DiagramNode => Boolean(node))
      : listAgentNodes(diagram)
    const hasRuns = (activity?.runs.total ?? 0) > 0
    const callsByName = new Map((activity?.agents ?? []).map((agent) => [agent.name.toLowerCase(), agent.calls]))
    const mapped: MapAgent[] = team
      .map((node) => {
        const calls = activity ? (callsByName.get(node.label.toLowerCase()) ?? 0) : null
        const tools = filters.showTools ? orderedToolsForAgent(diagram, node.id) : []
        return { node, tools, calls, ...agentHealth(node, calls, hasRuns) }
      })
      .filter((agent) => filters.status === 'all' || agent.health !== 'ok')
    return {
      center: {
        label: orchestrator?.label ?? workflowName,
        caption: orchestration ? `${PATTERN_META[orchestration.pattern].label} workflow` : 'Workflow',
        node: orchestrator,
      },
      agents: mapped,
    }
  }, [diagram, activity, workflowName, filters.showTools, filters.status])

  if (agents.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[hsl(var(--canvas))] text-center">
        <Network className="h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {filters.status === 'problems' ? 'No agents with problems' : 'No agents on the map yet'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filters.status === 'problems'
              ? 'Every agent has a model and instructions. Set Status to All to see them.'
              : 'Add agents on the canvas and they appear here around the workflow.'}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpenCanvas}>
          Open canvas
        </Button>
      </div>
    )
  }

  // Agents on the inner ring; their tools spread around each agent's angle further out.
  const count = agents.length
  const innerR = Math.max(170, count * 34)
  const outerR = innerR + 130
  const step = (Math.PI * 2) / count
  const totalTools = agents.reduce((sum, agent) => sum + agent.tools.length, 0)
  const extent = (totalTools > 0 ? outerR + TOOL_R : innerR + AGENT_R) + 60
  const healthCounts = agents.reduce(
    (counts, agent) => ({ ...counts, [agent.health]: counts[agent.health] + 1 }),
    { ok: 0, warning: 0, error: 0 } as Record<Health, number>,
  )

  const startDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('[data-map-node]')) return
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const svg = event.currentTarget
    const scale = (extent * 2) / Math.min(svg.clientWidth, svg.clientHeight) / zoom
    setPan({
      x: drag.current.panX + (event.clientX - drag.current.x) * scale,
      y: drag.current.panY + (event.clientY - drag.current.y) * scale,
    })
  }

  return (
    <div className="relative flex min-h-0 flex-1 bg-[hsl(var(--canvas))]">
      <svg
        className="h-full w-full cursor-grab select-none active:cursor-grabbing"
        viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={() => (drag.current = null)}
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) return
          onZoomChange(Math.min(3, Math.max(0.4, zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1))))
        }}
        role="img"
        aria-label={`${center.label} map with ${count} agents`}
      >
        <defs>
          <marker id="map-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="hsl(var(--muted-foreground) / 0.55)" />
          </marker>
          <marker id="map-arrow-error" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill={RING.error} />
          </marker>
        </defs>

        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {/* Agent → tool links, under everything */}
          {agents.map((agent, index) => {
            const angle = index * step - Math.PI / 2
            const ax = Math.cos(angle) * innerR
            const ay = Math.sin(angle) * innerR
            const spread = Math.min(step * 0.8, 0.22 * agent.tools.length)
            return agent.tools.map((tool, toolIndex) => {
              const offset = agent.tools.length === 1 ? 0 : (toolIndex / (agent.tools.length - 1) - 0.5) * spread
              const tx = Math.cos(angle + offset) * outerR
              const ty = Math.sin(angle + offset) * outerR
              return (
                <line
                  key={`link-${tool.id}`}
                  x1={ax}
                  y1={ay}
                  x2={tx}
                  y2={ty}
                  stroke="hsl(var(--muted-foreground) / 0.25)"
                  strokeWidth={1}
                />
              )
            })
          })}

          {/* Spokes from the centre with their call-count pills */}
          {agents.map((agent, index) => {
            const angle = index * step - Math.PI / 2
            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            const from = CENTER_R + 8
            // Agents above the centre have their name between them and the centre: stop short of it
            const to = innerR - AGENT_R - (sin < -0.3 ? 46 : 10)
            const strong = agent.health === 'error'
            // Below the centre, past its caption
            const mid = from + (to - from) * (sin > 0.3 ? 0.8 : 0.6)
            const label = agent.calls === null ? 'no runs' : `${agent.calls} call${agent.calls === 1 ? '' : 's'}`
            const faded = filters.fadeHealthy && agent.health === 'ok' && hovered !== agent.node.id
            return (
              <g key={`spoke-${agent.node.id}`} opacity={faded ? 0.7 : 1}>
                <line
                  x1={cos * from}
                  y1={sin * from}
                  x2={cos * to}
                  y2={sin * to}
                  stroke={strong ? RING.error : 'hsl(var(--muted-foreground) / 0.4)'}
                  strokeWidth={strong ? 1.25 : 1}
                  strokeDasharray={strong ? '4 3' : undefined}
                  markerEnd={strong ? 'url(#map-arrow-error)' : 'url(#map-arrow)'}
                />
                <g transform={`translate(${cos * mid} ${sin * mid})`}>
                  <rect
                    x={-label.length * 2.9 - 7}
                    y={-7.5}
                    width={label.length * 5.8 + 14}
                    height={15}
                    rx={7.5}
                    fill="hsl(var(--card))"
                    stroke={strong ? RING.error : 'hsl(var(--foreground) / 0.55)'}
                    strokeWidth={0.9}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={9}
                    fontWeight={600}
                    fill={strong ? RING.error : 'hsl(var(--foreground) / 0.8)'}
                  >
                    {label}
                  </text>
                </g>
              </g>
            )
          })}

          {/* Tools on the outer ring */}
          {agents.map((agent, index) => {
            const angle = index * step - Math.PI / 2
            const spread = Math.min(step * 0.8, 0.22 * agent.tools.length)
            return agent.tools.map((tool, toolIndex) => {
              const offset = agent.tools.length === 1 ? 0 : (toolIndex / (agent.tools.length - 1) - 0.5) * spread
              const x = Math.cos(angle + offset) * outerR
              const y = Math.sin(angle + offset) * outerR
              const active = hovered === tool.id
              return (
                <g
                  key={tool.id}
                  data-map-node
                  transform={`translate(${x} ${y})`}
                  className="cursor-pointer"
                  opacity={active || !filters.fadeHealthy ? 1 : 0.62}
                  onPointerEnter={() => setHovered(tool.id)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => onOpenNode(tool.id)}
                >
                  <title>{`${tool.label} · tool of ${agent.node.label}`}</title>
                  <circle r={TOOL_R + 5} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} />
                  <circle r={TOOL_R - 2} fill="none" stroke="hsl(var(--primary) / 0.45)" strokeWidth={1.25} />
                  <text textAnchor="middle" y={0} fontSize={10} fontWeight={600} fill="hsl(var(--foreground) / 0.7)">
                    fn
                  </text>
                  <text textAnchor="middle" y={9} fontSize={7} fill="hsl(var(--muted-foreground))">
                    tool
                  </text>
                  <text textAnchor="middle" y={TOOL_R + 18} fontSize={9.5} fill="hsl(var(--muted-foreground))" {...HALO}>
                    {shorten(tool.label, 20)}
                  </text>
                </g>
              )
            })
          })}

          {/* Agents on the inner ring */}
          {agents.map((agent, index) => {
            const angle = index * step - Math.PI / 2
            const x = Math.cos(angle) * innerR
            const y = Math.sin(angle) * innerR
            const active = hovered === agent.node.id
            const faded = filters.fadeHealthy && agent.health === 'ok' && !active
            return (
              <g
                key={agent.node.id}
                data-map-node
                transform={`translate(${x} ${y})`}
                className="cursor-pointer"
                opacity={faded ? 0.78 : 1}
                onPointerEnter={() => setHovered(agent.node.id)}
                onPointerLeave={() => setHovered(null)}
                onClick={() => onOpenNode(agent.node.id)}
              >
                <title>
                  {`${agent.node.label} · ${agent.tools.length} tool${agent.tools.length === 1 ? '' : 's'}${agent.problem ? ` · ${agent.problem}` : ''}`}
                </title>
                <circle
                  r={AGENT_R + 8}
                  fill="hsl(var(--card))"
                  stroke={active ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--border))'}
                  strokeWidth={active ? 1.5 : 1}
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}
                />
                <circle r={AGENT_R} fill="none" stroke={RING[agent.health]} strokeWidth={agent.health === 'ok' ? 2 : 2.75} />
                <text textAnchor="middle" y={2} fontSize={15} fontWeight={600} fill="hsl(var(--foreground))">
                  {agent.tools.length}
                </text>
                <text textAnchor="middle" y={13} fontSize={7.5} fill="hsl(var(--muted-foreground))">
                  {agent.tools.length === 1 ? 'tool' : 'tools'}
                </text>
                <text textAnchor="middle" y={AGENT_R + 23} fontSize={11} fontWeight={500} fill="hsl(var(--foreground) / 0.8)" {...HALO}>
                  {shorten(agent.node.label)}
                </text>
                {agent.problem ? (
                  <text textAnchor="middle" y={AGENT_R + 35} fontSize={9} fontWeight={600} fill={RING[agent.health]} {...HALO}>
                    {agent.problem}
                  </text>
                ) : null}
              </g>
            )
          })}

          {/* The centre: the orchestrator or the workflow */}
          <g
            data-map-node
            className={center.node ? 'cursor-pointer' : undefined}
            onClick={center.node ? () => onOpenNode(center.node!.id) : undefined}
          >
            <title>{`${center.label} · ${count} agent${count === 1 ? '' : 's'}`}</title>
            <circle r={CENTER_R + 10} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.10))' }} />
            <circle r={CENTER_R + 4} fill="none" stroke="hsl(var(--primary))" strokeWidth={3} />
            <HealthRing r={22} counts={healthCounts} />
            <text textAnchor="middle" y={2} fontSize={14} fontWeight={600} fill="hsl(var(--foreground))">
              {count}
            </text>
            <text textAnchor="middle" y={12} fontSize={7} fill="hsl(var(--muted-foreground))">
              {count === 1 ? 'agent' : 'agents'}
            </text>
            <text textAnchor="middle" y={CENTER_R + 27} fontSize={12.5} fontWeight={600} fill="hsl(var(--foreground) / 0.9)" {...HALO}>
              {shorten(center.label, 24)}
            </text>
            <text textAnchor="middle" y={CENTER_R + 41} fontSize={9.5} fill="hsl(var(--muted-foreground))" {...HALO}>
              {center.caption}
            </text>
          </g>
        </g>
      </svg>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-3 text-[10px] text-muted-foreground">
        {(['ok', 'warning', 'error'] as const).map((health) => (
          <span key={health} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border-2" style={{ borderColor: RING[health] }} />
            {health === 'ok' ? 'Healthy' : health === 'warning' ? 'Needs attention' : 'Broken'}
          </span>
        ))}
      </div>
    </div>
  )
})

/** The centre's inner ring, split by how many agents are healthy, need attention or are broken. */
function HealthRing({ r, counts }: { r: number; counts: Record<Health, number> }) {
  const total = counts.ok + counts.warning + counts.error
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <g transform="rotate(-90)">
      {(['ok', 'warning', 'error'] as const).map((health) => {
        const length = (counts[health] / Math.max(total, 1)) * circumference
        const segment = (
          <circle
            key={health}
            r={r}
            fill="none"
            stroke={RING[health]}
            strokeWidth={3}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
          />
        )
        offset += length
        return length > 0 ? segment : null
      })}
    </g>
  )
}
