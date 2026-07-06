import { Skeleton } from '@/components/ui/skeleton'
import { Logo } from '@/components/shared/Logo'

/** Full-page fallback shown while the active configuration loads. */
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Logo size={30} className="animate-pulse opacity-80" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="hidden gap-6 md:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <div className="container flex flex-col items-center gap-6 py-28 text-center">
        <Skeleton className="h-6 w-56 rounded-full" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-5 w-full max-w-lg" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-11 w-40 rounded-md" />
          <Skeleton className="h-11 w-32 rounded-md" />
        </div>
      </div>
    </div>
  )
}
