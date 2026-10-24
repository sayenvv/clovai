import { memo, useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { OLLAMA_DEFAULT_URL, isLocalModel } from '@/components/agent-workflow/workflow-model-config'
import { fetchOllamaModels, type LocalModel } from '@/services/models-api'
import { ModelLogo, providerFromHints } from '@/components/agent-workflow/model-providers'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

interface WorkflowModelConfigPanelProps {
  modelConfig: WorkflowModelConfig
  /** Model the server `.env` provides, shown when the workflow uses it. */
  serverModelConfig?: WorkflowModelConfig
  onChange?: (patch: Partial<WorkflowModelConfig>) => void
  readOnly?: boolean
  configured?: boolean
}

type Source = 'server' | 'ollama'

export const WorkflowModelConfigPanel = memo(function WorkflowModelConfigPanel({
  modelConfig,
  serverModelConfig,
  onChange,
  readOnly = false,
  configured = false,
}: WorkflowModelConfigPanelProps) {
  const editable = !readOnly && Boolean(onChange)
  const local = isLocalModel(modelConfig)
  const source: Source = local ? 'ollama' : 'server'
  const samplingDisabled = !editable || !local
  const shown = local ? modelConfig : (serverModelConfig ?? modelConfig)

  const chooseSource = (next: Source) => {
    if (next === source) return
    if (next === 'ollama') {
      onChange?.({ provider: 'ollama', baseUrl: modelConfig.baseUrl || OLLAMA_DEFAULT_URL, model: '' })
    } else {
      onChange?.({ provider: serverModelConfig?.provider ?? 'openai', model: serverModelConfig?.model ?? modelConfig.model })
    }
  }

  return (
    <div className="space-y-5">
      <PanelSection title="Provider">
        <Field label="Model source">
          <Select
            value={source}
            disabled={!editable}
            onChange={(event) => chooseSource(event.target.value as Source)}
          >
            <option value="server">Server default (.env)</option>
            <option value="ollama">Ollama (local)</option>
          </Select>
        </Field>

        <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-2">
          <ModelLogo hints={[shown.provider, shown.model]} className="h-7 w-7" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {providerFromHints(shown.provider, shown.model)?.label ?? (shown.provider || 'Model provider')}
            </p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{shown.model || 'No model selected'}</p>
          </div>
        </div>

        {local ? (
          <OllamaFields modelConfig={modelConfig} editable={editable} onChange={onChange} />
        ) : (
          <>
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3">
              <p className="text-xs font-medium text-foreground">Server-managed configuration</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Agents use the backend <code className="text-[10px]">.env</code> model settings
                (<code className="text-[10px]">OPENAI_MODEL</code>,{' '}
                <code className="text-[10px]">OPENAI_BASE_URL</code>,{' '}
                <code className="text-[10px]">OPENAI_API_KEY</code>).
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Status: {configured ? 'ready' : 'not configured — template fallbacks may apply'}
              </p>
            </div>
            <Field label="Model name">
              <Input value={shown.model} disabled className="font-mono text-xs" />
            </Field>
          </>
        )}
      </PanelSection>

      <PanelSection title="Sampling">
        {!local && (
          <p className="text-[11px] text-muted-foreground">
            Sampling follows the server defaults. Switch to a local model to tune it here.
          </p>
        )}
        <Field label="Temperature" hint="0 = deterministic, 2 = creative">
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            disabled={samplingDisabled}
            value={shown.temperature}
            onChange={(event) => onChange?.({ temperature: Number(event.target.value) })}
          />
        </Field>
        <Field label="Top P">
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            disabled={samplingDisabled}
            value={shown.topP}
            onChange={(event) => onChange?.({ topP: Number(event.target.value) })}
          />
        </Field>
        <Field label="Max tokens">
          <Input
            type="number"
            min={1}
            max={128000}
            step={1}
            disabled={samplingDisabled}
            value={shown.maxTokens}
            onChange={(event) => onChange?.({ maxTokens: Number(event.target.value) })}
          />
        </Field>
        <Field label="Presence penalty">
          <Input
            type="number"
            min={-2}
            max={2}
            step={0.1}
            disabled={samplingDisabled}
            value={shown.presencePenalty}
            onChange={(event) => onChange?.({ presencePenalty: Number(event.target.value) })}
          />
        </Field>
        <Field label="Frequency penalty">
          <Input
            type="number"
            min={-2}
            max={2}
            step={0.1}
            disabled={samplingDisabled}
            value={shown.frequencyPenalty}
            onChange={(event) => onChange?.({ frequencyPenalty: Number(event.target.value) })}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Advanced">
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm">Fixed seed</span>
          <Switch
            checked={shown.seed !== null}
            disabled={samplingDisabled}
            onCheckedChange={(checked) => onChange?.({ seed: checked ? 42 : null })}
          />
        </div>
        {shown.seed !== null && (
          <Field label="Seed">
            <Input
              type="number"
              disabled={samplingDisabled}
              value={shown.seed}
              onChange={(event) => onChange?.({ seed: Number(event.target.value) })}
            />
          </Field>
        )}
      </PanelSection>
    </div>
  )
})

function formatSize(bytes?: number | null): string {
  if (!bytes) return ''
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function OllamaFields({
  modelConfig,
  editable,
  onChange,
}: {
  modelConfig: WorkflowModelConfig
  editable: boolean
  onChange?: (patch: Partial<WorkflowModelConfig>) => void
}) {
  const baseUrl = modelConfig.baseUrl || OLLAMA_DEFAULT_URL
  const [models, setModels] = useState<LocalModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    (url: string) => {
      setLoading(true)
      setError(null)
      fetchOllamaModels(url)
        .then((found) => {
          setModels(found)
          if (found.length > 0 && !found.some((item) => item.name === modelConfig.model)) {
            onChange?.({ model: found[0].name })
          }
        })
        .catch((reason: unknown) => {
          setModels([])
          setError(reason instanceof Error ? reason.message : 'Could not reach Ollama.')
        })
        .finally(() => setLoading(false))
    },
    [modelConfig.model, onChange],
  )

  useEffect(() => {
    load(baseUrl)
    // Reload when the server URL changes, not on every model pick.
  }, [baseUrl])

  return (
    <>
      <Field label="Ollama server URL" hint="Reached from the API server, so localhost is that machine">
        <div className="flex gap-1.5">
          <Input
            value={modelConfig.baseUrl ?? ''}
            disabled={!editable}
            placeholder={OLLAMA_DEFAULT_URL}
            onChange={(event) => onChange?.({ baseUrl: event.target.value })}
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            disabled={loading}
            onClick={() => load(baseUrl)}
            aria-label="Refresh models"
            title="Refresh models"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          </Button>
        </div>
      </Field>

      <div className="flex items-center gap-1.5 text-[11px]">
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Connecting to Ollama…</span>
          </>
        ) : error ? (
          <>
            <XCircle className="h-3 w-3 shrink-0 text-foreground" />
            <span className="text-red-700 dark:text-red-400">{error}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span className="text-muted-foreground">
              Connected · {models.length} model{models.length === 1 ? '' : 's'} installed
            </span>
          </>
        )}
      </div>

      <Field label="Model" hint={models.length === 0 ? 'Pull one with `ollama pull llama3.2`' : undefined}>
        {models.length > 0 ? (
          <Select
            value={modelConfig.model}
            disabled={!editable}
            onChange={(event) => onChange?.({ model: event.target.value })}
          >
            {models.map((item) => (
              <option key={item.name} value={item.name}>
                {[item.name, item.parameterSize, formatSize(item.size)].filter(Boolean).join(' · ')}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={modelConfig.model}
            disabled={!editable}
            placeholder="llama3.2:latest"
            onChange={(event) => onChange?.({ model: event.target.value })}
            className="font-mono text-xs"
          />
        )}
      </Field>
    </>
  )
}
