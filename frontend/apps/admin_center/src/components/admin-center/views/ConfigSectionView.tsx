import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { asRecord, errorMessage, loadActiveConfig, saveConfigSection, type AdminDocument } from '@/api/config'
import { ApplicationGate } from '@/components/admin-center/ApplicationGate'
import { JsonEditor, parseJsonObject } from '@/components/admin-center/JsonEditor'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { Button } from '@/components/ui/button'
import { useApplication } from '@/hooks/use-application'

const section = 'systemConfig'

/** Configuration → System: the active configuration's ``systemConfig`` as JSON (models, runtime, limits). */
export function ConfigSectionView() {
  const { current: application } = useApplication()
  const aiIntegrationId = application?.ai_integration_id ?? ''

  const [config, setConfig] = useState<AdminDocument | null>(null)
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const show = (body: string) => {
    setText(body)
    setSavedText(body)
  }

  useEffect(() => {
    if (!aiIntegrationId) return
    let live = true
    setError('')
    setSavedAt(null)
    setLoading(true)
    loadActiveConfig(aiIntegrationId)
      .then((document) => {
        if (!live) return
        setConfig(document)
        show(JSON.stringify(asRecord(asRecord(document.document)[section]), null, 2))
      })
      .catch((reason: unknown) => {
        if (!live) return
        setConfig(null)
        show('')
        setError(errorMessage(reason, 'Could not load the configuration.'))
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [aiIntegrationId])

  const parsed = useMemo(() => parseJsonObject(text), [text])
  const dirty = !parsed.value || JSON.stringify(parsed.value) !== JSON.stringify(parseJsonObject(savedText).value)
  const canSave = config !== null

  const save = async () => {
    if (!parsed.value || !aiIntegrationId) return
    setBusy(true)
    setError('')
    try {
      if (config) {
        const saved = await saveConfigSection(config, section, parsed.value)
        setConfig(saved)
        show(JSON.stringify(asRecord(asRecord(saved.document)[section]), null, 2))
      }
      setSavedAt(Date.now())
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save this section.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="System"
        description="Models, runtime, limits and the other application defaults the template reads."
        actions={
          application &&
          canSave && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-[11.5px] font-semibold"
              onClick={() => void save()}
              disabled={busy || loading || !parsed.value || !dirty}
            >
              <Save className="h-3.5 w-3.5" />
              Save changes
            </Button>
          )
        }
      />
      <PageBody>
        <ApplicationGate>
          {error && (
            <p className="mb-3 rounded-[2px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
              {error}
            </p>
          )}
          {loading ? (
            <PremiumCard>
              <EmptyHint title="Loading…" hint="Fetching the configuration." className="m-4 border-0 bg-transparent" />
            </PremiumCard>
          ) : canSave ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
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
              <PremiumCard className="h-fit p-3.5 text-[11.5px]">
                <dl className="space-y-2.5">
                  <Detail label="Application">{application?.name}</Detail>
                  {application?.location && <Detail label="Location">{application.location}</Detail>}
                  <Detail label="Integration id" mono>
                    {aiIntegrationId}
                  </Detail>
                  {config && <Detail label="Saved config">{config.name}</Detail>}
                </dl>
                <p className="mt-3 border-t border-border/60 pt-3 text-[10.5px] leading-4 text-muted-foreground">
                  Saving updates the system section of the active configuration and leaves its environment as it is.
                </p>
              </PremiumCard>
            </div>
          ) : null}
        </ApplicationGate>
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
