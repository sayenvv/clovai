import { memo, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { cn } from '@/utils/cn'
import {
  BUILDER_SPECS,
  builderFields,
  fieldValue,
  type BuilderField,
  type WorkflowConfigValues,
} from '@/components/agent-workflow/workflow-builder-config'
import { PATTERN_META, type OrchestrationPattern } from '@/components/agent-workflow/orchestration-patterns'
import type { DiagramNode } from '@/components/designer/diagram-types'

const OUTPUT_COLUMNS = {
  intermediate_output_from: { label: 'Progress', help: 'streams that agent’s messages as intermediate output' },
  output_from: { label: 'Output', help: 'makes it part of the final result' },
} as const

/**
 * A workflow node's Agent Framework builder settings: its team (from the canvas), which members
 * produce output, then every setting of the pattern's builder.
 */
export const WorkflowBuilderSettings = memo(function WorkflowBuilderSettings({
  pattern,
  node,
  team,
  values,
  onChange,
}: {
  pattern: OrchestrationPattern
  node: DiagramNode
  /** The agents the workflow node connects to: its participants. */
  team: DiagramNode[]
  values: WorkflowConfigValues | undefined
  onChange: (values: WorkflowConfigValues) => void
}) {
  const spec = BUILDER_SPECS[pattern]
  const set = (key: string, value: unknown) => onChange({ ...(values ?? {}), [key]: value })
  const selected = (key: 'output_from' | 'intermediate_output_from') => (values?.[key] as string[] | undefined) ?? []
  const toggleOutput = (key: 'output_from' | 'intermediate_output_from', id: string) => {
    const current = selected(key)
    set(key, current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const groups = useMemo(() => {
    const main: BuilderField[] = []
    const nested = new Map<string, BuilderField[]>()
    for (const field of builderFields(pattern)) {
      if (field.section) nested.set(field.section, [...(nested.get(field.section) ?? []), field])
      else main.push(field)
    }
    return { main, nested: [...nested.entries()] }
  }, [pattern])
  const columns = spec.outputs
  const grid = columns.length === 2 ? 'grid-cols-[minmax(0,1fr)_72px_56px]' : 'grid-cols-[minmax(0,1fr)_72px]'

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {PATTERN_META[pattern].label} · <span className="font-mono normal-case tracking-normal">{spec.builder}</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{spec.summary}</p>
      </div>

      <PanelSection title="Participants">
        {team.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Connect agents from this workflow on the canvas to add participants.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className={cn('grid gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', grid)}>
              <span>Agent</span>
              {columns.map((column) => (
                <span key={column} className="text-center">
                  {OUTPUT_COLUMNS[column].label}
                </span>
              ))}
            </div>
            {team.map((member) => (
              <div
                key={member.id}
                className={cn('grid items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0', grid)}
              >
                <span className="truncate text-[12.5px] font-medium text-foreground">{member.label || 'Agent'}</span>
                {columns.map((column) => (
                  <span key={column} className="flex justify-center">
                    <Switch
                      checked={selected(column).includes(member.id)}
                      onCheckedChange={() => toggleOutput(column, member.id)}
                      aria-label={`${OUTPUT_COLUMNS[column].label}: ${member.label}`}
                    />
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {columns.map((column, index) => (
            <span key={column}>
              {index > 0 ? '; ' : ''}
              <span className="font-medium">{OUTPUT_COLUMNS[column].label}</span> {OUTPUT_COLUMNS[column].help}
            </span>
          ))}
          . None selected uses the framework default.
          {spec.managerKey ? (
            <>
              {' '}
              <span className="font-medium text-foreground">{node.label || 'This node'}</span> is the manager (
              <span className="font-mono">{spec.managerKey}</span>).
            </>
          ) : null}
          {pattern === 'handoff' ? ' Handoffs follow the connectors: the router can reach every participant.' : null}
        </p>
      </PanelSection>

      <PanelSection title="Settings">
        {groups.main.map((field) => (
          <BuilderFieldInput key={field.key} field={field} value={fieldValue(field, values)} team={team} onChange={(value) => set(field.key, value)} />
        ))}
      </PanelSection>

      {groups.nested.map(([group, fields]) => (
        <PanelSection key={group} title={group}>
          {fields.map((field) => (
            <BuilderFieldInput key={field.key} field={field} value={fieldValue(field, values)} team={team} onChange={(value) => set(field.key, value)} />
          ))}
        </PanelSection>
      ))}
    </div>
  )
})

function BuilderFieldInput({
  field,
  value,
  team,
  onChange,
}: {
  field: BuilderField
  value: unknown
  team: DiagramNode[]
  onChange: (value: unknown) => void
}) {
  if (field.kind === 'boolean') {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">{field.label}</p>
          {field.hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{field.hint}</p> : null}
        </div>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} aria-label={field.label} />
      </div>
    )
  }
  return (
    <Field label={field.label} hint={field.hint}>
      {field.kind === 'number' ? (
        <Input
          type="number"
          min={field.min}
          value={value == null ? '' : String(value)}
          placeholder={field.defaultValue == null ? 'Framework default' : String(field.defaultValue)}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
      ) : field.kind === 'select' ? (
        <Select value={String(value ?? '')} onChange={(event) => onChange(event.target.value || null)}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : field.kind === 'agent' ? (
        <Select value={String(value ?? '')} onChange={(event) => onChange(event.target.value || null)}>
          <option value="">This node (default)</option>
          {team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label || 'Agent'}
            </option>
          ))}
        </Select>
      ) : field.kind === 'textarea' ? (
        <Textarea
          rows={field.section ? 4 : 3}
          className={cn('text-xs', field.section && 'font-mono')}
          value={typeof value === 'string' ? value : ''}
          placeholder="Framework default"
          onChange={(event) => onChange(event.target.value || null)}
        />
      ) : (
        <Input
          value={typeof value === 'string' ? value : ''}
          placeholder="Framework default"
          onChange={(event) => onChange(event.target.value || null)}
        />
      )}
    </Field>
  )
}
