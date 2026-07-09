import { memo } from 'react'
import { Code2, Crown, LayoutTemplate } from 'lucide-react'
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
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 gap-1.5 border px-2.5 text-xs transition-all',
          mode === 'code'
            ? 'border-amber-400/70 bg-amber-500/10 text-amber-900 shadow-sm hover:bg-amber-500/15 dark:text-amber-100'
            : 'border-transparent text-muted-foreground hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-foreground',
        )}
        onClick={() => onModeChange('code')}
      >
        <Code2 className="h-3.5 w-3.5" />
        Code
        <span className="ml-0.5 inline-flex h-4 items-center gap-1 rounded-sm border border-amber-400/60 bg-amber-300/20 px-1.5 text-[9px] font-semibold uppercase text-amber-800 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-amber-200">
          <Crown className="h-2.5 w-2.5" />
          Premium
        </span>
      </Button>
      <span className="ml-1 text-[10px] text-muted-foreground">
        {mode === 'code'
          ? 'Premium JSON build spec + Python code'
          : 'Visual workflow editor'}
      </span>
    </div>
  )
})
