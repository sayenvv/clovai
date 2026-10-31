import { Loader2 } from 'lucide-react'

/** Shown while the app loads for someone signed out: a plain spinner on the page background. */
export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}
