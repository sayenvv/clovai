import { memo, useMemo, useState } from 'react'
import { Activity, Gauge, GripVertical, RotateCcw, ScrollText, Telescope } from 'lucide-react'
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
    <div className={cn('flex items-start justify-between gap-6 py-3', disabled && 'opacity-50')}>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p> : null}
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
    <div className={cn('space-y-2 py-3', disabled && 'pointer-events-none opacity-50')}>
      <div>
        <p className="text-[12px] font-medium text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p> : null}
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
    // As the reference's cards: thin border, a grip and a bold title, compact rows
    <section className="rounded-[3px] border border-border bg-card px-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="border-b border-border/70 py-2.5">
        <h3 className="flex items-center gap-1 text-[12px] font-semibold text-foreground">
          <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
          {title}
        </h3>
        {description ? <p className="mt-0.5 pl-3.5 text-[11px] text-muted-foreground">{description}</p> : null}
      </header>
      <div className="divide-y divide-border/70">{children}</div>
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
      {/* Section list in the same style as Settings and the outline panel */}
      <nav
        aria-label="Configuration sections"
        className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-[hsl(var(--chrome))]"
      >
        <section className="border-b border-border/80 px-3.5 pb-3 pt-3">
          <h2 className="text-[13px] font-semibold text-foreground">Configuration</h2>
          <p className="mb-2 mt-0.5 text-[10px] leading-snug text-muted-foreground">How this workflow runs: limits, logging and tracing.</p>
          <ul className="-mx-1.5">
            {sections.map(({ id, title }) => {
              const Icon = SECTION_ICONS[id]
              const active = section === id
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSection(id)
                      document
                        .getElementById(`workflow-config-${id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex h-7 w-full items-center gap-2 rounded-[2px] px-1.5 text-left text-[11px]',
                      active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-foreground/[0.05]',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
        <div className="px-3.5 py-3">
          <button
            type="button"
            onClick={() => resetWorkflowConfiguration(workflowId)}
            className="-mx-1.5 flex h-7 items-center gap-2 rounded-[2px] px-1.5 text-[11px] text-foreground hover:bg-foreground/[0.05]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-primary" />
            Reset to defaults
          </button>
        </div>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-6 pb-2 pt-4">
          <h1 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-foreground">Configuration</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Run limits, logging, telemetry and checkpointing for this workflow.</p>
        </div>
        {/* Compact fields, as elsewhere in the workspace */}
        <div className="max-w-3xl space-y-3 px-6 pb-8 pt-2 [&_input]:h-8 [&_input]:rounded-[2px] [&_input]:text-[12px] [&_select]:h-8 [&_select]:rounded-[2px] [&_select]:text-[12px] [&_textarea]:rounded-[2px] [&_textarea]:text-[12px] [&_button[role=combobox]]:h-8 [&_button[role=combobox]]:rounded-[2px] [&_button[role=combobox]]:text-[12px]">
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
