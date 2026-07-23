import { memo, type ComponentType } from 'react'
import {
  ArrowRightLeft,
  CheckCircle2,
  GitBranch,
  Layers,
  Magnet,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  type LucideProps,
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

type TemplateVisual = {
  icon: ComponentType<LucideProps>
  tile: string
  iconClass: string
}

const TEMPLATE_VISUALS: Record<string, TemplateVisual> = {
  sequential: {
    icon: Layers,
    tile: 'bg-gradient-to-br from-sky-500/20 to-blue-600/10 ring-1 ring-sky-500/25',
    iconClass: 'text-sky-600 dark:text-sky-300',
  },
  parallel: {
    icon: GitBranch,
    tile: 'bg-gradient-to-br from-violet-500/20 to-purple-600/10 ring-1 ring-violet-500/25',
    iconClass: 'text-violet-600 dark:text-violet-300',
  },
  handoff: {
    icon: ArrowRightLeft,
    tile: 'bg-gradient-to-br from-amber-500/20 to-orange-600/10 ring-1 ring-amber-500/25',
    iconClass: 'text-amber-700 dark:text-amber-300',
  },
  'group-chat': {
    icon: MessagesSquare,
    tile: 'bg-gradient-to-br from-emerald-500/20 to-teal-600/10 ring-1 ring-emerald-500/25',
    iconClass: 'text-emerald-700 dark:text-emerald-300',
  },
  magnetic: {
    icon: Magnet,
    tile: 'bg-gradient-to-br from-rose-500/20 to-red-600/10 ring-1 ring-rose-500/25',
    iconClass: 'text-rose-600 dark:text-rose-300',
  },
  'human-in-the-loop': {
    icon: ShieldCheck,
    tile: 'bg-gradient-to-br from-indigo-500/20 to-cyan-600/10 ring-1 ring-indigo-500/25',
    iconClass: 'text-indigo-600 dark:text-indigo-300',
  },
}

function templateVisual(id: string): TemplateVisual {
  return (
    TEMPLATE_VISUALS[id] ?? {
      icon: Sparkles,
      tile: 'bg-gradient-to-br from-red-500/20 to-rose-600/10 ring-1 ring-red-500/25',
      iconClass: 'text-red-600 dark:text-red-300',
    }
  )
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
  /** Phone-optimized 2-column grid with logo tiles. */
  density?: 'default' | 'mobile'
}

export const WorkflowTemplateGrid = memo(function WorkflowTemplateGrid({
  onSelect,
  className,
  compact = false,
  density = 'default',
}: WorkflowTemplateGridProps) {
  if (density === 'mobile') {
    return (
      <div className={cn('grid grid-cols-2 gap-2.5', className)}>
        {WORKFLOW_TEMPLATES.map((template) => {
          const visual = templateVisual(template.id)
          const Icon = visual.icon
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className="flex flex-col items-stretch rounded-2xl border border-border/80 bg-background/95 p-3 text-left shadow-sm transition-colors active:border-red-500/40 active:bg-red-500/[0.04]"
            >
              <div
                className={cn(
                  'mb-3 flex h-14 w-full items-center justify-center rounded-xl',
                  visual.tile,
                )}
                aria-hidden
              >
                <Icon className={cn('h-7 w-7', visual.iconClass)} strokeWidth={1.75} />
              </div>
              <div className="flex min-w-0 items-start justify-between gap-1">
                <p className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-foreground">
                  {template.badge}
                </p>
                {template.runtimeReady ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                {template.description}
              </p>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {WORKFLOW_TEMPLATES.map((template) => {
        const visual = templateVisual(template.id)
        const Icon = visual.icon
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
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  visual.tile,
                )}
              >
                <Icon className={cn('h-4 w-4', visual.iconClass)} />
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
                <p
                  className={cn(
                    'mt-1 text-[11px] leading-relaxed text-muted-foreground',
                    compact && 'line-clamp-2',
                  )}
                >
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
            compact
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
