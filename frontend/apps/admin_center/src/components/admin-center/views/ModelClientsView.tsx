import { useEffect, useState, type FormEvent } from 'react'
import { Braces, KeyRound, Pencil, Plus, Save, Star, Trash2, X } from 'lucide-react'
import {
  createModelClient,
  deleteModelClient,
  setDefaultModelClient,
  errorMessage,
  listModelClients,
  listVariables,
  updateModelClient,
  type ApplicationVariable,
  type ModelClient,
  type ModelClientInput,
  type ModelProvider,
} from '@/api/config'
import { ApplicationGate } from '@/components/admin-center/ApplicationGate'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApplication } from '@/hooks/use-application'
import { cn } from '@/utils/cn'

const PROVIDERS: Array<{ value: ModelProvider; label: string; endpoint: string }> = [
  { value: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
  { value: 'azure-openai', label: 'Azure OpenAI', endpoint: 'https://<resource>.openai.azure.com' },
  { value: 'anthropic', label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1' },
  { value: 'gemini', label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  { value: 'mistral', label: 'Mistral AI', endpoint: 'https://api.mistral.ai/v1' },
  { value: 'groq', label: 'Groq', endpoint: 'https://api.groq.com/openai/v1' },
  { value: 'ollama', label: 'Ollama (local)', endpoint: 'http://localhost:11434' },
  { value: 'openai-compatible', label: 'OpenAI-compatible', endpoint: 'https://my-gateway.example.com/v1' },
]

const SELECT_CLASS =
  'h-8 w-full rounded-[2px] border border-input bg-transparent px-2 text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

type Source = 'value' | 'variable'

interface Draft {
  name: string
  providerType: ModelProvider
  model: string
  apiVersion: string
  endpointSource: Source
  endpoint: string
  endpointVariable: string
  keySource: Source
  apiKey: string
  apiKeyVariable: string
}

const EMPTY: Draft = {
  name: '',
  providerType: 'openai',
  model: '',
  apiVersion: '',
  endpointSource: 'value',
  endpoint: '',
  endpointVariable: '',
  keySource: 'variable',
  apiKey: '',
  apiKeyVariable: '',
}

function draftOf(client: ModelClient): Draft {
  return {
    name: client.name,
    providerType: client.providerType,
    model: client.model,
    apiVersion: client.apiVersion ?? '',
    endpointSource: client.endpointVariable ? 'variable' : 'value',
    endpoint: client.endpoint,
    endpointVariable: client.endpointVariable ?? '',
    keySource: client.apiKeyVariable || !client.hasApiKey ? 'variable' : 'value',
    apiKey: '',
    apiKeyVariable: client.apiKeyVariable ?? '',
  }
}

function inputOf(draft: Draft): ModelClientInput {
  const keyFromVariable = draft.keySource === 'variable'
  const endpointFromVariable = draft.endpointSource === 'variable'
  return {
    name: draft.name.trim(),
    providerType: draft.providerType,
    model: draft.model.trim(),
    apiVersion: draft.providerType === 'azure-openai' ? draft.apiVersion.trim() || null : null,
    endpoint: endpointFromVariable ? '' : draft.endpoint.trim(),
    endpointVariable: endpointFromVariable ? draft.endpointVariable || null : null,
    apiKeyVariable: keyFromVariable ? draft.apiKeyVariable || null : null,
    apiKey: keyFromVariable ? '' : draft.apiKey,
  }
}

/**
 * Configuration → Model clients: the models this application offers every user. A client's API
 * key and endpoint come from the application's variables (Environment) or are entered here; a
 * pasted key is stored encrypted and never shown again. Users see these next to their own.
 */
export function ModelClientsView() {
  const { current } = useApplication()
  const aiIntegrationId = current?.ai_integration_id ?? ''

  const [clients, setClients] = useState<ModelClient[]>([])
  const [variables, setVariables] = useState<ApplicationVariable[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // null: the form is closed; '' : adding; an id: editing that client.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)

  useEffect(() => {
    if (!aiIntegrationId) return
    let live = true
    setError('')
    setLoading(true)
    Promise.all([listModelClients(aiIntegrationId), listVariables(aiIntegrationId)])
      .then(([loadedClients, loadedVariables]) => {
        if (!live) return
        setClients(loadedClients)
        setVariables(loadedVariables)
      })
      .catch((reason: unknown) => live && setError(errorMessage(reason, 'Could not load the model clients.')))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [aiIntegrationId])

  const set = (patch: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...patch }))
  const provider = PROVIDERS.find((item) => item.value === draft.providerType) ?? PROVIDERS[0]
  const editingClient = clients.find((client) => client.id === editing)
  const needsKey = draft.providerType !== 'ollama'

  const open = (client: ModelClient | null) => {
    setError('')
    setEditing(client ? client.id : '')
    setDraft(client ? draftOf(client) : EMPTY)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!aiIntegrationId || editing === null) return
    setError('')
    if (!draft.name.trim() || !draft.model.trim()) {
      setError('Enter a name and a model.')
      return
    }
    if (draft.endpointSource === 'variable' && !draft.endpointVariable) {
      setError('Choose the variable that holds the endpoint.')
      return
    }
    if (needsKey && draft.keySource === 'variable' && !draft.apiKeyVariable) {
      setError('Choose the variable that holds the API key.')
      return
    }
    if (needsKey && draft.keySource === 'value' && !draft.apiKey && !editingClient?.hasApiKey) {
      setError('Enter the API key.')
      return
    }
    setBusy(true)
    try {
      const input = inputOf(draft)
      const saved = editing
        ? await updateModelClient(aiIntegrationId, editing, input)
        : await createModelClient(aiIntegrationId, input)
      setClients((previous) =>
        editing ? previous.map((client) => (client.id === saved.id ? saved : client)) : [...previous, saved],
      )
      setEditing(null)
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save the model client.'))
    } finally {
      setBusy(false)
    }
  }

  const makeDefault = async (client: ModelClient) => {
    if (!aiIntegrationId) return
    setError('')
    try {
      await setDefaultModelClient(aiIntegrationId, client.id)
      setClients((previous) => previous.map((item) => ({ ...item, isDefault: item.id === client.id })))
    } catch (reason) {
      setError(errorMessage(reason, 'Could not set the default model.'))
    }
  }

  const remove = async (client: ModelClient) => {
    if (!aiIntegrationId || !window.confirm(`Delete the model client “${client.name}”? Agents using it will stop working.`)) return
    setError('')
    try {
      await deleteModelClient(aiIntegrationId, client.id)
      setClients((previous) => previous.filter((item) => item.id !== client.id))
      if (editing === client.id) setEditing(null)
    } catch (reason) {
      setError(errorMessage(reason, 'Could not delete the model client.'))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Model clients"
        description="Models this application offers every user. Keys and endpoints can come from Environment variables; a pasted key is stored encrypted and never shown again."
        actions={
          current && editing === null ? (
            <Button size="sm" className="h-8 gap-1.5 text-[11.5px] font-semibold" onClick={() => open(null)}>
              <Plus className="h-3.5 w-3.5" />
              Add model client
            </Button>
          ) : null
        }
      />
      <PageBody>
        <ApplicationGate>
          {error && (
            <p className="mb-3 rounded-[2px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
              {error}
            </p>
          )}

          {editing !== null ? (
            <PremiumCard className="mb-4">
              <form onSubmit={(event) => void submit(event)} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-foreground">
                    {editing ? `Edit ${editingClient?.name ?? 'model client'}` : 'New model client'}
                  </p>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)} aria-label="Close">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Labeled label="Name">
                    <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} placeholder="Company GPT-4.1" className="h-8 text-[12px]" />
                  </Labeled>
                  <Labeled label="Provider">
                    <select value={draft.providerType} onChange={(event) => set({ providerType: event.target.value as ModelProvider })} className={SELECT_CLASS}>
                      {PROVIDERS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                  <Labeled label={draft.providerType === 'azure-openai' ? 'Deployment name' : 'Model'}>
                    <Input value={draft.model} onChange={(event) => set({ model: event.target.value })} placeholder="gpt-4.1" className="h-8 font-mono text-[12px]" />
                  </Labeled>
                  {draft.providerType === 'azure-openai' ? (
                    <Labeled label="API version">
                      <Input value={draft.apiVersion} onChange={(event) => set({ apiVersion: event.target.value })} placeholder="2024-10-21" className="h-8 font-mono text-[12px]" />
                    </Labeled>
                  ) : null}
                </div>

                <SourceField
                  label="Endpoint"
                  source={draft.endpointSource}
                  onSource={(endpointSource) => set({ endpointSource })}
                  valueLabel="Enter URL"
                  variables={variables}
                  variable={draft.endpointVariable}
                  onVariable={(endpointVariable) => set({ endpointVariable })}
                  hint={draft.endpointSource === 'value' ? 'Leave empty for the provider’s public API.' : undefined}
                >
                  <Input type="url" value={draft.endpoint} onChange={(event) => set({ endpoint: event.target.value })} placeholder={provider.endpoint} className="h-8 font-mono text-[12px]" />
                </SourceField>

                {needsKey ? (
                  <SourceField
                    label="API key"
                    source={draft.keySource}
                    onSource={(keySource) => set({ keySource })}
                    valueLabel="Paste key"
                    variables={variables}
                    variable={draft.apiKeyVariable}
                    onVariable={(apiKeyVariable) => set({ apiKeyVariable })}
                    hint={
                      draft.keySource === 'value'
                        ? editingClient?.hasApiKey && !editingClient.apiKeyVariable
                          ? 'A key is saved. Leave empty to keep it.'
                          : 'Stored encrypted; never shown again.'
                        : 'Read from the variable when an agent runs. Mark it Secret on the Environment page.'
                    }
                  >
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={draft.apiKey}
                      onChange={(event) => set({ apiKey: event.target.value })}
                      placeholder={editingClient?.hasApiKey ? '••••••••••••' : 'sk-…'}
                      className="h-8 font-mono text-[12px]"
                    />
                  </SourceField>
                ) : null}

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" size="sm" variant="ghost" className="h-8 text-[11.5px]" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="h-8 gap-1.5 text-[11.5px] font-semibold" disabled={busy}>
                    <Save className="h-3.5 w-3.5" />
                    {editing ? 'Save changes' : 'Add model client'}
                  </Button>
                </div>
              </form>
            </PremiumCard>
          ) : null}

          <PremiumCard>
            {loading ? (
              <EmptyHint title="Loading…" hint="Fetching model clients." className="m-4 border-0 bg-transparent" />
            ) : clients.length === 0 ? (
              <EmptyHint
                title="No model clients yet"
                hint="Add one to offer a model to every user of this application."
                className="m-4 border-0 bg-transparent"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Provider · model</th>
                      <th className="px-3 py-2 font-semibold">Endpoint</th>
                      <th className="px-3 py-2 font-semibold">API key</th>
                      <th className="w-20 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {client.name}
                          {client.isDefault ? (
                            <span className="ml-2 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              Default
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {PROVIDERS.find((item) => item.value === client.providerType)?.label ?? client.providerType}
                          <span className="font-mono"> · {client.model}</span>
                        </td>
                        <td className="max-w-[16rem] truncate px-3 py-2 font-mono text-[11px] text-muted-foreground">
                          {client.endpointVariable ? <VariableTag name={client.endpointVariable} /> : client.endpoint || 'Public API'}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-muted-foreground">
                          {client.apiKeyVariable ? (
                            <VariableTag name={client.apiKeyVariable} />
                          ) : client.hasApiKey ? (
                            <span className="inline-flex items-center gap-1">
                              <KeyRound className="h-3 w-3" /> Stored encrypted
                            </span>
                          ) : (
                            'None'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={cn('h-7 w-7', client.isDefault ? 'text-amber-500' : 'text-muted-foreground')}
                              onClick={() => void makeDefault(client)}
                              disabled={client.isDefault}
                              aria-label={client.isDefault ? `${client.name} is the default model` : `Make ${client.name} the default model`}
                              title={client.isDefault ? 'Default model: the AI assistant and workflows without a model run on it' : 'Make this the default model'}
                            >
                              <Star className={cn('h-3.5 w-3.5', client.isDefault && 'fill-current')} />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => open(client)} aria-label={`Edit ${client.name}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => void remove(client)} aria-label={`Delete ${client.name}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

function VariableTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono">
      <Braces className="h-3 w-3" />
      {name}
    </span>
  )
}

/** A value entered here, or the name of an Environment variable that holds it. */
function SourceField({
  label,
  source,
  onSource,
  valueLabel,
  variables,
  variable,
  onVariable,
  hint,
  children,
}: {
  label: string
  source: Source
  onSource: (source: Source) => void
  valueLabel: string
  variables: ApplicationVariable[]
  variable: string
  onVariable: (name: string) => void
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="inline-flex rounded-[2px] border border-border/70 bg-muted/40 p-0.5" role="group" aria-label={`${label} source`}>
          {(
            [
              ['variable', 'From variable'],
              ['value', valueLabel],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => onSource(value)}
              aria-pressed={source === value}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                source === value ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      {source === 'variable' ? (
        <select value={variable} onChange={(event) => onVariable(event.target.value)} className={cn(SELECT_CLASS, 'font-mono')}>
          <option value="">{variables.length ? 'Choose a variable' : 'No variables yet — add one on the Environment page'}</option>
          {variables.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
              {item.type === 'secret' ? ' (secret)' : ''}
            </option>
          ))}
        </select>
      ) : (
        children
      )}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
