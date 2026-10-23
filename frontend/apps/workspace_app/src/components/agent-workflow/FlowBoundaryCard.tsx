import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Flag, Play } from 'lucide-react'
import { cn } from '@/utils/cn'
import { resolveFlowDirection, type DiagramNode, type FlowDirection } from '@/components/designer/diagram-types'
import { isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import { NODE_SURFACE, NODE_SURFACE_HOVER, NODE_SURFACE_SELECTED } from '@/components/agent-workflow/node-surface'

/** Set once someone runs a workflow from Start in this browser session, so the hint stops showing
 *  until the next session. */
const RUN_HINT_SEEN_KEY = 'eleven-nodes-start-run-hint-seen'

function readRunHintSeen(): boolean {
  try {
    return sessionStorage.getItem(RUN_HINT_SEEN_KEY) === 'true'
  } catch {
    return false
  }
}

function markRunHintSeen() {
  try {
    sessionStorage.setItem(RUN_HINT_SEEN_KEY, 'true')
  } catch {
    // ignore
  }
}

interface FlowBoundaryCardProps {
  node: DiagramNode
  isSelected?: boolean
  className?: string
  direction?: FlowDirection
  /** On the Start node: run the workflow from its play button. */
  onRun?: () => void
}

/** How far the pointer may move between press and release for it to count as a click. */
const CLICK_TOLERANCE_PX = 4

/**
 * Start / End terminator. Start is a node card with a green border and a large green ▶; End is a neutral
 * card with a flag. The label sits off the flow axis. With ``onRun``, clicking anywhere on
 * Start executes the workflow, while dragging it still moves the node.
 */
export const FlowBoundaryCard = memo(function FlowBoundaryCard({
  node,
  isSelected = false,
  className,
  direction,
  onRun,
}: FlowBoundaryCardProps) {
  const start = isStartFlowNode(node)
  const vertical = resolveFlowDirection(direction) === 'vertical'
  const Icon = start ? Play : Flag
  const label = node.label?.trim() || (start ? 'Start' : 'End')
  const runnable = start && Boolean(onRun)
  // Until the first run, the play button pulses and a hint points at it.
  const [hintSeen, setHintSeen] = useState(readRunHintSeen)
  const showHint = runnable && !hintSeen
  // The canvas captures the pointer to drag nodes, so the tile never receives a `click`.
  // Instead, a press and release without movement counts as a click and runs the workflow.
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  const lastRunRef = useRef(0)

  const run = () => {
    if (!onRun) return
    // A double-click is two presses; run once.
    const now = Date.now()
    if (now - lastRunRef.current < 600) return
    lastRunRef.current = now
    if (!hintSeen) {
      markRunHintSeen()
      setHintSeen(true)
    }
    onRun()
  }

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (!onRun || event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey) return
    pressRef.current = { x: event.clientX, y: event.clientY }
    const handleUp = (up: PointerEvent) => {
      window.removeEventListener('pointerup', handleUp)
      const press = pressRef.current
      pressRef.current = null
      if (!press) return
      if (Math.hypot(up.clientX - press.x, up.clientY - press.y) <= CLICK_TOLERANCE_PX) run()
    }
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div
      className={cn('relative h-full w-full overflow-visible', className)}
      title={start && onRun ? undefined : label}
    >
      {showHint && (
        // Outside the card so the pulse is not clipped by its rounded overflow.
        <span
          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-emerald-500/70 motion-safe:animate-ping"
          aria-hidden
        />
      )}
      {start ? (
        <div
          role={runnable ? 'button' : undefined}
          tabIndex={runnable ? 0 : undefined}
          aria-label={runnable ? 'Execute workflow' : undefined}
          title={runnable ? 'Execute workflow' : undefined}
          onPointerDown={runnable ? handlePointerDown : undefined}
          onKeyDown={
            runnable
              ? (event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  event.stopPropagation()
                  run()
                }
              : undefined
          }
          className={cn(
            'group/start relative flex h-full w-full items-center justify-center rounded-xl',
            // The same card as the other nodes, outlined in green, with a large green play icon.
            NODE_SURFACE,
            'border-2 border-emerald-500 text-emerald-600 dark:border-emerald-500 dark:text-emerald-400',
            runnable && 'cursor-pointer hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/10',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isSelected && 'ring-[3px] ring-emerald-500/25',
          )}
        >
          <Icon
            className={cn(
              'ml-1 h-1/2 w-1/2 fill-current stroke-[1.5] transition-transform duration-150',
              runnable && 'group-hover/start:scale-110',
            )}
            aria-hidden
          />
        </div>
      ) : (
        <div
          className={cn(
            'relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl',
            NODE_SURFACE,
            NODE_SURFACE_HOVER,
            isSelected && NODE_SURFACE_SELECTED,
          )}
        >
          <span
            className="flex size-9 items-center justify-center rounded-[10px] bg-gradient-to-b from-muted/40 to-muted text-foreground/75 ring-1 ring-inset ring-border"
            aria-hidden
          >
            <Icon className="size-[18px] stroke-[1.75]" />
          </span>
        </div>
      )}
      <span
        className={cn(
          'pointer-events-none absolute whitespace-nowrap text-[11px] font-semibold uppercase leading-none tracking-[0.06em]',
          start ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground',
          vertical
            ? 'left-full top-1/2 ml-3 -translate-y-1/2'
            : 'left-1/2 top-full mt-2 -translate-x-1/2',
        )}
      >
        {label}
      </span>
      {showHint && (
        <span
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-3 -translate-x-1/2 whitespace-nowrap rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white shadow-md motion-safe:animate-bounce"
          role="note"
        >
          Click to execute
          <span
            className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-emerald-600"
            aria-hidden
          />
        </span>
      )}
    </div>
  )
})
