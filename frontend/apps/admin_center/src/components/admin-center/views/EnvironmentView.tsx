import { useEffect, useState, type FormEvent } from 'react'
import { Lock, Plus, Save, Trash2 } from 'lucide-react'
import {
  asRecord,
  errorMessage,
  listVariables,
  loadActiveConfig,
  replaceVariables,
  type ApplicationVariable,
  type VariableType,
} from '@/api/config'
import { ApplicationGate } from '@/components/admin-center/ApplicationGate'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApplication } from '@/hooks/use-application'
import { cn } from '@/utils/cn'

/** A row on the page. ``hasValue`` is true when the server holds a secret's value. */
type Variable = { name: string; type: VariableType; value: string; hasValue: boolean }

const SELECT_CLASS =
  'h-8 rounded-md border border-input bg-transparent px-2 text-[12px] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

function rowsOf(variables: ApplicationVariable[]): Variable[] {
  return variables.map((item) => ({ name: item.name, type: item.type, value: item.value, hasValue: item.has_value }))
}

/** Variables still kept in the config's ``environment``, offered as manual entries to move into the table. */
async function configEnvironment(aiIntegrationId: string): Promise<Variable[]> {
  try {
    const config = await loadActiveConfig(aiIntegrationId)
    return Object.entries(asRecord(asRecord(config.document).environment))
      .map(([name, value]) => ({
        name,
        type: 'manual' as const,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        hasValue: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

/**
 * Configuration → Environment: the application's variables. A **Manual entry** is stored as
 * typed; a **Secret** is stored encrypted and never shown again (leave it empty to keep it).
 * The template reads each as ``${NAME}``; a blank value uses the server's own environment.
 */
export function EnvironmentView() {
  const { current } = useApplication()
  const aiIntegrationId = current?.ai_integration_id ?? ''

  const [variables, setVariables] = useState<Variable[]>([])
  const [saved, setSaved] = useState<Variable[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<VariableType>('manual')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!aiIntegrationId) return
    let live = true
    setError('')
    setNotice('')
    setSavedAt(null)
    setLoading(true)
    listVariables(aiIntegrationId)
      .then(async (stored) => {
        if (!live) return
        if (stored.length > 0) {
          setVariables(rowsOf(stored))
          setSaved(rowsOf(stored))
          return
        }
        // Nothing in the table yet: offer the config's environment, unsaved, to move it over.
        const fromConfig = await configEnvironment(aiIntegrationId)
        if (!live) return
        setSaved([])
        setVariables(fromConfig)
        if (fromConfig.length > 0) {
          setNotice('These came from the configuration. Mark keys as Secret, then save to store them here.')
        }
      })
      .catch((reason: unknown) => {
        if (!live) return
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
    if (type === 'secret' && !value) {
      setError('Enter the secret value.')
      return
    }
    setVariables([
      ...variables,
      { name: key, type, value: type === 'secret' ? value : value.trim() || `\${${key}}`, hasValue: false },
    ])
    setName('')
    setValue('')
  }

  const update = (index: number, patch: Partial<Variable>) =>
    setVariables(variables.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))

  const save = async () => {
    if (!aiIntegrationId) return
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
      if (item.type === 'secret' && !item.value && !item.hasValue) {
        setError(`Enter a value for the secret ${key}.`)
        return
      }
      seen.add(key)
    }
    setBusy(true)
    try {
      const stored = await replaceVariables(
        aiIntegrationId,
        variables.map((item) => ({ name: item.name.trim(), type: item.type, value: item.value })),
      )
      setVariables(rowsOf(stored))
      setSaved(rowsOf(stored))
      setNotice('')
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
        description="Variables for this application. The template reads each as ${NAME}; a blank value uses the server's own environment. Secrets are stored encrypted and never shown again."
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
                disabled={busy || loading || !dirty}
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
          {notice && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-300">
              {notice}
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
              <select
                aria-label="Variable type"
                value={type}
                onChange={(event) => setType(event.target.value as VariableType)}
                className={cn(SELECT_CLASS, 'sm:w-36')}
              >
                <option value="manual">Manual entry</option>
                <option value="secret">Secret</option>
              </select>
              <Input
                aria-label="Variable value"
                type={type === 'secret' ? 'password' : 'text'}
                autoComplete="new-password"
                placeholder={
                  type === 'secret' ? 'Secret value' : name.trim() ? `\${${name.trim()}}` : 'Value (defaults to ${NAME})'
                }
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
                      <th className="w-[30%] px-3 py-2 font-semibold">Name</th>
                      <th className="w-36 px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Value</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {variables.map((item, index) => {
                      const secret = item.type === 'secret'
                      return (
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
                            <select
                              aria-label={`Type ${index + 1}`}
                              value={item.type}
                              onChange={(event) => update(index, { type: event.target.value as VariableType })}
                              className={cn(SELECT_CLASS, 'w-full')}
                            >
                              <option value="manual">Manual entry</option>
                              <option value="secret">Secret</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="relative">
                              {secret ? (
                                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                              ) : null}
                              <Input
                                aria-label={`Value ${index + 1}`}
                                type={secret ? 'password' : 'text'}
                                autoComplete="new-password"
                                value={item.value}
                                placeholder={secret && item.hasValue ? '•••••••• saved — leave empty to keep' : undefined}
                                onChange={(event) => update(index, { value: event.target.value })}
                                className={cn('h-8 font-mono text-[12px]', secret && 'pl-7')}
                              />
                            </div>
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
                      )
                    })}
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
