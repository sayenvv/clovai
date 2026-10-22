import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { ExecutionInspectorPanel } from '@/components/agent-workflow/ExecutionInspectorPanel'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import type { Diagram } from '@/components/designer/diagram-types'
import type { WorkflowRunState } from '@/types/agent-workflow'

interface ExecutionInspectorShellProps {
  diagram: Diagram
  runState: WorkflowRunState
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
}

export const ExecutionInspectorShell = memo(function ExecutionInspectorShell({
  diagram,
  runState,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
}: ExecutionInspectorShellProps) {
  if (collapsed) {
    return (
      <aside
        className="relative flex h-full shrink-0 flex-col border-l border-border/60 bg-background"
        style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
      >
        <div className="flex flex-col items-center gap-2 border-b border-border/60 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleCollapse}
            aria-label="Expand inspector panel"
            title="Expand inspector"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span
            className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]"
            style={{ transform: 'rotate(180deg)' }}
          >
            Inspector
          </span>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-border/60 bg-background"
      style={{ width }}
    >
      <DesignerResizeHandle
        side="left"
        onPointerDown={onResizePointerDown}
        ariaLabel="Resize inspector panel"
      />

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <p className="text-sm font-semibold text-foreground">Events & traces</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onToggleCollapse}
          aria-label="Collapse inspector panel"
          title="Collapse panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ExecutionInspectorPanel diagram={diagram} runState={runState} />
      </div>
    </aside>
  )
})
