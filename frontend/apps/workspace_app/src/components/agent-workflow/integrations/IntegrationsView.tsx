import { memo, useEffect, useState, type ComponentType } from 'react'
import { AppWindow, ArrowLeft, Braces, Code2, Copy, KeyRound, MessageSquare, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PublishedWorkflowInstance } from '@/services/published-instances-store'
import { getDeploymentApp, rotateDeploymentKey } from '@/services/deployments-api'
import { cn } from '@/utils/cn'

type MethodId = 'app' | 'api' | 'embed' | 'webhook' | 'chat-apps'

interface Method {
  id: MethodId
  title: string
  summary: string
  icon: ComponentType<{ className?: string }>
  soon?: boolean
}

const METHODS: Method[] = [
  { id: 'app', title: 'App', summary: 'A ready-made web app for this workflow, designed with the AI design assistant.', icon: AppWindow },
  { id: 'api', title: 'API', summary: 'Call the workflow from your own code over HTTPS.', icon: Braces },
  { id: 'embed', title: 'Embed widget', summary: 'A chat bubble on your website, with one script tag.', icon: Code2 },
  { id: 'webhook', title: 'Webhook', summary: 'Start the workflow when another system posts an event.', icon: Webhook, soon: true },
  { id: 'chat-apps', title: 'Slack & Teams', summary: 'Talk to the workflow where your team already works.', icon: MessageSquare, soon: true },
]

function copy(text: string, what: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error(`Could not copy the ${what.toLowerCase()}`),
  )
}

/** How a deployed workflow reaches people and systems: a built app, the API, an embed, and more to come. */
export const IntegrationsView = memo(function IntegrationsView({
  instance,
  onBack,
  onOpenAppBuilder,
}: {
  instance: PublishedWorkflowInstance
  onBack: () => void
  onOpenAppBuilder: () => void
}) {
  const [selected, setSelected] = useState<MethodId>('app')
  /** The published app's address (null until it is published). */
  const [appLink, setAppLink] = useState<string | null>(null)
  const appPublished = Boolean(appLink)

  useEffect(() => {
    if (!instance.deploymentId) return
    let cancelled = false
    getDeploymentApp(instance.deploymentId)
      .then((app) => !cancelled && setAppLink(app.status === 'published' ? app.url : null))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [instance.deploymentId])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--canvas))]">
      <div className="flex shrink-0 items-start gap-4 px-6 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onBack} className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Deployments
          </button>
          <h1 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-foreground">Integrations</h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {instance.workflowName} · v{instance.version} · {instance.environment}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-2">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {METHODS.map((method) => (
            <button
              key={method.id}
              type="button"
              disabled={method.soon}
              aria-pressed={selected === method.id}
              onClick={() => setSelected(method.id)}
              className={cn(
                'flex flex-col gap-1.5 rounded-[3px] border bg-card px-3 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors',
                selected === method.id ? 'border-primary/60 bg-primary/[0.03]' : 'border-border hover:border-foreground/20',
                method.soon && 'cursor-default opacity-60 hover:border-border',
              )}
            >
              <span className="flex items-center gap-2">
                <method.icon className="h-4 w-4 text-primary" />
                <span className="text-[12.5px] font-semibold text-foreground">{method.title}</span>
                {method.soon ? (
                  <Badge variant="outline" className="ml-auto text-[9.5px] font-normal">Coming soon</Badge>
                ) : method.id === 'app' && appPublished ? (
                  <Badge variant="outline" className="ml-auto border-emerald-500/40 bg-emerald-500/10 text-[9.5px] font-normal text-emerald-700 dark:text-emerald-300">
                    Published
                  </Badge>
                ) : null}
              </span>
              <span className="text-[11.5px] leading-4 text-muted-foreground">{method.summary}</span>
            </button>
          ))}
        </div>

        <section className="mt-4 max-w-4xl rounded-[3px] border border-border bg-card px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {selected === 'app' ? <AppMethod url={appLink} onOpenAppBuilder={onOpenAppBuilder} /> : null}
          {selected === 'api' ? <ApiMethod instance={instance} /> : null}
          {selected === 'embed' ? <EmbedMethod url={appLink} /> : null}
        </section>
      </div>
    </div>
  )
})

function AppMethod({ url, onOpenAppBuilder }: { url: string | null; onOpenAppBuilder: () => void }) {
  const published = Boolean(url)
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[13px] font-semibold text-foreground">Build an app for this workflow</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Choose a chat or a form, set its look and inputs, and preview it on desktop and mobile. The design assistant changes it
          from a description. Publishing gives it a link to share.
        </p>
      </div>
      {url ? (
        <div className="flex items-center gap-2 rounded-[3px] border border-border bg-muted/30 px-2.5 py-1.5">
          <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-primary hover:underline">
            {url}
          </a>
          <button type="button" aria-label="Copy app link" className="text-muted-foreground hover:text-foreground" onClick={() => copy(url, 'Link')}>
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <Button size="sm" className="h-8 gap-1.5 text-[12px]" onClick={onOpenAppBuilder}>
        <AppWindow className="h-3.5 w-3.5" /> {published ? 'Edit app' : 'Open app builder'}
      </Button>
    </div>
  )
}

function ApiMethod({ instance }: { instance: PublishedWorkflowInstance }) {
  const auth =
    instance.authType === 'api-key' ? `-H "X-API-Key: $ELEVEN_NODES_API_KEY"` : instance.authType === 'bearer' ? `-H "Authorization: Bearer $ELEVEN_NODES_TOKEN"` : ''
  const curl = [
    `curl -X ${instance.triggerMethod} "${instance.endpointUrl}"`,
    auth,
    instance.triggerMethod === 'POST' ? `-H "Content-Type: application/json"` : '',
    instance.triggerMethod === 'POST' ? `-d '{"message": "Hello"}'` : '',
  ]
    .filter(Boolean)
    .join(' \\\n  ')
  const headers = [
    instance.triggerMethod === 'POST' ? `'Content-Type': 'application/json'` : '',
    instance.authType === 'api-key' ? `'X-API-Key': process.env.ELEVEN_NODES_API_KEY` : '',
    instance.authType === 'bearer' ? `Authorization: \`Bearer \${process.env.ELEVEN_NODES_TOKEN}\`` : '',
  ].filter(Boolean)
  const js = `const response = await fetch('${instance.endpointUrl}', {
  method: '${instance.triggerMethod}',
  headers: { ${headers.join(', ')} },${instance.triggerMethod === 'POST' ? `\n  body: JSON.stringify({ message: 'Hello' }),` : ''}
})
const run = await response.json()`

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[13px] font-semibold text-foreground">Call it over HTTPS</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {instance.triggerMethod} {instance.endpointUrl} · auth: {instance.authType === 'none' ? 'none' : instance.authType}
        </p>
      </div>
      <ApiKey instance={instance} />
      <Snippet label="cURL" code={curl} />
      <Snippet label="JavaScript" code={js} />
    </div>
  )
}

/** The deployment's key: only its prefix is kept; replacing it shows the new key this once. */
function ApiKey({ instance }: { instance: PublishedWorkflowInstance }) {
  const [prefix, setPrefix] = useState(instance.apiKeyPrefix ?? '')
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!instance.deploymentId) {
    return <p className="text-[11.5px] text-muted-foreground">Deploy the workflow again to get its API key.</p>
  }
  const deploymentId = instance.deploymentId
  const replace = async () => {
    setBusy(true)
    try {
      const deployed = await rotateDeploymentKey(deploymentId)
      setPrefix(deployed.apiKeyPrefix)
      setFresh(deployed.apiKey ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not replace the key.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2 rounded-[3px] border border-border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12px] font-medium text-foreground">API key</span>
        <code className="text-[11.5px] text-muted-foreground">{prefix ? `${prefix}…` : 'shown once when created'}</code>
        <Button size="sm" variant="outline" className="ml-auto h-7 text-[11.5px]" disabled={busy} onClick={() => void replace()}>
          Replace key
        </Button>
      </div>
      {fresh ? (
        <div className="flex items-center gap-2 rounded-[3px] border border-amber-500/40 bg-amber-500/[0.06] px-2.5 py-1.5">
          <code className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">{fresh}</code>
          <button type="button" aria-label="Copy API key" className="text-muted-foreground hover:text-foreground" onClick={() => copy(fresh, 'Key')}>
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        {fresh ? 'Copy it now: it is not shown again. The old key has stopped working.' : 'Send it as X-API-Key. Replacing it stops the old one at once.'}
      </p>
    </div>
  )
}

function EmbedMethod({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="space-y-1">
        <h2 className="text-[13px] font-semibold text-foreground">Add a chat bubble to your site</h2>
        <p className="text-[12px] text-muted-foreground">The bubble opens your app, so build and publish the app first.</p>
      </div>
    )
  }
  const code = `<script src="${window.location.origin}/embed.js" data-app="${url}" data-position="bottom-right" async></script>`
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[13px] font-semibold text-foreground">Add a chat bubble to your site</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">Paste this before the closing body tag. The bubble opens your published app.</p>
      </div>
      <Snippet label="HTML" code={code} />
    </div>
  )
}

function Snippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-[3px] border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2.5 py-1">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <button type="button" onClick={() => copy(code, label)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>
      <pre className="overflow-x-auto bg-background px-3 py-2.5 font-mono text-[11.5px] leading-5 text-foreground">{code}</pre>
    </div>
  )
}
