import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Check, Copy, FileCode2, FolderCode, Loader2, Play, RefreshCw, Square } from 'lucide-react'
import { toast } from 'sonner'
import { BuilderChat } from '@/components/agent-workflow/BuilderChat'
import { usePersistedHorizontalPanel } from '@/components/agent-workflow/hooks/use-workflow-editor-panels'
import { BuilderPane, BuilderStage, PaneTabs } from '@/components/agent-workflow/integrations/BuilderPane'
import { FileTree } from '@/components/agent-workflow/integrations/FileTree'
import { APP_BUILDER_CHAT_PANEL, APP_BUILDER_FILES_PANEL } from '@/components/agent-workflow/panel-layout'
import { OLLAMA_DEFAULT_URL } from '@/components/agent-workflow/workflow-model-config'
import { useServerLlmConfig } from '@/hooks/use-server-llm-config'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import {
  fetchBuilderFile,
  fetchBuilderPreview,
  fetchBuilderProject,
  fetchLatestBuilderProject,
  startBuilderPreview,
  stopBuilderPreview,
  type BuilderPreview,
  type BuilderProject,
} from '@/services/workflow-assistant-api'
import { cn } from '@/utils/cn'

const storageKey = (deploymentId: string | undefined) => `builder-project:${deploymentId ?? 'none'}`

// Storage can be unavailable (private windows, blocked site data): the project is then remembered for this visit only
function readProject(deploymentId: string | undefined): string | undefined {
  try {
    return localStorage.getItem(storageKey(deploymentId)) ?? undefined
  } catch {
    return undefined
  }
}

function rememberProject(deploymentId: string | undefined, projectId: string) {
  try {
    localStorage.setItem(storageKey(deploymentId), projectId)
  } catch {
    // ignore
  }
}

type Pane = 'files' | 'code' | 'chat'

/**
 * The App Builder's code mode: the Builder assistant writes a real app (React + Vite) into a project, and its files
 * are listed and readable here after every turn. The project is remembered per deployment in this browser.
 * Files and chat are resizable side panes on a wide screen and tabs on a narrow one.
 */
export function CodeAppWorkspace({
  deploymentId,
  isDesktop,
  onProjectId,
}: {
  deploymentId?: string
  isDesktop: boolean
  /** The project this workspace shows, for the builder to publish. */
  onProjectId?: (projectId: string) => void
}) {
  const { modelConfig, configured } = useServerLlmConfig()
  const [model, setModel] = useState<GenerateWorkflowModel>({ provider: 'server' })
  const [projectId, setProjectId] = useState<string | undefined>(() => readProject(deploymentId))
  const [project, setProject] = useState<BuilderProject | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [tab, setTab] = useState<Pane>('chat')
  const [view, setView] = useState<'code' | 'preview'>('code')
  const [preview, setPreview] = useState<BuilderPreview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const filesPane = usePersistedHorizontalPanel(APP_BUILDER_FILES_PANEL, false)
  const chatPane = usePersistedHorizontalPanel(APP_BUILDER_CHAT_PANEL, true)

  const reload = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    if (projectId) onProjectId?.(projectId)
  }, [projectId, onProjectId])

  // Nothing remembered for this deployment yet: show the user's newest project if they have one
  useEffect(() => {
    if (projectId) return
    let cancelled = false
    fetchLatestBuilderProject()
      .then((id) => {
        if (cancelled || !id) return
        rememberProject(deploymentId, id)
        setProjectId(id)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [projectId, deploymentId])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    fetchBuilderProject(projectId)
      .then((loaded) => {
        if (cancelled) return
        setProject(loaded)
        setError(null)
        setSelected((current) => (current && loaded.files.includes(current) ? current : (loaded.files.find((file) => file === 'src/App.jsx' || file === 'src/App.tsx') ?? loaded.files[0] ?? null)))
      })
      .catch((failure: unknown) => !cancelled && setError(failure instanceof Error ? failure.message : 'Could not load the project.'))
    return () => {
      cancelled = true
    }
  }, [projectId, tick])

  useEffect(() => {
    if (!projectId || !selected) {
      setContent('')
      return
    }
    let cancelled = false
    fetchBuilderFile(projectId, selected)
      .then((text) => !cancelled && setContent(text))
      .catch((failure: unknown) => !cancelled && setContent(failure instanceof Error ? `// ${failure.message}` : ''))
    return () => {
      cancelled = true
    }
  }, [projectId, selected, tick])

  // The dev server outlives this page, so ask whether the app is already running
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    fetchBuilderPreview(projectId)
      .then((current) => !cancelled && setPreview(current))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [projectId])

  const runPreview = async (action: typeof startBuilderPreview) => {
    if (!projectId) return
    setPreviewBusy(true)
    try {
      const next = await action(projectId)
      setPreview(next)
      if (next.running) setView('preview')
      else setView('code')
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Could not change the preview.')
    } finally {
      setPreviewBusy(false)
    }
  }

  const onProjectChange = (id: string) => {
    rememberProject(deploymentId, id)
    setProjectId(id)
  }

  const open = (file: string) => {
    setSelected(file)
    if (!isDesktop) setTab('code')
  }

  const reloadButton = (
    <button
      type="button"
      aria-label="Reload files"
      title="Reload files"
      onClick={reload}
      className="flex h-7 w-7 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
    >
      <RefreshCw className="h-3.5 w-3.5" />
    </button>
  )
  const files = <FileList project={project} projectId={projectId} selected={selected} error={error} onOpen={open} />
  const code = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-2 text-[11.5px] text-muted-foreground">
        <div className="flex rounded-[3px] border border-border p-0.5" role="group" aria-label="Code or preview">
          {(['code', 'preview'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={cn('h-6 rounded-[2px] px-2 capitalize', view === value && 'bg-foreground/[0.08] text-foreground')}
            >
              {value}
            </button>
          ))}
        </div>
        <span className="min-w-0 flex-1 truncate">{preview?.running ? preview.url : 'App not running'}</span>
        {preview?.running ? (
          <button type="button" disabled={previewBusy} onClick={() => void runPreview(stopBuilderPreview)} className="flex h-6 items-center gap-1 rounded-[3px] border border-border px-2 hover:text-foreground disabled:opacity-50">
            <Square className="h-3 w-3" /> Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={previewBusy || !projectId || preview?.available === false}
            title={preview?.available === false ? 'Previews need BUILDER_RUNNER=docker on the server' : 'Run the app in a container'}
            onClick={() => void runPreview(startBuilderPreview)}
            className="flex h-6 items-center gap-1 rounded-[3px] bg-primary px-2 text-primary-foreground disabled:opacity-50"
          >
            {previewBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Run app
          </button>
        )}
      </div>
      {view === 'preview' ? (
        preview?.running && preview.url ? (
          <iframe key={preview.url} src={preview.url} title="App preview" className="min-h-0 flex-1 border-0 bg-white" />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-muted-foreground">
            Run the app to see it here. It runs in a container on this machine and stops after 30 minutes.
          </div>
        )
      ) : (
        <CodeView path={selected} content={content} />
      )}
    </div>
  )
  const chat = (
    <BuilderChat
      model={model}
      onModelChange={setModel}
      serverModel={modelConfig.model}
      llmConfigured={configured}
      ollamaBaseUrl={OLLAMA_DEFAULT_URL}
      initialProjectId={projectId}
      initialDeploymentId={deploymentId}
      onProjectChange={onProjectChange}
      onTurnDone={reload}
      hideProjectPanel
      chatScope={`app-builder:${deploymentId ?? 'none'}`}
    />
  )

  // One tree for every screen size: panes become tabs on a narrow screen, so the chat is never remounted
  const stacked = !isDesktop
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {stacked ? (
        <PaneTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'files', label: 'Files', icon: <FolderCode />, badge: Boolean(project?.changed?.length) && tab !== 'files' },
            { id: 'code', label: 'Code', icon: <FileCode2 /> },
            { id: 'chat', label: 'Assistant', icon: <Bot /> },
          ]}
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
        <BuilderPane
          side="left"
          title="Explorer"
          icon={<FolderCode />}
          panel={filesPane}
          actions={reloadButton}
          maxShare={0.3}
          stacked={stacked}
          active={tab === 'files'}
        >
          {files}
        </BuilderPane>
        <BuilderStage hidden={stacked && tab !== 'code'}>{code}</BuilderStage>
        <BuilderPane side="right" title="Builder assistant" icon={<Bot />} panel={chatPane} maxShare={0.5} stacked={stacked} active={tab === 'chat'}>
          {chat}
        </BuilderPane>
      </div>
    </div>
  )
}

function FileList({
  project,
  projectId,
  selected,
  error,
  onOpen,
}: {
  project: BuilderProject | null
  projectId?: string
  selected: string | null
  error: string | null
  onOpen: (file: string) => void
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {project ? <FileTree files={project.files} changed={project.changed} selected={selected} onOpen={onOpen} /> : null}
        {!project && !error ? (
          <p className="px-3 py-2 text-[12px] text-muted-foreground">{projectId ? 'Loading…' : 'No files yet. Ask the assistant to build the app.'}</p>
        ) : null}
        {error ? <p className="px-3 py-2 text-[12px] text-destructive">{error}</p> : null}
      </div>
      {project?.scripts?.length ? (
        <p className="truncate border-t border-border px-3 py-2 text-[10.5px] text-muted-foreground" title={project.scripts.join(', ')}>
          scripts: {project.scripts.join(', ')}
        </p>
      ) : null}
    </>
  )
}

/** The selected file, read-only, with line numbers and a copy button. */
function CodeView({ path, content }: { path: string | null; content: string }) {
  const [copied, setCopied] = useState(false)
  const lines = useMemo(() => content.split('\n'), [content])

  const copy = () => {
    void navigator.clipboard.writeText(content).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => toast.error('Could not copy the file'),
    )
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-stretch border-b border-border bg-card pr-2">
        {path ? (
          <div className="flex min-w-0 max-w-[60%] items-center gap-1.5 border-r border-border bg-background px-3 text-[12px] text-foreground shadow-[inset_0_2px_0_hsl(var(--primary))]">
            <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{path.split('/').pop()}</span>
          </div>
        ) : null}
        <p className="flex min-w-0 flex-1 items-center gap-1 truncate px-3 text-[11.5px] text-muted-foreground" title={path ?? undefined}>
          {path ? path.split('/').map((part, index, parts) => (
            <span key={index} className={cn('truncate', index === parts.length - 1 && 'text-foreground/80')}>
              {index > 0 ? <span className="px-1 text-muted-foreground/60">›</span> : null}
              {part}
            </span>
          )) : 'Select a file'}
        </p>
        {path && content ? (
          <button
            type="button"
            onClick={copy}
            aria-label="Copy file"
            title="Copy file"
            className="flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-[3px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>
      {path ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <pre className="grid min-w-max grid-cols-[auto_1fr] py-2 font-mono text-[12px] leading-[1.7] text-foreground">
            {lines.map((line, index) => (
              <code key={index} className="contents">
                <span className="select-none pl-3 pr-4 text-right text-muted-foreground/60">{index + 1}</span>
                <span className="pr-6">{line || ' '}</span>
              </code>
            ))}
          </pre>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[12px] text-muted-foreground">
          Pick a file to read it. The assistant writes and changes the files; ask it in the chat.
        </div>
      )}
    </section>
  )
}
