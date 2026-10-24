import { memo } from 'react'
import { Loader2 } from 'lucide-react'
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

/**
 * The workspace as it looks once loaded, shimmering: header with the view tabs, the library
 * rail, the canvas with its corner controls and a loading card in the middle, the workflow
 * tabs bar and the status bar.
 */
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
      {/* Header: logo and name, Editor / Code / Executions, actions. */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <div className={cn('size-7 rounded-md', SHIMMER)} />
        <div className={cn('h-3.5 w-36', SHIMMER_LINE)} />
        <div className="mx-auto hidden items-center gap-1 rounded-md bg-muted p-0.5 md:flex">
          {[52, 40, 72].map((width) => (
            <div key={width} className={cn('h-6 rounded-[5px]', SHIMMER)} style={{ width }} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className={cn('h-8 w-20 rounded-md', SHIMMER)} />
          <div className={cn('size-8 rounded-md', SHIMMER)} />
          <div className={cn('size-8 rounded-md', SHIMMER)} />
          <div className={cn('h-8 w-24 rounded-md', SHIMMER)} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Library rail */}
        <aside className="hidden w-14 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-background py-3 md:flex">
          <div className={cn('size-9 rounded-lg', SHIMMER)} />
          <div className={cn('size-9 rounded-lg', SHIMMER)} />
          <div className="my-1 h-px w-6 bg-border" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={cn('size-9 rounded-lg', SHIMMER)} />
          ))}
          <div className="my-1 h-px w-6 bg-border" />
          <div className={cn('size-9 rounded-lg', SHIMMER)} />
          <div className="flex-1" />
          <div className={cn('size-9 rounded-lg', SHIMMER)} />
          <div className={cn('size-9 rounded-full', SHIMMER)} />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Canvas */}
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[hsl(var(--canvas))]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle, hsl(var(--canvas-grid)) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            {/* Top-right: add + canvas actions; bottom-right: zoom. */}
            <div className="absolute right-4 top-4 flex flex-col items-center gap-2">
              <div className={cn('size-10 rounded-lg', SHIMMER)} />
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={cn('size-9 rounded-md', SHIMMER)} />
              ))}
            </div>
            <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className={cn('size-9 rounded-md', SHIMMER)} />
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-6 text-center shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
                <Loader2 className="size-6 animate-spin text-foreground/70" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow tabs */}
          <div className="flex h-10 shrink-0 items-center gap-2 border-t border-border bg-muted/70 px-2">
            <div className={cn('h-7 w-28 rounded-md', SHIMMER)} />
            <div className={cn('h-7 w-24 rounded-md opacity-70', SHIMMER)} />
            <div className={cn('size-7 rounded-md opacity-60', SHIMMER)} />
          </div>
        </main>
      </div>

      {/* Status bar */}
      <div className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-card px-3">
        <div className={cn('h-2.5 w-16', SHIMMER_LINE)} />
        <div className={cn('h-2.5 w-20', SHIMMER_LINE)} />
        <div className={cn('ml-auto h-2.5 w-28', SHIMMER_LINE)} />
        <div className={cn('size-5 rounded-full', SHIMMER)} />
      </div>
    </div>
  )
}

export const EXECUTE_LAUNCH_DELAY_MS = 2000
