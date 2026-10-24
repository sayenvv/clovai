import { memo, useEffect, useState } from 'react'
import { Braces, CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/components/agent-workflow/FormField'
import { useVariables } from '@/components/agent-workflow/hooks/use-variables'
import { cn } from '@/utils/cn'
import {
  testModelConnection,
  type ModelConnection,
  type ModelConnectionInput,
  type ModelConnectionProvider,
  type ModelConnectionTestResult,
} from '@/services/model-connections-api'

export const CONNECTION_PROVIDERS: Array<{ value: ModelConnectionProvider; label: string; endpoint: string }> = [
  { value: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
  { value: 'azure-openai', label: 'Azure OpenAI', endpoint: 'https://<resource>.openai.azure.com' },
  { value: 'anthropic', label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1' },
  { value: 'gemini', label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { value: 'mistral', label: 'Mistral AI', endpoint: 'https://api.mistral.ai/v1' },
  { value: 'groq', label: 'Groq', endpoint: 'https://api.groq.com/openai/v1' },
  { value: 'ollama', label: 'Ollama (local)', endpoint: 'http://localhost:11434' },
  { value: 'openai-compatible', label: 'OpenAI-compatible (any)', endpoint: 'https://my-gateway.example.com/v1' },
]

const EMPTY: ModelConnectionInput = {
  name: '',
  providerType: 'openai',
  endpoint: '',
  model: '',
  apiVersion: null,
  apiKey: '',
  apiKeyVariable: null,
  scope: 'user',
}

/** Add or edit a saved model connection. The key is sent once and never shown again. */
export const ModelConnectionDialog = memo(function ModelConnectionDialog({
  open,
  onOpenChange,
  connection,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The connection being edited; none to add one. */
  connection?: ModelConnection | null
  onSave: (input: ModelConnectionInput, id?: string) => Promise<ModelConnection>
}) {
  const [form, setForm] = useState<ModelConnectionInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<ModelConnectionTestResult | null>(null)
  const editing = Boolean(connection)
  const provider = CONNECTION_PROVIDERS.find((item) => item.value === form.providerType) ?? CONNECTION_PROVIDERS[0]
  const needsKey = form.providerType !== 'ollama'
  const { variables, status: variablesStatus } = useVariables()
  const [keySource, setKeySource] = useState<'paste' | 'variable'>('paste')
  const fromVariable = needsKey && keySource === 'variable'

  useEffect(() => {
    if (!open) return
    setTest(null)
    setKeySource(connection?.apiKeyVariable ? 'variable' : 'paste')
    setForm(
      connection
        ? {
            name: connection.name,
            providerType: connection.providerType,
            endpoint: connection.endpoint,
            model: connection.model,
            apiVersion: connection.apiVersion ?? null,
            apiKey: '',
            apiKeyVariable: connection.apiKeyVariable ?? null,
            scope: connection.scope,
          }
        : EMPTY,
    )
  }, [open, connection])

  const set = (patch: Partial<ModelConnectionInput>) => {
    setForm((previous) => ({ ...previous, ...patch }))
    setTest(null)
  }
  const missing =
    !form.name.trim() || !form.model.trim() ||
    (fromVariable ? !form.apiKeyVariable : needsKey && !(editing && connection?.hasApiKey) && !form.apiKey?.trim()) ||
    (form.providerType === 'azure-openai' && !form.endpoint.trim())

  // Only the chosen key source is sent.
  const payload = (): ModelConnectionInput => ({
    ...form,
    apiVersion: form.providerType === 'azure-openai' ? form.apiVersion || null : null,
    apiKey: fromVariable ? '' : form.apiKey,
    apiKeyVariable: fromVariable ? form.apiKeyVariable : null,
  })

  const runTest = async () => {
    setTesting(true)
    try {
      setTest(
        await testModelConnection(
          editing && !fromVariable && !form.apiKey?.trim() && connection ? { id: connection.id } : payload(),
        ),
      )
    } catch (reason) {
      setTest({ ok: false, message: reason instanceof Error ? reason.message : 'Test failed.' })
    } finally {
      setTesting(false)
    }
  }

  const submit = async () => {
    setSaving(true)
    try {
      await onSave(payload(), connection?.id)
      toast.success(editing ? 'Connection updated' : 'Connection saved')
      onOpenChange(false)
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit model connection' : 'Add your own model'}</DialogTitle>
          <DialogDescription>
            Saved on the server; the API key is stored encrypted and never shown again or put in workflow JSON.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <Field label="Name">
            <Input value={form.name} onChange={(event) => set({ name: event.target.value })} placeholder="Team GPT-4.1" />
          </Field>
          <Field label="Provider">
            <Select
              value={form.providerType}
              onChange={(event) => set({ providerType: event.target.value as ModelConnectionProvider })}
            >
              {CONNECTION_PROVIDERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Endpoint"
            hint={form.providerType === 'azure-openai' ? 'Your Azure OpenAI resource URL' : 'Leave empty for the provider’s public API'}
          >
            <Input
              type="url"
              value={form.endpoint}
              onChange={(event) => set({ endpoint: event.target.value })}
              placeholder={provider.endpoint}
            />
          </Field>
          <Field label={form.providerType === 'azure-openai' ? 'Deployment name' : 'Model'}>
            <Input
              value={form.model}
              onChange={(event) => set({ model: event.target.value })}
              placeholder={form.providerType === 'azure-openai' ? 'gpt-4-1-prod' : 'gpt-4.1'}
              className="font-mono text-xs"
            />
          </Field>
          {form.providerType === 'azure-openai' ? (
            <Field label="API version">
              <Input
                value={form.apiVersion ?? ''}
                onChange={(event) => set({ apiVersion: event.target.value })}
                placeholder="2024-10-21"
                className="font-mono text-xs"
              />
            </Field>
          ) : null}
          {needsKey ? (
            <Field
              label="API key"
              hint={
                fromVariable
                  ? 'Resolved on the server when the agent runs.'
                  : editing && connection?.hasApiKey
                    ? 'A key is saved. Leave empty to keep it.'
                    : 'Sent once, stored encrypted.'
              }
            >
              <div className="mb-1.5 inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5" role="group" aria-label="Key source">
                {(
                  [
                    ['paste', 'Paste key', KeyRound],
                    ['variable', 'From variable', Braces],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setKeySource(value)
                      setTest(null)
                    }}
                    aria-pressed={keySource === value}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                      keySource === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-3" />
                    {label}
                  </button>
                ))}
              </div>
              {fromVariable ? (
                variablesStatus === 'unavailable' ? (
                  <p className="text-[11.5px] text-muted-foreground">Environment variables aren’t available on this server yet.</p>
                ) : (
                  <Select
                    value={form.apiKeyVariable ?? ''}
                    onChange={(event) => set({ apiKeyVariable: event.target.value || null })}
                    className="font-mono text-xs"
                  >
                    <option value="">
                      {variablesStatus === 'loading' ? 'Loading variables…' : variables.length ? 'Choose a variable' : 'No variables yet — add one in Dashboard → Variables'}
                    </option>
                    {variables.map((variable) => (
                      <option key={variable.id} value={variable.name}>
                        {variable.name}
                      </option>
                    ))}
                  </Select>
                )
              ) : (
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.apiKey ?? ''}
                  onChange={(event) => set({ apiKey: event.target.value })}
                  placeholder={editing && connection?.hasApiKey ? '••••••••••••' : 'sk-…'}
                  className="pl-8 font-mono text-xs"
                />
              </div>
              )}
            </Field>
          ) : null}
          <Field label="Visible to">
            <Select value={form.scope} onChange={(event) => set({ scope: event.target.value as ModelConnectionInput['scope'] })}>
              <option value="user">Only me</option>
              <option value="workspace">Everyone in this workspace</option>
            </Select>
          </Field>

          {test ? (
            <p
              className={
                test.ok
                  ? 'flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400'
                  : 'flex items-start gap-1.5 text-xs text-destructive'
              }
            >
              {test.ok ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <XCircle className="mt-px size-3.5 shrink-0" />}
              {test.message}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" disabled={testing || missing} onClick={() => void runTest()}>
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Test connection
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || missing} onClick={() => void submit()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Save connection'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
