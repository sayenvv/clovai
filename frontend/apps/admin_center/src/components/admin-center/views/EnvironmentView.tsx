import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { asRecord, errorMessage, loadActiveConfig, saveConfigSection, type AdminDocument } from '@/api/config'
import { ApplicationGate } from '@/components/admin-center/ApplicationGate'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApplication } from '@/hooks/use-application'

type Variable = { name: string; value: string }

const SECTION = 'environment'

/** The config's ``environment`` as table rows, in name order. */
function rowsOf(config: AdminDocument): Variable[] {
  return Object.entries(asRecord(asRecord(config.document)[SECTION]))
    .map(([name, value]) => ({ name, value: typeof value === 'string' ? value : JSON.stringify(value) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Configuration → Environment: the active configuration's ``environment``, one row per variable.
 * The template reads each as ``${NAME}``; a blank value or ``${NAME}`` falls back to the server's environment.
 */
export function EnvironmentView() {
  const { current } = useApplication()
  const aiIntegrationId = current?.ai_integration_id ?? ''

  const [config, setConfig] = useState<AdminDocument | null>(null)
  const [variables, setVariables] = useState<Variable[]>([])
  const [saved, setSaved] = useState<Variable[]>([])
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const show = (rows: Variable[]) => {
    setVariables(rows)
    setSaved(rows)
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
        show(rowsOf(document))
      })
      .catch((reason: unknown) => {
        if (!live) return
        setConfig(null)
        setError(errorMessage(reason, 'Could not load the environment.'))
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [aiIntegrationId])

  const dirty = JSON.stringify(variables) !== JSON.stringify(saved)

  const add = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const key = name.trim()
    if (!key) {
      setError('Enter a variable name.')
      return
    }
    if (variables.some((item) => item.name.trim() === key)) {
      setError(`${key} is already listed.`)
      return
    }
    setVariables([...variables, { name: key, value: value.trim() || `\${${key}}` }])
    setName('')
    setValue('')
  }

  const update = (index: number, patch: Partial<Variable>) =>
    setVariables(variables.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))

  const save = async () => {
    if (!aiIntegrationId || !config) return
    setError('')
    const seen = new Set<string>()
    for (const item of variables) {
      const key = item.name.trim()
      if (!key) {
        setError('Every variable needs a name.')
        return
      }
      if (seen.has(key)) {
        setError(`${key} is listed more than once.`)
        return
      }
      seen.add(key)
    }
    setBusy(true)
    try {
      const environment = Object.fromEntries(variables.map((item) => [item.name.trim(), item.value]))
      const savedConfig = await saveConfigSection(config, SECTION, environment)
      setConfig(savedConfig)
      show(rowsOf(savedConfig))
      setSavedAt(Date.now())
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save the environment.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Environment"
        description="Environment variables for this application. The template reads each as ${NAME}; a blank value uses the server's own environment."
        actions={
          current && (
            <>
              {dirty ? (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">Unsaved changes</span>
              ) : savedAt ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Saved</span>
              ) : null}
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[11.5px] font-semibold"
                onClick={() => void save()}
                disabled={busy || loading || !dirty || !config}
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
          <PremiumCard>
            <form onSubmit={add} className="flex flex-col gap-2 border-b border-border/60 p-3 sm:flex-row">
              <Input
                aria-label="Variable name"
                placeholder="NAME"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-8 font-mono text-[12px] sm:w-56"
              />
              <Input
                aria-label="Variable value"
                placeholder={name.trim() ? `\${${name.trim()}}` : 'Value (defaults to ${NAME})'}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-8 flex-1 font-mono text-[12px]"
              />
              <Button type="submit" size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </form>
            {loading ? (
              <EmptyHint title="Loading…" hint="Fetching variables." className="m-4 border-0 bg-transparent" />
            ) : variables.length === 0 ? (
              <EmptyHint
                title="No variables yet"
                hint="Add a name above, then save."
                className="m-4 border-0 bg-transparent"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="w-[34%] px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Value</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((item, index) => (
                      <tr key={index} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-1.5">
                          <Input
                            aria-label={`Name ${index + 1}`}
                            value={item.name}
                            onChange={(event) => update(index, { name: event.target.value })}
                            className="h-8 font-mono text-[12px]"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            aria-label={`Value ${index + 1}`}
                            value={item.value}
                            onChange={(event) => update(index, { value: event.target.value })}
                            className="h-8 font-mono text-[12px]"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setVariables(variables.filter((_, itemIndex) => itemIndex !== index))}
                            aria-label={`Remove ${item.name || `variable ${index + 1}`}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PremiumCard>
        </ApplicationGate>
      </PageBody>
    </>
  )
}
