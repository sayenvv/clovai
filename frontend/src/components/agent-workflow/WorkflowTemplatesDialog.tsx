import { memo } from 'react'
import {
  ArrowRightLeft,
  CheckCircle2,
  GitBranch,
  Layers,
  Magnet,
  MessagesSquare,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'
import {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
} from '@/components/agent-workflow/agent-workflow-templates'

const TEMPLATE_ICONS: Record<string, typeof Layers> = {
  sequential: Layers,
  parallel: GitBranch,
  handoff: ArrowRightLeft,
  'group-chat': MessagesSquare,
  magnetic: Magnet,
  'human-in-the-loop': Users,
}

interface WorkflowTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (template: WorkflowTemplate) => void
}

interface WorkflowTemplateGridProps {
  onSelect: (template: WorkflowTemplate) => void
  className?: string
  compact?: boolean
}

export const WorkflowTemplateGrid = memo(function WorkflowTemplateGrid({
  onSelect,
  className,
  compact = false,
}: WorkflowTemplateGridProps) {
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {WORKFLOW_TEMPLATES.map((template) => {
        const Icon = TEMPLATE_ICONS[template.id] ?? Sparkles
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className={cn(
              'group flex flex-col rounded-xl border border-red-500/15 bg-card/80 text-left transition-all',
              'hover:-translate-y-0.5 hover:border-red-500/40 hover:bg-red-500/[0.04] hover:shadow-md',
              compact ? 'gap-1.5 p-3' : 'gap-2 p-3.5',
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-300">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[13px] font-semibold tracking-tight text-foreground">
                    {template.title}
                  </p>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[9px] font-medium">
                    {template.badge}
                  </Badge>
                </div>
                <p className={cn('mt-1 text-[11px] leading-relaxed text-muted-foreground', compact && 'line-clamp-2')}>
                  {template.description}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[10px] text-muted-foreground">
                {template.plan.agents.length} agents · {template.plan.edges.length} connectors
              </span>
              {template.runtimeReady ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Runnable
                </span>
              ) : (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">Edit / export</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
})

export const WorkflowTemplatesDialog = memo(function WorkflowTemplatesDialog({
  open,
  onOpenChange,
  onSelect,
}: WorkflowTemplatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden border-red-500/20 p-0 sm:rounded-2xl">
        <div className="border-b border-red-500/15 bg-gradient-to-br from-red-500/[0.08] via-rose-500/[0.04] to-background px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-lg tracking-tight">Workflow templates</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Start from Sequential, Parallel, Handoff, Group chat, Magnetic, or Human-in-the-loop —
              then edit agents and connectors on the canvas.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-6 py-5">
          <WorkflowTemplateGrid
            onSelect={(template) => {
              onSelect(template)
              onOpenChange(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
})
