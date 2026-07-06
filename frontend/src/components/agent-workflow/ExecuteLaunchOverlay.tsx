import { memo } from 'react'
import { Loader2, Play } from 'lucide-react'
import { cn } from '@/utils/cn'

const SHIMMER =
  'bg-gradient-to-r from-muted via-muted-foreground/15 to-muted bg-[length:200%_100%] animate-shimmer'

interface ExecuteLaunchOverlayProps {
  workflowName: string
}

/** Full-workspace shimmer while preparing navigation to the execute page. */
export const ExecuteLaunchOverlay = memo(function ExecuteLaunchOverlay({
  workflowName,
}: ExecuteLaunchOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background/90 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label="Preparing workflow execution"
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4">
        <div className={cn('h-7 w-7 rounded-lg', SHIMMER)} />
        <div className={cn('h-4 w-36 rounded-md', SHIMMER)} />
        <div className={cn('h-5 w-10 rounded-full', SHIMMER)} />
        <div className="ml-auto flex items-center gap-2">
          <div className={cn('h-8 w-24 rounded-md', SHIMMER)} />
          <div className={cn('h-8 w-20 rounded-md bg-emerald-500/20', SHIMMER)} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-14 shrink-0 border-r border-border/60 p-2 md:block">
          <div className={cn('mb-3 h-8 w-full rounded-lg', SHIMMER)} />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={cn('mb-2 h-10 w-full rounded-lg', SHIMMER)} />
          ))}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
          <div className={cn('mb-4 h-9 w-full max-w-2xl rounded-lg', SHIMMER)} />
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/50 bg-canvas/50">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Play className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Preparing execution</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Loading <span className="font-medium text-foreground">{workflowName}</span>…
                  </p>
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="absolute left-6 top-6 h-24 w-48 rounded-xl border border-border/40 bg-card/40 p-3">
              <div className={cn('mb-2 h-3 w-20 rounded', SHIMMER)} />
              <div className={cn('mb-1.5 h-2 w-full rounded', SHIMMER)} />
              <div className={cn('h-2 w-3/4 rounded', SHIMMER)} />
            </div>
            <div className="absolute bottom-8 left-1/2 h-24 w-52 -translate-x-1/2 rounded-xl border border-border/40 bg-card/40 p-3">
              <div className={cn('mb-2 h-3 w-24 rounded', SHIMMER)} />
              <div className={cn('mb-1.5 h-2 w-full rounded', SHIMMER)} />
              <div className={cn('h-2 w-2/3 rounded', SHIMMER)} />
            </div>
            <div className="absolute right-6 top-1/3 h-24 w-48 rounded-xl border border-border/40 bg-card/40 p-3">
              <div className={cn('mb-2 h-3 w-16 rounded', SHIMMER)} />
              <div className={cn('mb-1.5 h-2 w-full rounded', SHIMMER)} />
              <div className={cn('h-2 w-4/5 rounded', SHIMMER)} />
            </div>
          </div>
        </div>

        <aside className="hidden w-72 shrink-0 border-l border-border/60 p-4 lg:block">
          <div className={cn('mb-4 h-5 w-28 rounded', SHIMMER)} />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={cn('mb-3 h-12 w-full rounded-lg', SHIMMER)} />
          ))}
        </aside>
      </div>
    </div>
  )
})

export const EXECUTE_LAUNCH_DELAY_MS = 2000
