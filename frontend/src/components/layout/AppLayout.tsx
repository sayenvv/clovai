import { Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { Outlet } from 'react-router-dom'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useActiveConfig } from '@/hooks/use-config'
import { AppConfigProvider } from '@/hooks/use-app-config'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

/** Root layout: loads the active configuration once, then provides it to
 *  the entire tree. Everything below renders purely from that config. */
export function AppLayout() {
  const location = useLocation()
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
      <div className={`flex min-h-screen flex-col ${location.pathname === '/' ? 'landing-shell' : ''}`}>
        <Navbar />
        <main className="flex-1">
          <ErrorBoundary label="this page">
            <Suspense fallback={<LoadingScreen />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </AppConfigProvider>
  )
}
