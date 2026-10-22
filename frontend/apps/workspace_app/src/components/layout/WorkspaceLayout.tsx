import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useActiveConfig } from '@/hooks/use-config'
import { AppConfigProvider } from '@/hooks/use-app-config'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { WorkflowWorkspaceLoadingScreen } from '@/components/agent-workflow/ExecuteLaunchOverlay'
import { ProjectAuthGate } from '@/components/agent-workflow/ProjectAuthGate'
import { getSession, type ProjectSession } from '@/services/project-auth-store'

/** Chrome-free layout for tool workspaces (canvas designers). Loads the
 *  active configuration like AppLayout but renders no navbar or footer —
 *  the workspace owns the full viewport, like n8n or Figma. */
export function WorkspaceLayout() {
  const { data: record, isPending, isError, error, refetch } = useActiveConfig()
  const location = useLocation()
  const isAgentWorkflowWorkspace = location.pathname.startsWith('/tools/agent-workflow')
  const workspaceFallback = isAgentWorkflowWorkspace ? <WorkflowWorkspaceLoadingScreen /> : <LoadingScreen />
  const [session, setSession] = useState<ProjectSession | null>(() =>
    isAgentWorkflowWorkspace ? getSession() : null,
  )

  useEffect(() => {
    if (!isAgentWorkflowWorkspace) {
      setSession(null)
      return
    }
    const sync = () => setSession(getSession())
    sync()
    window.addEventListener('eleven-nodes-project-session', sync)
    return () => window.removeEventListener('eleven-nodes-project-session', sync)
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
