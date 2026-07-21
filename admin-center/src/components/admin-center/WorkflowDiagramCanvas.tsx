import { useMemo, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  GitBranch,
  Play,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {
  DIAGRAM_NODE_SIZE,
  type DiagramNodeKind,
  type WorkflowDiagram,
} from '@/components/admin-center/mock-data'
import { cn } from '@/utils/cn'

const KIND_META: Record<
  DiagramNodeKind,
  { label: string; icon: LucideIcon; accent: string; ring: string }
> = {
  trigger: {
    label: 'Trigger',
    icon: Play,
    accent: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/30',
  },
  agent: {
    label: 'Agent',
    icon: Bot,
    accent: 'text-primary',
    ring: 'ring-primary/30',
  },
  tool: {
    label: 'Tool',
    icon: Wrench,
    accent: 'text-sky-600 dark:text-sky-400',
    ring: 'ring-sky-500/30',
  },
  approval: {
    label: 'Approval',
    icon: CheckCircle2,
    accent: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/30',
  },
  output: {
    label: 'Output',
    icon: GitBranch,
    accent: 'text-violet-600 dark:text-violet-400',
    ring: 'ring-violet-500/30',
  },
}

interface WorkflowDiagramCanvasProps {
  diagram: WorkflowDiagram
  highlightedNodeId?: string | null
  onSelectNode?: (nodeId: string | null) => void
  className?: string
}

/** Read-only user-facing workflow diagram (admin inspection). */
export function WorkflowDiagramCanvas({
  diagram,
  highlightedNodeId,
  onSelectNode,
  className,
}: WorkflowDiagramCanvasProps) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const activeId = highlightedNodeId ?? hoverId
  const { width: nodeW, height: nodeH } = DIAGRAM_NODE_SIZE

  const nodeMap = useMemo(
    () => new Map(diagram.nodes.map((node) => [node.id, node])),
    [diagram.nodes],
  )

  return (
    <div
      className={cn(
        'relative overflow-auto rounded-xl border border-border/70 bg-[hsl(var(--background))]',
        className,
      )}
      style={{
        backgroundImage:
          'radial-gradient(circle, hsl(var(--muted-foreground) / 0.14) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="relative min-h-[240px]" style={{ width: diagram.width, height: diagram.height }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={diagram.width}
          height={diagram.height}
          aria-hidden
        >
          <defs>
            <marker
              id="wf-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground/50" />
            </marker>
          </defs>
          {diagram.edges.map((edge) => {
            const from = nodeMap.get(edge.from)
            const to = nodeMap.get(edge.to)
            if (!from || !to) return null
            const x1 = from.x + nodeW
            const y1 = from.y + nodeH / 2
            const x2 = to.x
            const y2 = to.y + nodeH / 2
            const mid = (x1 + x2) / 2
            const related =
              activeId != null && (activeId === edge.from || activeId === edge.to)
            return (
              <path
                key={edge.id}
                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                fill="none"
                strokeWidth={related ? 2 : 1.5}
                markerEnd="url(#wf-arrow)"
                className={
                  related
                    ? 'stroke-primary/70'
                    : 'stroke-muted-foreground/40'
                }
              />
            )
          })}
        </svg>

        {diagram.nodes.map((node) => {
          const meta = KIND_META[node.kind]
          const Icon = meta.icon
          const active = activeId === node.id
          return (
            <button
              key={node.id}
              type="button"
              style={{ left: node.x, top: node.y, width: nodeW, height: nodeH }}
              className={cn(
                'absolute flex items-center gap-2.5 rounded-[10px] border bg-card px-3 text-left shadow-sm transition-all',
                'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? cn('border-primary/50 ring-2', meta.ring)
                  : 'border-border/80',
              )}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => onSelectNode?.(active ? null : node.id)}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60',
                  meta.accent,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-semibold text-foreground">
                  {node.label}
                </span>
                <span className="block text-[10px] text-muted-foreground">{meta.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
