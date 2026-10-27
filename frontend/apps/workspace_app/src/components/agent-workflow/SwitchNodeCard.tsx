import { memo } from 'react'
import { GitFork } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { DiagramNode } from '@/components/designer/diagram-types'
import { NODE_SURFACE, NODE_SURFACE_HOVER, NODE_SURFACE_SELECTED } from '@/components/agent-workflow/node-surface'

/** A Switch on the canvas: a router, so no model slot or capability docks like an agent card. */
export const SwitchNodeCard = memo(function SwitchNodeCard({
  node,
  caseCount,
  hasDefault,
  isSelected = false,
  className,
}: {
  node: DiagramNode
  caseCount: number
  hasDefault: boolean
  isSelected?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center gap-3 rounded-[3px] px-3',
        NODE_SURFACE,
        isSelected ? NODE_SURFACE_SELECTED : NODE_SURFACE_HOVER,
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[2px] bg-foreground/10 text-foreground">
        <GitFork className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-foreground">{node.label || 'Switch'}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {caseCount} {caseCount === 1 ? 'case' : 'cases'}
          {hasDefault ? ' + default' : <span className="text-amber-700 dark:text-amber-300"> · no default</span>}
        </p>
      </div>
    </div>
  )
})
