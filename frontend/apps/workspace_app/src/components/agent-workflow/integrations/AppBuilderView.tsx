import { memo, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Code2,
  Copy,
  Eye,
  LayoutTemplate,
  Loader2,
  Monitor,
  Plus,
  Rocket,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AppPreview } from '@/components/agent-workflow/integrations/AppPreview'
import { BuilderPane, BuilderStage, PaneTabs } from '@/components/agent-workflow/integrations/BuilderPane'
import { CodeAppWorkspace } from '@/components/agent-workflow/integrations/CodeAppWorkspace'
import { usePersistedChat } from '@/components/agent-workflow/hooks/use-persisted-chat'
import { usePersistedHorizontalPanel } from '@/components/agent-workflow/hooks/use-workflow-editor-panels'
import { APP_BUILDER_ASSISTANT_PANEL, APP_BUILDER_SETTINGS_PANEL } from '@/components/agent-workflow/panel-layout'
import { useWorkspaceBreakpoint } from '@/hooks/use-workspace-breakpoint'
import type { PublishedWorkflowInstance } from '@/services/published-instances-store'
import {
  designDeploymentApp,
  getDeploymentApp,
  publishDeploymentApp,
  publishDeploymentCodeApp,
  saveDeploymentApp,
  type AppSettings,
  type DeploymentApp,
} from '@/services/deployments-api'
import {
  defaultAppConfig,
  readAppConfig,
  saveAppConfig,
  type WorkflowAppConfig,
  type WorkflowAppField,
} from '@/services/workflow-apps-store'
import { cn } from '@/utils/cn'

/** The settings the server keeps for an app (without the builder's own bookkeeping). */
function settingsOf(config: WorkflowAppConfig): AppSettings {
  const { instanceId: _instanceId, status: _status, publishedAt: _publishedAt, updatedAt: _updatedAt, ...settings } = config
  return { ...settings, suggestions: settings.suggestions.map((item) => item.trim()).filter(Boolean) }
}

/** The builder's config from the server's app (its defaults until the first save). */
function fromServer(instance: PublishedWorkflowInstance, app: DeploymentApp): WorkflowAppConfig {
  return {
    ...defaultAppConfig(instance),
    ...(app.config ?? {}),
    status: app.status,
    publishedAt: app.publishedAt ?? undefined,
  }
}

const ACCENTS = ['#EB6115', '#2563EB', '#7C3AED', '#059669', '#DB2777', '#111827']
const DESIGN_IDEAS = ['Make it dark with a blue accent', 'Turn it into a form with name and email', 'Make the corners rounder', 'Write a friendlier welcome']

/**
 * Builds the app a deployment's users open: its template, look and inputs on the left, a live preview in the middle
 * and the AI design assistant on the right. Saved per deployment; publishing gives it a URL.
 */
export const AppBuilderView = memo(function AppBuilderView({
  instance,
  onBack,
}: {
  instance: PublishedWorkflowInstance
  onBack: () => void
}) {
  const deploymentId = instance.deploymentId
  const [config, setConfig] = useState<WorkflowAppConfig>(() => readAppConfig(instance))
  const [saved, setSaved] = useState(config)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(deploymentId))
  const [busy, setBusy] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [mode, setMode] = useState<'design' | 'code'>('design')
  const [codeOpened, setCodeOpened] = useState(false)
  const [codeProjectId, setCodeProjectId] = useState<string | null>(null)
  // What the app's address serves now: the template or the code app
  const [liveSource, setLiveSource] = useState<'template' | 'code'>('template')
  // Kept here and in this browser, so the conversation survives the layout changing, leaving and reloading
  const { messages: designMessages, setMessages: setDesignMessages } = usePersistedChat<DesignMessage>(
    deploymentId ? `app-design:${deploymentId}` : undefined,
  )
  const [tab, setTab] = useState<'settings' | 'preview' | 'assistant'>('preview')
  const { isDesktop } = useWorkspaceBreakpoint()
  const settingsPane = usePersistedHorizontalPanel(APP_BUILDER_SETTINGS_PANEL, false)
  const assistantPane = usePersistedHorizontalPanel(APP_BUILDER_ASSISTANT_PANEL, true)
  const changeMode = (next: 'design' | 'code') => {
    setMode(next)
    if (next === 'code') setCodeOpened(true)
  }
  const dirty = JSON.stringify(settingsOf(config)) !== JSON.stringify(settingsOf(saved))
  const update = (patch: Partial<WorkflowAppConfig>) => setConfig((previous) => ({ ...previous, ...patch }))

  // The app lives with the deployment on the server; a deploy made before that keeps it in this browser
  useEffect(() => {
    if (!deploymentId) return
    let cancelled = false
    getDeploymentApp(deploymentId)
      .then((app) => {
        if (cancelled) return
        const loaded = fromServer(instance, app)
        setConfig(loaded)
        setSaved(loaded)
        setUrl(app.url)
        setLiveSource(app.source ?? 'template')
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not load the app.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [deploymentId, instance])

  const save = async (): Promise<boolean> => {
    if (!deploymentId) {
      const next = saveAppConfig(config)
      setConfig(next)
      setSaved(next)
      return true
    }
    setBusy(true)
    try {
      const app = await saveDeploymentApp(deploymentId, settingsOf(config))
      const next = fromServer(instance, app)
      setConfig(next)
      setSaved(next)
      setUrl(app.url)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the app.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (mode === 'code') return publishCode()
    if (!deploymentId || !(await save())) return
    setBusy(true)
    try {
      const app = await publishDeploymentApp(deploymentId)
      setLiveSource('template')
      const next = fromServer(instance, app)
      setConfig(next)
      setSaved(next)
      setUrl(app.url)
      toast.success('App published', { description: app.url ?? undefined })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not publish the app.')
    } finally {
      setBusy(false)
    }
  }

  /** Build the code-mode project and publish it at the app's address, in place of the template. */
  const publishCode = async () => {
    if (!deploymentId || !codeProjectId) return
    setBusy(true)
    const progress = toast.loading('Building your app…', { description: 'This can take a minute.' })
    try {
      const app = await publishDeploymentCodeApp(deploymentId, codeProjectId)
      const next = fromServer(instance, app)
      setConfig(next)
      setSaved(next)
      setUrl(app.url)
      setLiveSource('code')
      toast.success('Code app published', { id: progress, description: app.url ?? undefined })
    } catch (error) {
      toast.error('Could not publish the code app', { id: progress, description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  /** The design assistant's change, shown in the preview to review and save (on a small screen, it opens there). */
  const applyDesign = (settings: AppSettings) => {
    setConfig((previous) => ({ ...previous, ...settings }))
    if (!isDesktop) setTab('preview')
  }

  // Ctrl/⌘+S saves, as in an editor
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const leave = () => {
    if (dirty && !window.confirm('Leave the app builder? Your unsaved changes will be lost.')) return
    onBack()
  }

  const settingsPanel = (
    <AppSettingsForm deploymentId={deploymentId} config={config} url={url} update={update} />
  )
  const assistant = (
    <DesignAssistant deploymentId={deploymentId} settings={settingsOf(config)} onApply={applyDesign} messages={designMessages} setMessages={setDesignMessages} />
  )
  const preview = <PreviewStage config={config} device={isDesktop ? device : 'mobile'} onDeviceChange={isDesktop ? setDevice : undefined} dirty={dirty} />

  return (
    // min-w-0 + overflow-hidden: wide content (a long line of code) scrolls inside its pane instead of widening the page
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--canvas))]">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={leave}
          aria-label="Back to integrations"
          className="flex h-8 items-center gap-1.5 rounded-[3px] px-2 text-[12px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Integrations</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <span className="truncate">{config.title || 'Untitled app'}</span>
            <Badge variant="outline" className={cn('shrink-0 text-[10px] font-normal', config.status === 'published' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>
              {config.status === 'published' ? (liveSource === 'code' ? 'Published · code' : 'Published · template') : 'Draft'}
            </Badge>
          </p>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
            App for {instance.workflowName} · v{instance.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="Builder mode"
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'design', label: 'Template', icon: <LayoutTemplate /> },
              { value: 'code', label: 'Code (AI)', icon: <Code2 /> },
            ]}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-[12px]"
            disabled={!dirty || busy || loading}
            title={dirty ? 'Save (Ctrl/⌘+S)' : 'All changes saved'}
            onClick={() => void save()}
          >
            {dirty ? <><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Save</> : <><Check className="h-3.5 w-3.5" /><span className="hidden sm:inline">Saved</span></>}
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-[12px]"
            disabled={!deploymentId || busy || loading || (mode === 'code' && !codeProjectId)}
            title={
              !deploymentId
                ? 'Deploy the workflow again to publish its app'
                : mode === 'code'
                  ? codeProjectId
                    ? 'Build this code app and publish it at the app link, in place of the template'
                    : 'Ask the assistant to build the app first'
                  : liveSource === 'code'
                    ? 'Publish the template at the app link, in place of the code app'
                    : undefined
            }
            onClick={() => void publish()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">
              {mode === 'code'
                ? liveSource === 'code'
                  ? 'Republish code app'
                  : 'Publish code app'
                : config.status === 'published' && liveSource === 'template'
                  ? dirty
                    ? 'Save & publish'
                    : 'Published'
                  : 'Publish template'}
            </span>
          </Button>
        </div>
      </header>

      {/* Code mode stays mounted once opened, so its conversation survives switching modes */}
      {codeOpened ? (
        <div className={cn('flex min-h-0 flex-1 flex-col', mode !== 'code' && 'hidden')}>
          <CodeAppWorkspace key={deploymentId ?? 'none'} deploymentId={deploymentId} isDesktop={isDesktop} onProjectId={setCodeProjectId} />
        </div>
      ) : null}

      <div className={cn('flex min-h-0 flex-1 flex-col', mode === 'code' && 'hidden')}>
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the app…
          </div>
        ) : (
          <>
            {!isDesktop ? (
              <PaneTabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'settings', label: 'Settings', icon: <SlidersHorizontal /> },
                  { id: 'preview', label: 'Preview', icon: <Eye />, badge: dirty && tab !== 'preview' },
                  { id: 'assistant', label: 'Assistant', icon: <Wand2 /> },
                ]}
              />
            ) : null}
            <div className="flex min-h-0 flex-1">
              <BuilderPane side="left" title="Settings" icon={<SlidersHorizontal />} panel={settingsPane} stacked={!isDesktop} active={tab === 'settings'}>
                {settingsPanel}
              </BuilderPane>
              <BuilderStage hidden={!isDesktop && tab !== 'preview'}>{preview}</BuilderStage>
              <BuilderPane side="right" title="Design assistant" icon={<Wand2 />} panel={assistantPane} stacked={!isDesktop} active={tab === 'assistant'}>
                {assistant}
              </BuilderPane>
            </div>
          </>
        )}
      </div>
    </div>
  )
})

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon: ReactNode }[]
}) {
  return (
    <div className="flex items-center rounded-[3px] border border-border p-0.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-[2px] px-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground [&>svg]:h-3.5 [&>svg]:w-3.5',
            value === option.value && 'bg-foreground/[0.08] text-foreground',
          )}
        >
          {option.icon}
          <span className="hidden md:inline">{option.label}</span>
        </button>
      ))}
    </div>
  )
}

/** The live preview, centred on the canvas with its own toolbar (device size, unsaved changes). */
function PreviewStage({
  config,
  device,
  onDeviceChange,
  dirty,
}: {
  config: WorkflowAppConfig
  device: 'desktop' | 'mobile'
  /** Absent on small screens, where the preview always fits the screen. */
  onDeviceChange?: (device: 'desktop' | 'mobile') => void
  dirty: boolean
}) {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[hsl(var(--canvas))]">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[12px] font-medium text-foreground">Preview</p>
        {dirty ? <span className="truncate text-[11px] text-muted-foreground">· unsaved changes</span> : null}
        {onDeviceChange ? (
          <div className="ml-auto">
            <Segmented
              label="Preview size"
              value={device}
              onChange={onDeviceChange}
              options={[
                { value: 'desktop', label: 'Desktop', icon: <Monitor /> },
                { value: 'mobile', label: 'Mobile', icon: <Smartphone /> },
              ]}
            />
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-3 sm:p-6">
        <AppPreview config={config} device={device} />
      </div>
    </main>
  )
}

/** The app's template, content and look. */
function AppSettingsForm({
  deploymentId,
  config,
  url,
  update,
}: {
  deploymentId?: string
  config: WorkflowAppConfig
  url: string | null
  update: (patch: Partial<WorkflowAppConfig>) => void
}) {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
      {!deploymentId ? (
        <p className="rounded-[3px] border border-amber-500/30 bg-amber-500/[0.06] p-2.5 text-[11.5px] text-amber-800 dark:text-amber-300">
          This deployment was made before apps could be published. Deploy the workflow again to publish its app; the
          design is kept in this browser until then.
        </p>
      ) : null}
      {config.status === 'published' && url ? (
        <div className="space-y-1.5 rounded-[3px] border border-emerald-500/30 bg-emerald-500/[0.05] p-2.5">
          <p className="text-[11px] font-medium text-foreground">App link</p>
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{url}</code>
            <button
              type="button"
              aria-label="Copy app link"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <Group title="Template">
        <div className="grid grid-cols-2 gap-2">
          {(['chat', 'form'] as const).map((template) => (
            <button
              key={template}
              type="button"
              aria-pressed={config.template === template}
              onClick={() => update({ template })}
              className={cn(
                'rounded-[3px] border px-2 py-2 text-left text-[11.5px] transition-colors',
                config.template === template ? 'border-primary bg-primary/[0.06] text-foreground' : 'border-border text-muted-foreground hover:bg-foreground/[0.03]',
              )}
            >
              <span className="block font-medium text-foreground">{template === 'chat' ? 'Chat' : 'Form'}</span>
              {template === 'chat' ? 'A conversation with the workflow' : 'Fields in, result out'}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Content">
        <Labelled label="Title">
          <Input value={config.title} onChange={(event) => update({ title: event.target.value })} className="h-8 text-[12.5px]" />
        </Labelled>
        <Labelled label="Description">
          <Input value={config.description} onChange={(event) => update({ description: event.target.value })} className="h-8 text-[12.5px]" />
        </Labelled>
        <Labelled label={config.template === 'chat' ? 'Welcome message' : 'Intro text'}>
          <Textarea rows={3} value={config.welcome} onChange={(event) => update({ welcome: event.target.value })} className="text-[12.5px]" />
        </Labelled>
        {config.template === 'chat' ? (
          <Labelled label="Suggested prompts" hint="One per line">
            <Textarea
              rows={3}
              value={config.suggestions.join('\n')}
              onChange={(event) => update({ suggestions: event.target.value.split('\n') })}
              className="text-[12.5px]"
            />
          </Labelled>
        ) : (
          <FieldsEditor fields={config.fields} submitLabel={config.submitLabel} onChange={update} />
        )}
      </Group>

      <Group title="Look">
        <Labelled label="Accent colour">
          <div className="flex flex-wrap items-center gap-1.5">
            {ACCENTS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Accent ${color}`}
                aria-pressed={config.accentColor.toLowerCase() === color.toLowerCase()}
                onClick={() => update({ accentColor: color })}
                className={cn('h-6 w-6 rounded-full ring-offset-2 ring-offset-card', config.accentColor.toLowerCase() === color.toLowerCase() && 'ring-2 ring-foreground/60')}
                style={{ background: color }}
              />
            ))}
            <input
              type="color"
              aria-label="Custom accent colour"
              value={config.accentColor}
              onChange={(event) => update({ accentColor: event.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
            />
          </div>
        </Labelled>
        <Labelled label="Theme">
          <Select value={config.theme} onChange={(event) => update({ theme: event.target.value as WorkflowAppConfig['theme'] })}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Labelled>
        <Labelled label="Corners">
          <Select value={config.corners} onChange={(event) => update({ corners: event.target.value as WorkflowAppConfig['corners'] })}>
            <option value="sharp">Sharp</option>
            <option value="rounded">Rounded</option>
            <option value="pill">Pill</option>
          </Select>
        </Labelled>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-foreground">Show “Powered by Eleven Nodes”</span>
          <Switch checked={config.showBranding} onCheckedChange={(showBranding) => update({ showBranding })} aria-label="Show branding" />
        </div>
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between text-[11.5px] font-medium text-foreground">
        {label}
        {hint ? <span className="font-normal text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

function FieldsEditor({
  fields,
  submitLabel,
  onChange,
}: {
  fields: WorkflowAppField[]
  submitLabel: string
  onChange: (patch: Partial<WorkflowAppConfig>) => void
}) {
  const set = (index: number, patch: Partial<WorkflowAppField>) =>
    onChange({ fields: fields.map((field, at) => (at === index ? { ...field, ...patch } : field)) })
  return (
    <div className="space-y-2">
      <span className="text-[11.5px] font-medium text-foreground">Fields</span>
      {fields.map((field, index) => (
        <div key={index} className="space-y-1.5 rounded-[3px] border border-border p-2">
          <div className="flex gap-1.5">
            <Input value={field.label} placeholder="Label" onChange={(event) => set(index, { label: event.target.value })} className="h-7 text-[12px]" />
            <button
              type="button"
              aria-label="Remove field"
              disabled={fields.length === 1}
              onClick={() => onChange({ fields: fields.filter((_, at) => at !== index) })}
              className="text-muted-foreground hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-1.5">
            <Input
              value={field.name}
              placeholder="Input name"
              onChange={(event) => set(index, { name: event.target.value.replace(/[^A-Za-z0-9_]/g, '_') })}
              className="h-7 font-mono text-[11px]"
              aria-label="Input name the workflow receives"
            />
            <Select value={field.type} onChange={(event) => set(index, { type: event.target.value as WorkflowAppField['type'] })} className="h-7 w-[104px] text-[11.5px]">
              <option value="text">Text</option>
              <option value="textarea">Long text</option>
              <option value="number">Number</option>
              <option value="email">Email</option>
              <option value="date">Date</option>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={field.required} onChange={(event) => set(index, { required: event.target.checked })} /> Required
          </label>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 w-full gap-1 text-[11.5px]"
        onClick={() => onChange({ fields: [...fields, { name: `field_${fields.length + 1}`, label: 'New field', type: 'text', required: false }] })}
      >
        <Plus className="h-3.5 w-3.5" /> Add field
      </Button>
      <Labelled label="Button text">
        <Input value={submitLabel} onChange={(event) => onChange({ submitLabel: event.target.value })} className="h-8 text-[12.5px]" />
      </Labelled>
    </div>
  )
}

/**
 * The AI design assistant: describe a change to the app ("make it dark", "add an email field") and it returns new
 * settings, shown in the preview right away; nothing is saved until the user saves.
 */
type DesignMessage = { role: 'user' | 'assistant'; text: string; failed?: boolean }

function DesignAssistant({
  deploymentId,
  settings,
  onApply,
  messages,
  setMessages,
}: {
  deploymentId?: string
  settings: AppSettings
  onApply: (settings: AppSettings) => void
  messages: DesignMessage[]
  setMessages: Dispatch<SetStateAction<DesignMessage[]>>
}) {
  const [text, setText] = useState('')
  const [working, setWorking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, working])

  const send = async (value: string) => {
    const request = value.trim()
    if (!request || working || !deploymentId) return
    setMessages((previous) => [...previous, { role: 'user', text: request }])
    setText('')
    setWorking(true)
    try {
      const result = await designDeploymentApp(deploymentId, request, settings)
      onApply(result.config)
      setMessages((previous) => [...previous, { role: 'assistant', text: `${result.reply} Review it in the preview, then save.` }])
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        { role: 'assistant', text: error instanceof Error ? error.message : 'The design assistant could not finish.', failed: true },
      ])
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {!deploymentId ? (
          <p className="text-[12px] text-muted-foreground">Deploy the workflow again to design its app with the assistant.</p>
        ) : messages.length === 0 ? (
          <div className="space-y-2.5">
            <p className="text-[12px] text-muted-foreground">Describe how the app should look or work, and the assistant changes it.</p>
            <div className="flex flex-col gap-1.5">
              {DESIGN_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => void send(idea)}
                  className="flex items-center gap-1.5 rounded-[3px] border border-border px-2.5 py-1.5 text-left text-[11.5px] text-foreground hover:bg-foreground/[0.03]"
                >
                  <Sparkles className="h-3 w-3 shrink-0 text-primary" /> {idea}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <p
              key={index}
              className={cn(
                'rounded-[6px] px-2.5 py-1.5 text-[12px] leading-5',
                message.role === 'user' ? 'ml-6 bg-primary/[0.08] text-foreground' : 'mr-6 bg-muted text-muted-foreground',
                message.failed && 'text-destructive',
              )}
            >
              {message.text}
            </p>
          ))
        )}
        {working ? (
          <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Designing…
          </p>
        ) : null}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-1.5 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send(text)
        }}
      >
        <Textarea
          rows={2}
          value={text}
          disabled={!deploymentId}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send(text)
            }
          }}
          placeholder="Ask for a design change…"
          className="min-h-0 resize-none text-[12px]"
        />
        <Button type="submit" size="sm" className="h-8 w-8 shrink-0 p-0" disabled={!text.trim() || working || !deploymentId} aria-label="Send">
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  )
}
