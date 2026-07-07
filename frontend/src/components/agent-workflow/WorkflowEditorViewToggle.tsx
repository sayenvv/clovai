import { memo } from 'react'
import { Code2, LayoutTemplate } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

export type WorkflowEditorViewMode = 'canvas' | 'code'

interface WorkflowEditorViewToggleProps {
  mode: WorkflowEditorViewMode
  onModeChange: (mode: WorkflowEditorViewMode) => void
}

/** Switch between visual canvas and build-spec code debug view. */
export const WorkflowEditorViewToggle = memo(function WorkflowEditorViewToggle({
  mode,
  onModeChange,
}: WorkflowEditorViewToggleProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b bg-muted/30 px-2 py-1">
      <Button
        variant={mode === 'canvas' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn('h-7 gap-1.5 px-2.5 text-xs', mode === 'canvas' && 'shadow-sm')}
        onClick={() => onModeChange('canvas')}
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
        Canvas
      </Button>
      <Button
        variant={mode === 'code' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn('h-7 gap-1.5 px-2.5 text-xs', mode === 'code' && 'shadow-sm')}
        onClick={() => onModeChange('code')}
      >
        <Code2 className="h-3.5 w-3.5" />
        Code
      </Button>
      <span className="ml-1 text-[10px] text-muted-foreground">
        {mode === 'code'
          ? 'JSON build spec + Python code'
          : 'Visual workflow editor'}
      </span>
    </div>
  )
})
