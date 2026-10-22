import { memo } from 'react'
import { Loader2, Play } from 'lucide-react'
import { cn } from '@/utils/cn'

const SHIMMER =
  'bg-gradient-to-r from-muted via-muted-foreground/15 to-muted bg-[length:200%_100%] animate-shimmer'
const SHIMMER_LINE = cn('rounded-sm', SHIMMER)

interface ExecuteLaunchOverlayProps {
  workflowName: string
}

/** Full-workspace shimmer while preparing navigation to the execute page. */
export const ExecuteLaunchOverlay = memo(function ExecuteLaunchOverlay({
  workflowName,
}: ExecuteLaunchOverlayProps) {
  return (
    <WorkflowWorkspaceShimmer
      title="Preparing execution"
      description={
        <>
          Loading <span className="font-medium text-foreground">{workflowName}</span>…
        </>
      }
      fixed
    />
  )
})

export function WorkflowWorkspaceLoadingScreen() {
  return (
    <WorkflowWorkspaceShimmer
      title="Loading workflow workspace"
      description="Preparing the agent workflow canvas and panels…"
    />
  )
}

function WorkflowWorkspaceShimmer({
  title,
  description,
  fixed = false,
}: {
  title: string
  description: React.ReactNode
  fixed?: boolean
}) {
  return (
    <div
      className={cn(
        'workspace-surface flex min-h-screen flex-col overflow-hidden bg-background text-foreground',
        fixed && 'fixed inset-0 z-[100]',
      )}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-3">
        <div className={cn('h-8 w-8 rounded-md border border-border', SHIMMER)} />
        <div className="min-w-0">
          <div className={cn('h-3.5 w-36', SHIMMER_LINE)} />
          <div className={cn('mt-1.5 h-2 w-20', SHIMMER_LINE)} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={cn('h-8 w-20 rounded-md border border-border', SHIMMER)} />
          <div className={cn('h-8 w-24 rounded-md border border-border', SHIMMER)} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[280px] shrink-0 border-r border-border bg-card/50 px-3 py-3 md:block">
          <div className={cn('h-3.5 w-28', SHIMMER_LINE)} />
          <div className={cn('mt-1.5 h-2.5 w-36', SHIMMER_LINE)} />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
                <div className={cn('h-7 w-7 rounded-md', SHIMMER)} />
                <div className={cn('h-3 w-28', SHIMMER_LINE)} />
              </div>
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="mt-5 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <div className={cn('h-4 w-4 rounded-sm', SHIMMER)} />
                <div className={cn('h-3 w-32', SHIMMER_LINE)} />
              </div>
            </div>
          ))}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={cn('h-4 rounded-sm', index === 0 ? 'w-9' : 'w-12', SHIMMER)} />
            ))}
            <div className={cn('ml-auto h-4 w-28 rounded-sm', SHIMMER)} />
          </div>

          <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-2">
            <div className={cn('h-7 w-20 rounded-md', SHIMMER)} />
            <div className={cn('h-7 w-28 rounded-md', SHIMMER)} />
            <div className={cn('h-3 w-44 rounded-sm', SHIMMER)} />
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-canvas">
            <div
              className="absolute inset-0 opacity-45"
              style={{
                backgroundImage:
                  'linear-gradient(hsl(var(--canvas-grid) / 0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--canvas-grid) / 0.35) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card/90 px-5 py-4 text-center shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Play className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
        </main>

        <aside className="hidden w-[340px] shrink-0 border-l border-border bg-card/50 px-4 py-3 lg:block">
          <div className={cn('h-4 w-28', SHIMMER_LINE)} />
          <div className={cn('mt-2 h-2.5 w-44', SHIMMER_LINE)} />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="mt-4 rounded-lg border border-border bg-background p-3">
              <div className={cn('h-3 w-24', SHIMMER_LINE)} />
              <div className={cn('mt-2 h-8 w-full rounded-md', SHIMMER)} />
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}

export const EXECUTE_LAUNCH_DELAY_MS = 2000
