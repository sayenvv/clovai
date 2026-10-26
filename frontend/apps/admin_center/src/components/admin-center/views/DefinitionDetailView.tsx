import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, ExternalLink, Bot } from 'lucide-react'
import {
  createDefinition,
  deleteDefinition,
  getDefinition,
  saveDefinition,
  setWorkflowPurpose,
  type DefinitionDetail,
  type DefinitionKind,
} from '@/api/definitions'
import { DEFINITION_KINDS } from '@/components/admin-center/definition-kinds'
import { JsonEditor, parseJsonObject } from '@/components/admin-center/JsonEditor'
import { WorkflowCanvasView } from '@/components/admin-center/WorkflowCanvasView'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { Button } from '@/components/ui/button'
import { ROUTES, canvasUrl } from '@/constants'
import { formatWhen } from '@/utils/format'

const NEW = 'new'

/** View and edit one definition's JSON. The route id ``new`` starts from the kind's template. */
export function DefinitionDetailView({ kind }: { kind: DefinitionKind }) {
  const config = DEFINITION_KINDS[kind]
  const { id = NEW } = useParams()
  const navigate = useNavigate()
  // Set by "Upload JSON" on the list page: the file's JSON to start the new definition from
  const uploaded = (useLocation().state ?? null) as { definition?: Record<string, unknown>; fileName?: string } | null
  const isNew = id === NEW

  const [item, setItem] = useState<DefinitionDetail | null>(null)
  const [text, setText] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    setItem(null)
    setLoadError('')
    setSaveError('')
    setSavedAt(null)
    if (isNew) {
      setText(JSON.stringify(uploaded?.definition ?? config.template, null, 2))
      return
    }
    getDefinition(kind, id)
      .then((found) => {
        setItem(found)
        setText(JSON.stringify(found.definition, null, 2))
      })
      .catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : String(reason)))
  }, [kind, id, isNew, config.template, uploaded])

  const parsed = useMemo(() => parseJsonObject(text), [text])
  // Workflows can be looked at as their canvas, drawn from the JSON being edited
  const [view, setView] = useState<'canvas' | 'json'>(kind === 'workflows' && !isNew ? 'canvas' : 'json')

  // Compare values, not text, so Format or Minify alone doesn't count as a change.
  const dirty =
    isNew || (item !== null && (!parsed.value || JSON.stringify(parsed.value) !== JSON.stringify(item.definition)))

  const save = async () => {
    if (!parsed.value) return
    setBusy(true)
    setSaveError('')
    try {
      const saved = isNew ? await createDefinition(kind, parsed.value) : await saveDefinition(kind, id, parsed.value)
      setItem(saved)
      setText(JSON.stringify(saved.definition, null, 2))
      setSavedAt(Date.now())
      if (isNew) navigate(ROUTES.definition(kind, saved.id), { replace: true })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const isAssistant = item?.purpose === 'ai_assistant'
  const changePurpose = async () => {
    if (!item) return
    const next = isAssistant ? 'user_build' : 'ai_assistant'
    const question = isAssistant
      ? 'Stop using this workflow as the AI assistant? The chat will have no assistant until another one is set.'
      : 'Use this workflow as the AI assistant for everyone? The current assistant is replaced.'
    if (!window.confirm(question)) return
    setBusy(true)
    setSaveError('')
    try {
      setItem(await setWorkflowPurpose(item.id, next))
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (isNew || !window.confirm(`Delete this ${config.singular}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await deleteDefinition(kind, id)
      navigate(`/${kind}`)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
      setBusy(false)
    }
  }

  const title = isNew ? `New ${config.singular}` : item?.name || (loadError ? 'Not found' : 'Loading…')

  return (
    <>
      <PageHeader
        eyebrow={config.label}
        title={title}
        description={
          isNew
            ? uploaded?.fileName
              ? `From ${uploaded.fileName}. Check the JSON below, then create the ${config.singular}.`
              : `Edit the JSON below, then create the ${config.singular}.`
            : item?.description || undefined
        }
        actions={
          <>
            <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 text-[11.5px]">
              <Link to={`/${kind}`}>
                <ArrowLeft className="h-3.5 w-3.5" />
                {config.label}
              </Link>
            </Button>
            {!isNew && item && kind === 'workflows' && (
              <Button
                size="sm"
                variant="outline"
                className={isAssistant ? 'h-8 gap-1.5 text-[11.5px]' : 'h-8 gap-1.5 text-[11.5px] text-emerald-700 dark:text-emerald-300'}
                onClick={() => void changePurpose()}
                disabled={busy}
              >
                <Bot className="h-3.5 w-3.5" />
                {isAssistant ? 'Remove as AI assistant' : 'Set as AI assistant'}
              </Button>
            )}
            {!isNew && item && kind === 'workflows' && (
              <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]">
                <a href={canvasUrl(item.id)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in canvas
                </a>
              </Button>
            )}
            {!isNew && item && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-[11.5px] text-destructive hover:text-destructive"
                onClick={remove}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
            {(isNew || item) && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[11.5px] font-semibold"
                onClick={save}
                disabled={busy || !parsed.value || !dirty}
              >
                <Save className="h-3.5 w-3.5" />
                {isNew ? `Create ${config.singular}` : 'Save changes'}
              </Button>
            )}
          </>
        }
      />
      <PageBody>
        {loadError ? (
          <PremiumCard>
            <EmptyHint title={`Couldn't load this ${config.singular}`} hint={loadError} className="m-4 border-0 bg-transparent" />
          </PremiumCard>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <PremiumCard className="flex min-w-0 flex-col">
              {kind === 'workflows' ? (
                <div className="flex items-center gap-1 border-b border-border/60 p-2" role="tablist" aria-label="View">
                  {(['canvas', 'json'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="tab"
                      aria-selected={view === option}
                      onClick={() => setView(option)}
                      className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                        view === option ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {option === 'canvas' ? 'Canvas' : 'JSON'}
                    </button>
                  ))}
                  {view === 'canvas' ? (
                    <span className="ml-auto text-[11px] text-muted-foreground">Read-only; edit in JSON or open in canvas</span>
                  ) : null}
                </div>
              ) : null}
              {kind === 'workflows' && view === 'canvas' ? (
                <div className="p-3">
                  {parsed.value ? (
                    <WorkflowCanvasView workflow={parsed.value} />
                  ) : (
                    <p className="text-[12px] text-destructive">The JSON has an error; fix it in the JSON view to see the canvas.</p>
                  )}
                </div>
              ) : (
              <JsonEditor
                value={text}
                onChange={setText}
                parse={parsed}
                onSave={() => {
                  if (!busy && parsed.value && dirty) void save()
                }}
                status={
                  savedAt && !dirty ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
                  ) : dirty && !isNew ? (
                    <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
                  ) : null
                }
              />
              )}
              {saveError && (
                <p className="border-t border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
                  {saveError}
                </p>
              )}
            </PremiumCard>

            <PremiumCard className="h-fit p-3.5">
              <dl className="space-y-2.5 text-[11.5px]">
                <Detail label="Owner">
                  {isNew || item?.workflowType === 'system_generated' ? (
                    <StatusBadge label="Admin" tone="info" />
                  ) : (
                    <span className="break-all">{item?.userId}</span>
                  )}
                </Detail>
                {item?.purpose && <Detail label="Purpose"><span className="capitalize">{item.purpose.replace('_', ' ')}</span></Detail>}
                {item?.workspaceId && <Detail label="Workspace" mono>{item.workspaceId}</Detail>}
                {item?.tabId && <Detail label="Tab" mono>{item.tabId}</Detail>}
                <Detail label="Id" mono>{isNew ? 'Assigned on create' : id}</Detail>
                {item?.updatedAt && <Detail label="Updated">{formatWhen(item.updatedAt)}</Detail>}
                {item?.createdAt && <Detail label="Created">{formatWhen(item.createdAt)}</Detail>}
              </dl>
              {!isNew && (
                <p className="mt-3 border-t border-border/60 pt-3 text-[10.5px] leading-4 text-muted-foreground">
                  Other definitions refer to this one by its id, so the id can't be changed here.
                </p>
              )}
            </PremiumCard>
          </div>
        )}
      </PageBody>
    </>
  )
}

function Detail({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={mono ? 'mt-0.5 break-all font-mono text-[11px] text-foreground' : 'mt-0.5 text-foreground'}>
        {children}
      </dd>
    </div>
  )
}
