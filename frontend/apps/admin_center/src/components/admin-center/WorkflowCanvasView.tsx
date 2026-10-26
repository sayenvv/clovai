import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Bot, GitBranch, Maximize2, Minimize2, Minus, Network, Play, Plus, Scan, Wrench, type LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

/** A node or connector of the workspace canvas, as the workflow JSON's `canvas` block stores it. */
interface CanvasNode {
  id: string
  paletteId: string
  label?: string
  x: number
  y: number
  width?: number
  height?: number
  mappedAgentId?: string
}

interface CanvasEdge {
  id: string
  from: string
  to: string
  fromSide?: 'top' | 'right' | 'bottom' | 'left'
  toSide?: 'top' | 'right' | 'bottom' | 'left'
  label?: string
  connector?: { condition?: string }
}

type Kind = 'start' | 'manager' | 'switch' | 'tool' | 'agent'

const KINDS: Record<Kind, { label: string; icon: LucideIcon; tone: string }> = {
  start: { label: 'Start', icon: Play, tone: 'text-emerald-600 dark:text-emerald-400' },
  manager: { label: 'Orchestrator', icon: Network, tone: 'text-violet-600 dark:text-violet-400' },
  switch: { label: 'Switch', icon: GitBranch, tone: 'text-amber-600 dark:text-amber-400' },
  tool: { label: 'Tool', icon: Wrench, tone: 'text-sky-600 dark:text-sky-400' },
  agent: { label: 'Agent', icon: Bot, tone: 'text-foreground' },
}

const DEFAULT_SIZE = { width: 240, height: 64 }
const PADDING = 48

function kindOf(node: CanvasNode): Kind {
  if (node.paletteId === 'aw-start') return 'start'
  if (node.paletteId === 'aw-switch') return 'switch'
  if (node.mappedAgentId || node.paletteId === 'aw-tool' || node.paletteId === 'aw-mcp-tool') return 'tool'
  if (node.paletteId === 'aw-orchestrator' || node.paletteId === 'aw-planner' || node.paletteId === 'aw-group-manager') return 'manager'
  return 'agent'
}

/** Where a connector leaves or enters a node: the middle of the given side. */
function anchor(node: CanvasNode, side: CanvasEdge['fromSide']) {
  const width = node.width ?? DEFAULT_SIZE.width
  const height = node.height ?? DEFAULT_SIZE.height
  switch (side) {
    case 'left':
      return { x: node.x, y: node.y + height / 2 }
    case 'top':
      return { x: node.x + width / 2, y: node.y }
    case 'bottom':
      return { x: node.x + width / 2, y: node.y + height }
    default:
      return { x: node.x + width, y: node.y + height / 2 }
  }
}

/** The main page of a workflow JSON's canvas, or null when it has none. */
export function canvasOf(workflow: unknown): { nodes: CanvasNode[]; edges: CanvasEdge[] } | null {
  const canvas = (workflow as { canvas?: { activePageId?: string; pages?: Array<{ id: string; diagram?: { nodes?: CanvasNode[]; edges?: CanvasEdge[] } }> } })?.canvas
  const pages = canvas?.pages ?? []
  const page = pages.find((item) => item.id === canvas?.activePageId) ?? pages[0]
  const nodes = (page?.diagram?.nodes ?? []).filter((node) => typeof node?.x === 'number' && typeof node?.y === 'number')
  if (nodes.length === 0) return null
  return { nodes, edges: page?.diagram?.edges ?? [] }
}

/**
 * A read-only picture of a workflow's canvas, drawn from the positions the workspace editor saved:
 * agents, the orchestrator, switches (with each case's condition) and the tools under their agents.
 */
export function WorkflowCanvasView({ workflow, className }: { workflow: unknown; className?: string }) {
  const diagram = useMemo(() => canvasOf(workflow), [workflow])
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState<number | null>(null) // null: fit to the frame
  const [fullScreen, setFullScreen] = useState(false)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(([entry]) => setFrame({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const bounds = useMemo(() => {
    if (!diagram) return null
    const xs = diagram.nodes.flatMap((node) => [node.x, node.x + (node.width ?? DEFAULT_SIZE.width)])
    const ys = diagram.nodes.flatMap((node) => [node.y, node.y + (node.height ?? DEFAULT_SIZE.height)])
    const minX = Math.min(...xs) - PADDING
    const minY = Math.min(...ys) - PADDING
    return { minX, minY, width: Math.max(...xs) + PADDING - minX, height: Math.max(...ys) + PADDING - minY }
  }, [diagram])

  // A new workflow starts fitted again
  useEffect(() => setZoom(null), [diagram])

  // Full screen: fit again to the bigger frame, and Esc leaves it
  useEffect(() => {
    setZoom(null)
    if (!fullScreen) return
    const leave = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullScreen(false)
    }
    window.addEventListener('keydown', leave)
    return () => window.removeEventListener('keydown', leave)
  }, [fullScreen])

  if (!diagram || !bounds) {
    return (
      <div className={cn('flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border/70 text-[12px] text-muted-foreground', className)}>
        This workflow has no canvas to show. Open it in the canvas once and save it, or rebuild it.
      </div>
    )
  }

  // Inline: fit the width (scroll down for the rest); full screen: fit all of it
  const fitted =
    frame.width > 0
      ? Math.min(1, frame.width / bounds.width, fullScreen && frame.height > 0 ? frame.height / bounds.height : Infinity)
      : 1
  const scale = zoom ?? fitted
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]))

  return (
    <>
    {/* Full screen: the page behind is dimmed, and clicking it leaves */}
    {fullScreen ? (
      <div className="fixed inset-0 z-40 bg-background/85 backdrop-blur-sm" onClick={() => setFullScreen(false)} aria-hidden />
    ) : null}
    <div
      className={cn(
        'relative rounded-lg border border-border/70',
        fullScreen ? 'fixed inset-4 z-50 flex flex-col bg-background shadow-2xl' : className,
      )}
      role={fullScreen ? 'dialog' : undefined}
      aria-label={fullScreen ? 'Workflow canvas, full screen' : undefined}
    >
      <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-md border border-border/70 bg-card/90 p-0.5 shadow-sm backdrop-blur">
        {[
          { label: 'Zoom out', icon: Minus, action: () => setZoom(Math.max(0.2, scale / 1.25)) },
          { label: 'Fit to view', icon: Scan, action: () => setZoom(null) },
          { label: 'Zoom in', icon: Plus, action: () => setZoom(Math.min(2, scale * 1.25)) },
          fullScreen
            ? { label: 'Exit full screen (Esc)', icon: Minimize2, action: () => setFullScreen(false) }
            : { label: 'Full screen', icon: Maximize2, action: () => setFullScreen(true) },
        ].map(({ label, icon: Icon, action }) => (
          <button key={label} type="button" onClick={action} title={label} aria-label={label} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      <div
        ref={frameRef}
        className={cn('overflow-auto rounded-lg', fullScreen && 'min-h-0 flex-1')}
        style={{
          maxHeight: fullScreen ? undefined : 560,
          backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.14) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <div style={{ width: bounds.width * scale, height: bounds.height * scale }}>
          <div className="relative origin-top-left" style={{ width: bounds.width, height: bounds.height, transform: `scale(${scale})` }}>
            <svg className="pointer-events-none absolute inset-0" width={bounds.width} height={bounds.height} aria-hidden>
              <defs>
                <marker id="canvas-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/60" />
                </marker>
              </defs>
              {diagram.edges.map((edge) => {
                const from = byId.get(edge.from)
                const to = byId.get(edge.to)
                if (!from || !to) return null
                const a = anchor(from, edge.fromSide ?? 'right')
                const b = anchor(to, edge.toSide ?? 'left')
                const [x1, y1, x2, y2] = [a.x - bounds.minX, a.y - bounds.minY, b.x - bounds.minX, b.y - bounds.minY]
                const bend = Math.max(40, Math.abs(x2 - x1) / 2)
                const out = edge.fromSide === 'left' ? -bend : bend
                const into = edge.toSide === 'right' ? bend : -bend
                const label = edge.connector?.condition || edge.label
                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${x1} ${y1} C ${x1 + out} ${y1}, ${x2 + into} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      strokeWidth={1.5}
                      markerEnd="url(#canvas-arrow)"
                      className="stroke-muted-foreground/45"
                    />
                    {label ? (
                      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" className="fill-amber-700 text-[11px] dark:fill-amber-300">
                        {label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
              {/* Tools hang under their agent */}
              {diagram.nodes
                .filter((node) => node.mappedAgentId && byId.has(node.mappedAgentId))
                .map((tool) => {
                  const agent = byId.get(tool.mappedAgentId!)!
                  const a = anchor(agent, 'bottom')
                  const b = anchor(tool, 'top')
                  return (
                    <path
                      key={`tool-${tool.id}`}
                      d={`M ${a.x - bounds.minX} ${a.y - bounds.minY} L ${b.x - bounds.minX} ${b.y - bounds.minY}`}
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      className="stroke-sky-500/50"
                    />
                  )
                })}
            </svg>

            {diagram.nodes.map((node) => {
              const kind = kindOf(node)
              const meta = KINDS[kind]
              const Icon = meta.icon
              const width = node.width ?? DEFAULT_SIZE.width
              const height = node.height ?? DEFAULT_SIZE.height
              return (
                <div
                  key={node.id}
                  title={node.label}
                  style={{ left: node.x - bounds.minX, top: node.y - bounds.minY, width, height }}
                  className={cn(
                    'absolute flex items-center gap-2 border bg-card shadow-sm',
                    kind === 'start' ? 'justify-center rounded-xl border-emerald-500/40' : 'rounded-[10px] px-2.5',
                    kind === 'tool' ? 'border-sky-500/30 bg-sky-500/5' : kind === 'switch' ? 'border-amber-500/40' : kind === 'manager' ? 'border-violet-500/40' : 'border-border/80',
                  )}
                >
                  <span className={cn('flex shrink-0 items-center justify-center rounded-md bg-muted/60', kind === 'tool' ? 'h-5 w-5' : 'h-7 w-7', meta.tone)}>
                    <Icon className={kind === 'tool' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                  </span>
                  {kind === 'start' ? null : (
                    <span className="min-w-0">
                      <span className={cn('block truncate font-semibold text-foreground', kind === 'tool' ? 'text-[10.5px]' : 'text-[11.5px]')}>{node.label}</span>
                      {kind === 'tool' ? null : <span className="block text-[10px] text-muted-foreground">{meta.label}</span>}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
