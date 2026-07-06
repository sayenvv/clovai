import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useActiveConfig } from '@/hooks/use-config'
import { AppConfigProvider } from '@/hooks/use-app-config'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { LoadingScreen } from '@/components/shared/LoadingScreen'

/** Chrome-free layout for tool workspaces (canvas designers). Loads the
 *  active configuration like AppLayout but renders no navbar or footer —
 *  the workspace owns the full viewport, like n8n or Figma. */
export function WorkspaceLayout() {
  const { data: record, isPending, isError, error, refetch } = useActiveConfig()

  if (isPending) return <LoadingScreen />

  if (isError || !record) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <h1 className="text-lg font-semibold">Could not load configuration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'The configuration service is unavailable.'}
          </p>
        </div>
        <Button onClick={() => void refetch()}>
          <RotateCcw /> Retry
        </Button>
      </div>
    )
  }

  return (
    <AppConfigProvider config={record.config}>
      <ErrorBoundary label="this workspace">
        <Suspense fallback={<LoadingScreen />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppConfigProvider>
  )
}
