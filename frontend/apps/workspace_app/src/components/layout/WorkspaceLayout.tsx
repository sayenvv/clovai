import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useActiveConfig } from '@/hooks/use-config'
import { AppConfigProvider } from '@/hooks/use-app-config'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { AuthLoadingScreen } from '@/components/shared/AuthLoadingScreen'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { WorkflowWorkspaceLoadingScreen } from '@/components/agent-workflow/ExecuteLaunchOverlay'
import { ProjectAuthGate } from '@/components/agent-workflow/ProjectAuthGate'
import { STORAGE_KEYS } from '@/constants'
import { getSession, restoreSessionFromServer, type ProjectSession } from '@/services/project-auth-store'

/** Chrome-free layout for tool workspaces (canvas designers). Loads the
 *  active configuration like AppLayout but renders no navbar or footer —
 *  the workspace owns the full viewport, like n8n or Figma. */
export function WorkspaceLayout() {
  const { data: record, isPending, isError, error, refetch } = useActiveConfig()
  const location = useLocation()
  // The workspace's own pages: the canvas at the root and its panels, the run page and the dashboard
  const isAgentWorkflowWorkspace =
    /^\/(library|inspect|logs|execute)?\/?$/.test(location.pathname) || location.pathname.startsWith('/tools/agent-workflow')
  const [session, setSession] = useState<ProjectSession | null>(() =>
    isAgentWorkflowWorkspace ? getSession() : null,
  )
  // The canvas skeleton only for someone signed in: signed out, the sign-in page comes next, not the workspace
  const workspaceFallback = !isAgentWorkflowWorkspace ? <LoadingScreen /> : session ? <WorkflowWorkspaceLoadingScreen /> : <AuthLoadingScreen />

  useEffect(() => {
    if (!isAgentWorkflowWorkspace) {
      setSession(null)
      return
    }
    const sync = () => setSession(getSession())
    sync()
    // The signed-in account from the server replaces a missing or stale tab session
    void restoreSessionFromServer()
    // The session is kept per tab but the tokens are shared by all tabs: when another tab signs
    // in or out (the tokens change), or this tab comes back into view, follow the tokens' account,
    // so this tab never shows one account while its requests go out as another
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEYS.accessToken || event.key === STORAGE_KEYS.refreshToken) {
        void restoreSessionFromServer()
      }
    }
    const onFocus = () => void restoreSessionFromServer()
    window.addEventListener('eleven-nodes-project-session', sync)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('eleven-nodes-project-session', sync)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
    }
  }, [isAgentWorkflowWorkspace, location.key])

  if (isPending) return workspaceFallback

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

  if (isAgentWorkflowWorkspace && !session) {
    return (
      <AppConfigProvider config={record.config}>
        <ErrorBoundary label="project sign-in">
          <ProjectAuthGate onAuthenticated={setSession} />
        </ErrorBoundary>
      </AppConfigProvider>
    )
  }

  return (
    <AppConfigProvider config={record.config}>
      <ErrorBoundary label="this workspace">
        <Suspense fallback={workspaceFallback}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppConfigProvider>
  )
}
