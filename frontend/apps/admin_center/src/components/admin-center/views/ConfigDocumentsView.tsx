import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import {
  createDocument,
  deleteDocument,
  errorMessage,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentCollection,
  type DocumentSummary,
} from '@/api/config'
import { ApplicationGate } from '@/components/admin-center/ApplicationGate'
import { JsonEditor, parseJsonObject } from '@/components/admin-center/JsonEditor'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useApplication } from '@/hooks/use-application'
import { cn } from '@/utils/cn'
import { formatWhen } from '@/utils/format'

/** Saved copies of a JSON document (the orch config or the orchestration template); one is active. */
export function ConfigDocumentsView({
  title,
  singular,
  description,
  collection,
}: {
  title: string
  singular: string
  description: string
  collection: DocumentCollection
}) {
  const { current } = useApplication()
  const aiIntegrationId = current?.ai_integration_id ?? ''

  const [items, setItems] = useState<DocumentSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [active, setActive] = useState(false)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState({ name: '', active: false, text: '' })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const open = useCallback(
    async (id: string) => {
      const row = await getDocument(collection, id, aiIntegrationId)
      const body = JSON.stringify(row.document, null, 2)
      setSelectedId(row.id)
      setName(row.name)
      setActive(row.is_active)
      setText(body)
      setSaved({ name: row.name, active: row.is_active, text: body })
    },
    [collection, aiIntegrationId],
  )

  const refresh = useCallback(
    async (selectId?: string) => {
      const rows = await listDocuments(collection, aiIntegrationId)
      setItems(rows)
      const next = selectId || rows.find((row) => row.is_active)?.id || rows[0]?.id || ''
      if (next) await open(next)
      else {
        setSelectedId('')
        setName('')
        setActive(false)
        setText('')
        setSaved({ name: '', active: false, text: '' })
      }
    },
    [collection, aiIntegrationId, open],
  )

  useEffect(() => {
    if (!aiIntegrationId) return
    setError('')
    setSavedAt(null)
    setLoading(true)
    refresh()
      .catch((reason: unknown) => setError(errorMessage(reason, 'Could not load documents.')))
      .finally(() => setLoading(false))
  }, [aiIntegrationId, refresh])

  const parsed = useMemo(() => parseJsonObject(text), [text])
  const dirty =
    selectedId !== '' &&
    (name !== saved.name ||
      active !== saved.active ||
      !parsed.value ||
      JSON.stringify(parsed.value) !== JSON.stringify(parseJsonObject(saved.text).value))

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (reason) {
      setError(errorMessage(reason, fallback))
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      if (!parsed.value || !selectedId) return
      const row = await updateDocument(collection, selectedId, aiIntegrationId, {
        name: name.trim() || 'Untitled',
        document: parsed.value,
        is_active: active,
      })
      await refresh(row.id)
      setSavedAt(Date.now())
    }, `Could not save the ${singular}.`)

  const createNew = () =>
    run(async () => {
      const row = await createDocument(collection, aiIntegrationId, {
        name: `New ${singular}`,
        document: {},
        is_active: false,
      })
      await refresh(row.id)
    }, `Could not create the ${singular}.`)

  const remove = () => {
    if (!selectedId || !window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    void run(async () => {
      await deleteDocument(collection, selectedId, aiIntegrationId)
      await refresh()
    }, `Could not delete the ${singular}.`)
  }

  const select = (id: string) => {
    if (id === selectedId) return
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setSavedAt(null)
    void run(() => open(id), `Could not open the ${singular}.`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title={title}
        description={description}
        actions={
          current && (
            <>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]" onClick={createNew} disabled={busy}>
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
              {selectedId && (
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
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[11.5px] font-semibold"
                onClick={() => void save()}
                disabled={busy || !selectedId || !parsed.value || !dirty}
              >
                <Save className="h-3.5 w-3.5" />
                Save changes
              </Button>
            </>
          )
        }
      />
      <PageBody>
        <ApplicationGate>
          {error && (
            <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
              {error}
            </p>
          )}
          {loading ? (
            <PremiumCard>
              <EmptyHint title="Loading…" hint={`Fetching saved ${title.toLowerCase()} documents.`} className="m-4 border-0 bg-transparent" />
            </PremiumCard>
          ) : items.length === 0 ? (
            <PremiumCard>
              <EmptyHint
                title={`No saved ${singular} yet`}
                hint={`Use New to create the first ${singular} for this application.`}
                className="m-4 border-0 bg-transparent"
              />
            </PremiumCard>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <PremiumCard className="h-fit">
                <p className="border-b border-border/60 px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Saved copies · {items.length}
                </p>
                <ul className="max-h-[60vh] overflow-y-auto p-1.5">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => select(item.id)}
                        className={cn(
                          'flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors',
                          item.id === selectedId ? 'bg-foreground/10' : 'hover:bg-muted',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[12px]',
                              item.id === selectedId ? 'font-semibold text-foreground dark:text-foreground' : 'text-foreground',
                            )}
                          >
                            {item.name}
                          </span>
                          {item.is_active && <StatusBadge label="Active" tone="success" />}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground">Updated {formatWhen(item.updated_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </PremiumCard>

              <div className="flex min-w-0 flex-col gap-4">
                <PremiumCard className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="doc-name" className="text-xs">
                      Name
                    </Label>
                    <Input id="doc-name" value={name} onChange={(event) => setName(event.target.value)} className="h-9 text-sm" />
                  </div>
                  <label className="flex h-9 items-center gap-2 text-[12px] text-foreground">
                    <Switch checked={active} onCheckedChange={setActive} aria-label="Active" />
                    Active
                  </label>
                </PremiumCard>
                <PremiumCard className="flex min-w-0 flex-col">
                  <JsonEditor
                    value={text}
                    onChange={setText}
                    parse={parsed}
                    onSave={() => {
                      if (!busy && parsed.value && dirty) void save()
                    }}
                    status={
                      dirty ? (
                        <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
                      ) : savedAt ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
                      ) : null
                    }
                  />
                </PremiumCard>
              </div>
            </div>
          )}
        </ApplicationGate>
      </PageBody>
    </>
  )
}
