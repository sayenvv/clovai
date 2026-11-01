import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppPreview, type AppRunner } from '@/components/agent-workflow/integrations/AppPreview'
import { getPublicApp, runPublicApp, type AppSettings, type PublicRun } from '@/services/deployments-api'

/** The text a visitor sees for a run: its output (a reply field when it has one), or what it waits for. */
function runText(run: PublicRun): string {
  if (run.status === 'waiting') {
    const waiting = run.waitingFor[0]
    return waiting?.question ? `Waiting: ${waiting.question}` : 'Your request is waiting for someone to review it.'
  }
  if (run.status !== 'succeeded') return run.error || 'The request could not be completed. Try again.'
  const output = run.output
  if (typeof output === 'string') return output
  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>
    for (const key of ['reply', 'answer', 'text', 'message', 'result']) if (typeof record[key] === 'string') return record[key] as string
    return JSON.stringify(output, null, 2)
  }
  return output == null ? 'Done.' : String(output)
}

/** One visitor's conversation with a chat app, kept for this browser tab. */
function conversationFor(workspace: string, slug: string): string {
  const key = `eleven-nodes-app-conversation:${workspace}/${slug}`
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) return existing
    const made = crypto.randomUUID()
    sessionStorage.setItem(key, made)
    return made
  } catch {
    return crypto.randomUUID()
  }
}

/**
 * A published app, as its visitors see it: at `/apps/<workspace>/<app>`, or at `/<app>` on the workspace's own
 * subdomain. No sign-in: runs go to the public endpoint and are charged to the app's owner.
 */
export default function PublicAppPage({ workspace: hostWorkspace }: { workspace?: string }) {
  const params = useParams()
  const [search] = useSearchParams()
  const workspace = hostWorkspace ?? params.workspace ?? ''
  const slug = params.slug ?? ''
  const [config, setConfig] = useState<AppSettings | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPublicApp(workspace, slug)
      .then((app) => {
        if (cancelled) return
        setConfig(app.config)
        document.title = app.config.title || app.name
      })
      .catch((error: unknown) => !cancelled && setProblem(error instanceof Error ? error.message : 'This app could not be loaded.'))
    return () => {
      cancelled = true
    }
  }, [workspace, slug])

  const run = useMemo<AppRunner>(() => {
    const conversation = conversationFor(workspace, slug)
    return async (inputs) => runText(await runPublicApp(workspace, slug, inputs, conversation))
  }, [workspace, slug])

  if (problem) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <p className="text-[15px] font-semibold text-foreground">App not available</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{problem}</p>
        </div>
      </div>
    )
  }
  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  const embedded = search.get('embed') === '1'
  return (
    <div className={embedded ? 'h-screen' : 'flex h-screen items-stretch justify-center bg-background sm:items-center sm:p-6'}>
      <AppPreview config={config} device="desktop" run={run} fill={embedded} />
    </div>
  )
}
