import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle, Monitor, RotateCcw } from 'lucide-react'
import { useActiveConfig } from '@/hooks/use-config'
import { AppConfigProvider } from '@/hooks/use-app-config'
import { Button } from '@/components/ui/button'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import { WorkflowWorkspaceLoadingScreen } from '@/components/agent-workflow/ExecuteLaunchOverlay'
import { ProjectAuthGate } from '@/components/agent-workflow/ProjectAuthGate'
import { getSession, type ProjectSession } from '@/services/project-auth-store'

const DESKTOP_WORKSPACE_QUERY = '(min-width: 1024px)'

function useDesktopWorkspaceSupport() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    return window.matchMedia(DESKTOP_WORKSPACE_QUERY).matches
  })

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_WORKSPACE_QUERY)
    const update = () => setIsDesktop(media.matches)

    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isDesktop
}

function DesktopOnlyWorkspaceMessage() {
  return (
    <div className="workspace-surface flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <main className="flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-md border border-border bg-card shadow-sm">
          <Monitor className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Desktop workspace
        </p>
        <h1 className="mt-3 text-2xl font-semibold leading-tight text-foreground">
          Desktop size is supported only
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Agent workflow automation uses a wide canvas and inspector panels. Open this
          workflow on a laptop or desktop screen to continue.
        </p>
      </main>
    </div>
  )
}

/** Chrome-free layout for tool workspaces (canvas designers). Loads the
 *  active configuration like AppLayout but renders no navbar or footer —
 *  the workspace owns the full viewport, like n8n or Figma. */
export function WorkspaceLayout() {
  const { data: record, isPending, isError, error, refetch } = useActiveConfig()
  const location = useLocation()
  const isDesktop = useDesktopWorkspaceSupport()
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

  if (isAgentWorkflowWorkspace && isDesktop === false) {
    return <DesktopOnlyWorkspaceMessage />
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
