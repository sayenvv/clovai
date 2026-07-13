import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

interface WorkflowModelConfigPanelProps {
  modelConfig: WorkflowModelConfig
  onChange?: (patch: Partial<WorkflowModelConfig>) => void
  readOnly?: boolean
  configured?: boolean
}

export const WorkflowModelConfigPanel = memo(function WorkflowModelConfigPanel({
  modelConfig,
  onChange,
  readOnly = false,
  configured = false,
}: WorkflowModelConfigPanelProps) {
  const disabled = readOnly || !onChange

  return (
    <div className="space-y-5">
      {readOnly ? (
        <div className="rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/5 to-rose-500/5 px-3.5 py-3">
          <p className="text-xs font-medium text-foreground">Server-managed configuration</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            All LLM calls use the backend <code className="text-[10px]">.env</code> settings.
            Update model variables there, then restart the API.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Status: {configured ? 'ready' : 'not configured — template fallbacks may apply'}
          </p>
        </div>
      ) : null}

      <PanelSection title="Model">
        <Field label="Model name">
          <Input
            value={modelConfig.model}
            disabled={disabled}
            onChange={(event) => onChange?.({ model: event.target.value })}
            placeholder="model-id"
            className="font-mono text-xs"
          />
        </Field>
      </PanelSection>

      <PanelSection title="Sampling">
        <Field label="Temperature" hint="0 = deterministic, 2 = creative">
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            disabled={disabled}
            value={modelConfig.temperature}
            onChange={(event) => onChange?.({ temperature: Number(event.target.value) })}
          />
        </Field>
        <Field label="Top P">
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            disabled={disabled}
            value={modelConfig.topP}
            onChange={(event) => onChange?.({ topP: Number(event.target.value) })}
          />
        </Field>
        <Field label="Max tokens">
          <Input
            type="number"
            min={1}
            max={128000}
            step={1}
            disabled={disabled}
            value={modelConfig.maxTokens}
            onChange={(event) => onChange?.({ maxTokens: Number(event.target.value) })}
          />
        </Field>
        <Field label="Presence penalty">
          <Input
            type="number"
            min={-2}
            max={2}
            step={0.1}
            disabled={disabled}
            value={modelConfig.presencePenalty}
            onChange={(event) => onChange?.({ presencePenalty: Number(event.target.value) })}
          />
        </Field>
        <Field label="Frequency penalty">
          <Input
            type="number"
            min={-2}
            max={2}
            step={0.1}
            disabled={disabled}
            value={modelConfig.frequencyPenalty}
            onChange={(event) => onChange?.({ frequencyPenalty: Number(event.target.value) })}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Advanced">
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm">Fixed seed</span>
          <Switch
            checked={modelConfig.seed !== null}
            disabled={disabled}
            onCheckedChange={(checked) => onChange?.({ seed: checked ? 42 : null })}
          />
        </div>
        {modelConfig.seed !== null && (
          <Field label="Seed">
            <Input
              type="number"
              disabled={disabled}
              value={modelConfig.seed}
              onChange={(event) => onChange?.({ seed: Number(event.target.value) })}
            />
          </Field>
        )}
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm">Stream response</span>
          <Switch
            checked={modelConfig.stream}
            disabled={disabled}
            onCheckedChange={(stream) => onChange?.({ stream })}
          />
        </div>
      </PanelSection>
    </div>
  )
})
