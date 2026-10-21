import { memo } from 'react'
import { Flag, Play } from 'lucide-react'
import { cn } from '@/utils/cn'
import { resolveFlowDirection, type DiagramNode, type FlowDirection } from '@/components/designer/diagram-types'
import { isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'

interface FlowBoundaryCardProps {
  node: DiagramNode
  isSelected?: boolean
  className?: string
  direction?: FlowDirection
}

/**
 * Start / End terminator — compact square version of the agent card. The green rail
 * sits on the connecting side: Start's exit, End's entry (right / left horizontally,
 * bottom / top vertically). The label sits off the flow axis.
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
          'border border-border bg-card shadow-sm',
          'transition-[border-color,box-shadow] duration-150',
          'hover:border-foreground/20 hover:shadow-md',
          isSelected && 'border-primary/70 shadow-md ring-2 ring-primary/20',
        )}
      >
        <span
          className={cn(
            'absolute bg-emerald-500/80',
            vertical ? 'inset-x-0 h-[3px]' : 'inset-y-0 w-[3px]',
            vertical ? (start ? 'bottom-0' : 'top-0') : start ? 'right-0' : 'left-0',
          )}
          aria-hidden
        />
        <span
          className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25"
          aria-hidden
        >
          <Icon className={cn('size-[18px] stroke-[1.75]', start && 'ml-0.5 fill-current')} />
        </span>
      </div>
      <span
        className={cn(
          'pointer-events-none absolute whitespace-nowrap text-[12px] font-semibold leading-none tracking-[-0.01em] text-card-foreground',
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
