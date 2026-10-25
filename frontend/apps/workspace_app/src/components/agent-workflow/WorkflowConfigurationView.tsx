import { memo, useMemo, useState } from 'react'
import { Activity, Gauge, RotateCcw, ScrollText, Telescope } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  resetWorkflowConfiguration,
  updateWorkflowConfiguration,
  useWorkflowConfiguration,
  type LogLevel,
  type TraceExporter,
  type WorkflowConfiguration,
} from '@/services/workflow-configuration-store'

import type { ToolDesigner } from '@/types/config'

type ConfigurationSettings = NonNullable<ToolDesigner['configuration']>
type SectionId = ConfigurationSettings['sections'][number]['id']

const SECTION_ICONS: Record<SectionId, typeof Activity> = {
  tracing: Activity,
  otel: Telescope,
  logging: ScrollText,
  runtime: Gauge,
}

/** Used when mega-menu.json has no `designer.configuration` block. */
const DEFAULT_SECTIONS: ConfigurationSettings['sections'] = [
  {
    id: 'tracing',
    title: 'Traceability',
    description: 'Record a step-by-step trace of every agent, tool call and handoff.',
    isVisible: true,
    order: 1,
  },
  {
    id: 'otel',
    title: 'OpenTelemetry',
    description: 'Export traces and metrics to an OpenTelemetry collector.',
    isVisible: true,
    order: 2,
  },
  {
    id: 'logging',
    title: 'Logging',
    description: 'How much detail runs write to the console and logs panel.',
    isVisible: true,
    order: 3,
  },
  {
    id: 'runtime',
    title: 'Runtime limits',
    description: 'Guard rails applied to every run of this workflow.',
    isVisible: true,
    order: 4,
  },
]

function SettingRow({
  title,
  description,
  children,
  disabled = false,
}: {
  title: string
  description?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className={cn('flex items-start justify-between gap-6 py-4', disabled && 'opacity-50')}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SettingStack({
  title,
  description,
  children,
  disabled = false,
}: {
  title: string
  description?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className={cn('space-y-2 py-4', disabled && 'pointer-events-none opacity-50')}>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card px-5">
      <header className="border-b border-border/60 py-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </header>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  )
}

/**
 * The "Configuration" tab: settings that apply to the whole workflow at run time, such as
 * traceability, OpenTelemetry export, logging and execution limits. Saved per workflow.
 */
export const WorkflowConfigurationView = memo(function WorkflowConfigurationView({
  workflowId,
  settings,
}: {
  workflowId: string
  /** `designer.configuration` from mega-menu.json: which sections show, and default values. */
  settings?: ConfigurationSettings
}) {
  const config = useWorkflowConfiguration(
    workflowId,
    settings?.defaults as Partial<WorkflowConfiguration> | undefined,
  )
  const sections = useMemo(
    () =>
      (settings?.sections ?? DEFAULT_SECTIONS)
        .filter((item) => item.isVisible)
        .sort((a, b) => a.order - b.order),
    [settings],
  )
  const [section, setSection] = useState<SectionId | undefined>(sections[0]?.id)
  const set = (patch: Partial<WorkflowConfiguration>) => updateWorkflowConfiguration(workflowId, patch)
  const toNumber = (value: string, fallback: number) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const renderSection: Record<
    SectionId,
    (item: ConfigurationSettings['sections'][number]) => React.ReactNode
  > = {
    tracing: (item) => (
      <SectionCard title={item.title} description={item.description}>
        <SettingRow
          title="Enable tracing"
          description="Capture spans for each run so it can be inspected in Executions."
        >
          <Switch
            checked={config.tracingEnabled}
            onCheckedChange={(tracingEnabled) => set({ tracingEnabled })}
          />
        </SettingRow>
        <SettingRow
          title="Capture sensitive data"
          description="Include prompts, model responses and tool arguments in traces."
          disabled={!config.tracingEnabled}
        >
          <Switch
            checked={config.captureSensitiveData}
            disabled={!config.tracingEnabled}
            onCheckedChange={(captureSensitiveData) => set({ captureSensitiveData })}
          />
        </SettingRow>
        <SettingRow
          title="Keep execution history"
          description="Store finished runs so they appear in the Executions tab."
        >
          <Switch
            checked={config.persistExecutionHistory}
            onCheckedChange={(persistExecutionHistory) => set({ persistExecutionHistory })}
          />
        </SettingRow>
      </SectionCard>
    ),
    otel: (item) => (
      <SectionCard title={item.title} description={item.description}>
        <SettingRow
          title="Enable OpenTelemetry"
          description="Send telemetry for this workflow to an OTLP endpoint."
        >
          <Switch
            checked={config.openTelemetryEnabled}
            onCheckedChange={(openTelemetryEnabled) => set({ openTelemetryEnabled })}
          />
        </SettingRow>
        <SettingRow title="Exporter" disabled={!config.openTelemetryEnabled}>
          <Select
            className="w-44"
            value={config.otelExporter}
            disabled={!config.openTelemetryEnabled}
            onChange={(event) => set({ otelExporter: event.target.value as TraceExporter })}
          >
            <option value="otlp-http">OTLP / HTTP</option>
            <option value="otlp-grpc">OTLP / gRPC</option>
            <option value="console">Console</option>
          </Select>
        </SettingRow>
        <SettingStack
          title="Collector endpoint"
          disabled={!config.openTelemetryEnabled || config.otelExporter === 'console'}
        >
          <Input
            value={config.otelEndpoint}
            placeholder="http://localhost:4318"
            onChange={(event) => set({ otelEndpoint: event.target.value })}
          />
        </SettingStack>
        <SettingStack
          title="Service name"
          description="Reported as service.name on every span."
          disabled={!config.openTelemetryEnabled}
        >
          <Input
            value={config.otelServiceName}
            onChange={(event) => set({ otelServiceName: event.target.value })}
          />
        </SettingStack>
        <SettingStack
          title="Headers"
          description="One per line, e.g. Authorization=Bearer <token>."
          disabled={!config.openTelemetryEnabled || config.otelExporter === 'console'}
        >
          <Textarea
            rows={3}
            className="font-mono text-xs"
            value={config.otelHeaders}
            onChange={(event) => set({ otelHeaders: event.target.value })}
          />
        </SettingStack>
        <SettingRow
          title="Sample rate"
          description="Fraction of runs to export (0–1)."
          disabled={!config.openTelemetryEnabled}
        >
          <Input
            type="number"
            min={0}
            max={1}
            step={0.1}
            className="w-24"
            value={config.traceSampleRate}
            disabled={!config.openTelemetryEnabled}
            onChange={(event) =>
              set({
                traceSampleRate: Math.min(
                  1,
                  Math.max(0, toNumber(event.target.value, config.traceSampleRate)),
                ),
              })
            }
          />
        </SettingRow>
        <SettingRow
          title="Export metrics"
          description="Token usage, latency and error counts."
          disabled={!config.openTelemetryEnabled}
        >
          <Switch
            checked={config.metricsEnabled}
            disabled={!config.openTelemetryEnabled}
            onCheckedChange={(metricsEnabled) => set({ metricsEnabled })}
          />
        </SettingRow>
      </SectionCard>
    ),
    logging: (item) => (
      <SectionCard title={item.title} description={item.description}>
        <SettingRow title="Log level">
          <Select
            className="w-36"
            value={config.logLevel}
            onChange={(event) => set({ logLevel: event.target.value as LogLevel })}
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </Select>
        </SettingRow>
      </SectionCard>
    ),
    runtime: (item) => (
      <SectionCard title={item.title} description={item.description}>
        <SettingRow title="Max iterations" description="Stop after this many agent turns.">
          <Input
            type="number"
            min={1}
            className="w-24"
            value={config.maxIterations}
            onChange={(event) =>
              set({
                maxIterations: Math.max(1, toNumber(event.target.value, config.maxIterations)),
              })
            }
          />
        </SettingRow>
        <SettingRow title="Timeout (seconds)" description="Cancel the run when it takes longer than this.">
          <Input
            type="number"
            min={1}
            className="w-24"
            value={config.timeoutSeconds}
            onChange={(event) =>
              set({
                timeoutSeconds: Math.max(1, toNumber(event.target.value, config.timeoutSeconds)),
              })
            }
          />
        </SettingRow>
        <SettingRow title="Retry attempts" description="Retries for a failed agent or tool step.">
          <Input
            type="number"
            min={0}
            className="w-24"
            value={config.retryAttempts}
            onChange={(event) =>
              set({
                retryAttempts: Math.max(0, toNumber(event.target.value, config.retryAttempts)),
              })
            }
          />
        </SettingRow>
        <SettingRow title="Checkpointing" description="Save state between steps so a run can resume.">
          <Switch
            checked={config.checkpointingEnabled}
            onCheckedChange={(checkpointingEnabled) => set({ checkpointingEnabled })}
          />
        </SettingRow>
      </SectionCard>
    ),
  }

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border/60 p-3">
        <h2 className="px-2 pb-2 pt-1 text-sm font-semibold text-foreground">Configuration</h2>
        <nav className="flex flex-col gap-0.5">
          {sections.map(({ id, title }) => {
            const Icon = SECTION_ICONS[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSection(id)
                  document
                    .getElementById(`workflow-config-${id}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  section === id
                    ? 'bg-foreground/[0.07] text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {title}
              </button>
            )
          })}
        </nav>
        <button
          type="button"
          onClick={() => resetWorkflowConfiguration(workflowId)}
          className="mt-auto flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to defaults
        </button>
      </aside>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          {sections.map((item) => (
            <div key={item.id} id={`workflow-config-${item.id}`} className="scroll-mt-6">
              {renderSection[item.id](item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
