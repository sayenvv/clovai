import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import {
  MODEL_PROVIDERS,
  SUGGESTED_MODELS,
} from '@/components/agent-workflow/workflow-model-config'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

interface WorkflowModelConfigPanelProps {
  modelConfig: WorkflowModelConfig
  onChange: (patch: Partial<WorkflowModelConfig>) => void
}

export const WorkflowModelConfigPanel = memo(function WorkflowModelConfigPanel({
  modelConfig,
  onChange,
}: WorkflowModelConfigPanelProps) {
  const suggestions = SUGGESTED_MODELS[modelConfig.provider] ?? []

  return (
    <div className="space-y-5">
      <PanelSection title="Provider & model">
        <Field label="Provider" hint="Used in exported workflow JSON modelConfig">
          <Select
            value={modelConfig.provider}
            onChange={(event) => onChange({ provider: event.target.value })}
          >
            {MODEL_PROVIDERS.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model">
          {suggestions.length > 0 ? (
            <Select
              value={modelConfig.model}
              onChange={(event) => onChange({ model: event.target.value })}
            >
              {suggestions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
              {!suggestions.includes(modelConfig.model) && modelConfig.model ? (
                <option value={modelConfig.model}>{modelConfig.model}</option>
              ) : null}
            </Select>
          ) : (
            <Input
              value={modelConfig.model}
              onChange={(event) => onChange({ model: event.target.value })}
              placeholder="model-id"
            />
          )}
        </Field>
      </PanelSection>

      <PanelSection title="Sampling">
        <Field label="Temperature" hint="0 = deterministic, 2 = creative">
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={modelConfig.temperature}
            onChange={(event) => onChange({ temperature: Number(event.target.value) })}
          />
        </Field>
        <Field label="Top P">
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={modelConfig.topP}
            onChange={(event) => onChange({ topP: Number(event.target.value) })}
          />
        </Field>
        <Field label="Max tokens">
          <Input
            type="number"
            min={1}
            max={128000}
            step={1}
            value={modelConfig.maxTokens}
            onChange={(event) => onChange({ maxTokens: Number(event.target.value) })}
          />
        </Field>
        <Field label="Presence penalty">
          <Input
            type="number"
            min={-2}
            max={2}
            step={0.1}
            value={modelConfig.presencePenalty}
            onChange={(event) => onChange({ presencePenalty: Number(event.target.value) })}
          />
        </Field>
        <Field label="Frequency penalty">
          <Input
            type="number"
            min={-2}
            max={2}
            step={0.1}
            value={modelConfig.frequencyPenalty}
            onChange={(event) => onChange({ frequencyPenalty: Number(event.target.value) })}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Advanced">
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm">Fixed seed</span>
          <Switch
            checked={modelConfig.seed !== null}
            onCheckedChange={(checked) => onChange({ seed: checked ? 42 : null })}
          />
        </div>
        {modelConfig.seed !== null && (
          <Field label="Seed">
            <Input
              type="number"
              value={modelConfig.seed}
              onChange={(event) => onChange({ seed: Number(event.target.value) })}
            />
          </Field>
        )}
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm">Stream response</span>
          <Switch
            checked={modelConfig.stream}
            onCheckedChange={(stream) => onChange({ stream })}
          />
        </div>
      </PanelSection>
    </div>
  )
})
