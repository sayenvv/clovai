import { memo } from 'react'
import { Flag, Play } from 'lucide-react'
import { cn } from '@/utils/cn'
import { resolveFlowDirection, type DiagramNode, type FlowDirection } from '@/components/designer/diagram-types'
import { isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import { NODE_SURFACE, NODE_SURFACE_HOVER, NODE_SURFACE_SELECTED } from '@/components/agent-workflow/node-surface'

interface FlowBoundaryCardProps {
  node: DiagramNode
  isSelected?: boolean
  className?: string
  direction?: FlowDirection
}

/**
 * Start / End terminator — compact square version of the agent card: green for Start,
 * neutral for End. The label sits off the flow axis.
 */
export const FlowBoundaryCard = memo(function FlowBoundaryCard({
  node,
  isSelected = false,
  className,
  direction,
}: FlowBoundaryCardProps) {
  const start = isStartFlowNode(node)
  const vertical = resolveFlowDirection(direction) === 'vertical'
  const Icon = start ? Play : Flag
  const label = node.label?.trim() || (start ? 'Start' : 'End')

  return (
    <div className={cn('relative h-full w-full overflow-visible', className)} title={label}>
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl',
          NODE_SURFACE,
          NODE_SURFACE_HOVER,
          isSelected && NODE_SURFACE_SELECTED,
        )}
      >
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-[10px] ring-1 ring-inset',
            start
              ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/25 dark:text-emerald-300 dark:ring-emerald-400/25'
              : 'bg-gradient-to-b from-muted/40 to-muted text-foreground/75 ring-border',
          )}
          aria-hidden
        >
          <Icon className={cn('size-[18px] stroke-[1.75]', start && 'ml-0.5 fill-current')} />
        </span>
      </div>
      <span
        className={cn(
          'pointer-events-none absolute whitespace-nowrap text-[11px] font-semibold uppercase leading-none tracking-[0.06em] text-muted-foreground',
          vertical
            ? 'left-full top-1/2 ml-3 -translate-y-1/2'
            : 'left-1/2 top-full mt-2 -translate-x-1/2',
        )}
      >
        {label}
      </span>
    </div>
  )
})
