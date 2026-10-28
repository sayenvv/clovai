import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw, Save, Send, Trash2 } from 'lucide-react'
import {
  SpecError,
  discardSpecDraft,
  getDefaultSpec,
  getSpecOverview,
  getSpecVersion,
  publishSpecDraft,
  saveSpecDraft,
  validateSpec,
  type SpecIssue,
  type SpecOverview,
} from '@/api/workflow-generation-spec'
import { JsonEditor, parseJsonObject } from '@/components/admin-center/JsonEditor'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/utils/cn'
import { formatWhen } from '@/utils/format'

const pretty = (document: unknown) => JSON.stringify(document ?? {}, null, 2)

/**
 * The rules the canvas follows to generate workflow format 4.0 JSON. Admins edit a draft and
 * publish it; every canvas picks up the published version within a minute, with no deploy.
 */
export function WorkflowGenerationSpecView() {
  const [overview, setOverview] = useState<SpecOverview | null>(null)
  /** `null` edits the draft; a number shows that published version read-only. */
  const [viewing, setViewing] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [note, setNote] = useState('')
  const [issues, setIssues] = useState<SpecIssue[]>([])
  const [valid, setValid] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const next = await getSpecOverview()
    setOverview(next)
    setViewing(null)
    const start = pretty(next.draft?.document ?? next.published.document)
    setText(start)
    setSavedText(next.draft ? start : '')
    setNote(next.draft?.note ?? '')
    setIssues([])
    setValid(false)
  }, [])

  useEffect(() => {
    load()
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load the spec.'))
      .finally(() => setLoading(false))
  }, [load])

  const parsed = useMemo(() => parseJsonObject(text), [text])
  const readOnly = viewing !== null
  const hasDraft = Boolean(overview?.draft)
  const dirty = !readOnly && text !== savedText

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (reason) {
      if (reason instanceof SpecError && reason.issues.length) setIssues(reason.issues)
      setError(reason instanceof Error ? reason.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  const confirmLeave = () => !dirty || window.confirm('Discard unsaved changes to the draft?')

  const validate = () =>
    run(async () => {
      if (!parsed.value) return
      const result = await validateSpec(parsed.value)
      setIssues(result.errors)
      setValid(result.valid)
      if (result.valid) setMessage('The spec is valid.')
    }, 'Could not validate the spec.')

  const save = () =>
    run(async () => {
      if (!parsed.value) return
      await saveSpecDraft(parsed.value, note)
      const next = await getSpecOverview()
      setOverview(next)
      setSavedText(text)
      setIssues([])
      setValid(true)
      setMessage('Draft saved.')
    }, 'Could not save the draft.')

  const publish = () => {
    const nextVersion = (overview?.versions[0]?.version ?? 0) + 1
    if (!window.confirm(`Publish the draft as version ${nextVersion}? Every canvas uses it within a minute.`)) return
    void run(async () => {
      const published = await publishSpecDraft()
      await load()
      setMessage(`Published version ${published.version}.`)
    }, 'Could not publish the draft.')
  }

  const discard = () => {
    if (!window.confirm('Delete the draft? The published version stays in use.')) return
    void run(async () => {
      await discardSpecDraft()
      await load()
      setMessage('Draft deleted.')
    }, 'Could not delete the draft.')
  }

  const startFrom = (label: string, fetchDocument: () => Promise<Record<string, unknown> | undefined>) => {
    if (!confirmLeave()) return
    void run(async () => {
      const document = await fetchDocument()
      setViewing(null)
      setText(pretty(document))
      setIssues([])
      setValid(false)
      setMessage(`Loaded ${label} into the editor. Save it as the draft to keep it.`)
    }, `Could not load ${label}.`)
  }

  const showVersion = (version: number) => {
    if (!confirmLeave()) return
    void run(async () => {
      const row = await getSpecVersion(version)
      setViewing(version)
      setText(pretty(row.document))
      setIssues([])
    }, `Could not open version ${version}.`)
  }

  const backToDraft = () => {
    setViewing(null)
    void run(load, 'Could not load the draft.')
  }

  const inUse = overview?.published

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Workflow generation"
        description="The rules the canvas follows to turn blocks and connectors into workflow JSON (format 4.0). Publish a change and every canvas uses it within a minute."
        actions={
          !readOnly && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-[11.5px]"
                onClick={() => void validate()}
                disabled={busy || !parsed.value}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Validate
              </Button>
              {hasDraft && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-[11.5px] text-destructive hover:text-destructive"
                  onClick={discard}
                  disabled={busy}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete draft
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-[11.5px]"
                onClick={() => void save()}
                disabled={busy || !parsed.value || (!dirty && hasDraft && note === (overview?.draft?.note ?? ''))}
              >
                <Save className="h-3.5 w-3.5" />
                Save draft
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[11.5px] font-semibold"
                onClick={publish}
                disabled={busy || !hasDraft || dirty}
                title={dirty ? 'Save the draft first' : hasDraft ? undefined : 'Save a draft first'}
              >
                <Send className="h-3.5 w-3.5" />
                Publish
              </Button>
            </>
          )
        }
      />
      <PageBody>
        {error && (
          <div className="mb-3 rounded-[2px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
            <p>{error}</p>
            {issues.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {issues.map((issue) => (
                  <li key={`${issue.path}:${issue.message}`}>
                    <code className="font-mono">{issue.path || '(root)'}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!error && issues.length > 0 && (
          <div className="mb-3 rounded-[2px] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-300">
            <p>The spec is not valid:</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {issues.map((issue) => (
                <li key={`${issue.path}:${issue.message}`}>
                  <code className="font-mono">{issue.path || '(root)'}</code>: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {message && (
          <p className="mb-3 rounded-[2px] border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11.5px] text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        )}
        {loading ? (
          <PremiumCard>
            <EmptyHint title="Loading…" hint="Fetching the workflow generation spec." className="m-4 border-0 bg-transparent" />
          </PremiumCard>
        ) : !overview ? null : (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="flex h-fit flex-col gap-4">
              <PremiumCard className="space-y-1 p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">In use</p>
                <p className="text-[13px] font-semibold text-foreground">
                  {inUse?.version ? `Version ${inUse.version}` : 'Built-in default'}
                </p>
                {inUse?.publishedAt && (
                  <p className="text-[10.5px] text-muted-foreground">
                    Published {formatWhen(inUse.publishedAt)}
                    {inUse.updatedBy ? ` by ${inUse.updatedBy}` : ''}
                  </p>
                )}
              </PremiumCard>

              <PremiumCard>
                <p className="border-b border-border/60 px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Edit
                </p>
                <div className="space-y-1 p-1.5">
                  <button
                    type="button"
                    onClick={backToDraft}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-[2px] px-2.5 py-2 text-left text-[12px] transition-colors',
                      !readOnly ? 'bg-foreground/10 font-semibold' : 'hover:bg-muted',
                    )}
                  >
                    Draft
                    {hasDraft ? <StatusBadge label="Saved" tone="warning" /> : <StatusBadge label="None" tone="neutral" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startFrom('the built-in default', async () => (await getDefaultSpec()).document)}
                    className="flex w-full items-center gap-1.5 rounded-[2px] px-2.5 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    disabled={busy}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Start from the built-in default
                  </button>
                </div>
              </PremiumCard>

              <PremiumCard>
                <p className="border-b border-border/60 px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Published versions · {overview.versions.length}
                </p>
                {overview.versions.length === 0 ? (
                  <p className="px-3.5 py-3 text-[11px] text-muted-foreground">None yet: the canvas uses the built-in default.</p>
                ) : (
                  <ul className="max-h-[40vh] overflow-y-auto p-1.5">
                    {overview.versions.map((item) => (
                      <li key={item.version}>
                        <button
                          type="button"
                          onClick={() => showVersion(item.version!)}
                          className={cn(
                            'flex w-full flex-col gap-0.5 rounded-[2px] px-2.5 py-2 text-left transition-colors',
                            viewing === item.version ? 'bg-foreground/10' : 'hover:bg-muted',
                          )}
                        >
                          <span className="flex items-center gap-1.5 text-[12px] text-foreground">
                            Version {item.version}
                            {item.version === inUse?.version && <StatusBadge label="In use" tone="success" />}
                          </span>
                          {item.note && <span className="truncate text-[10.5px] text-foreground/80">{item.note}</span>}
                          {item.publishedAt && (
                            <span className="text-[10.5px] text-muted-foreground">{formatWhen(item.publishedAt)}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </PremiumCard>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              {readOnly ? (
                <PremiumCard className="flex items-center justify-between gap-3 p-3.5">
                  <p className="text-[12px] text-foreground">Version {viewing} (read only)</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11.5px]"
                    onClick={() => startFrom(`version ${viewing}`, async () => parsed.value)}
                  >
                    Use as draft
                  </Button>
                </PremiumCard>
              ) : (
                <PremiumCard className="space-y-1.5 p-4">
                  <Label htmlFor="spec-note" className="text-xs">
                    What changed
                  </Label>
                  <Input
                    id="spec-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="For example: harness on for all agents"
                    className="h-9 text-sm"
                  />
                </PremiumCard>
              )}
              <PremiumCard className="flex min-w-0 flex-col">
                <JsonEditor
                  value={text}
                  onChange={(next) => {
                    setText(next)
                    setValid(false)
                  }}
                  parse={parsed}
                  readOnly={readOnly}
                  onSave={() => {
                    if (!busy && parsed.value && !readOnly) void save()
                  }}
                  status={
                    readOnly ? null : dirty ? (
                      <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
                    ) : valid ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Valid</span>
                    ) : null
                  }
                />
              </PremiumCard>
            </div>
          </div>
        )}
      </PageBody>
    </>
  )
}
