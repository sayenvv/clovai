import { memo } from 'react'
import { GitBranch, Layers, Network } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import type { WorkflowExecutionType } from '@/types/agent-workflow'

interface WorkflowSettingsPanelProps {
  executionType: WorkflowExecutionType
  onExecutionTypeChange: (type: WorkflowExecutionType) => void
  workflowId: string
  pageCount: number
  nodeCount: number
  edgeCount: number
}

const EXECUTION_TYPES: { value: WorkflowExecutionType; label: string; description: string }[] = [
  { value: 'sequential', label: 'Sequential', description: 'Agents execute one after another.' },
  { value: 'parallel', label: 'Parallel', description: 'Independent branches run concurrently.' },
  { value: 'conditional', label: 'Conditional', description: 'Router decides the next path.' },
  { value: 'group-chat', label: 'Group chat', description: 'Agents collaborate in a shared thread.' },
  { value: 'dependency', label: 'Dependency', description: 'Cross-workflow dependencies gate execution.' },
  {
    value: 'human-in-the-loop',
    label: 'Human-in-the-loop',
    description: 'Approval gates between agent transitions.',
  },
]

export const WorkflowSettingsPanel = memo(function WorkflowSettingsPanel({
  executionType,
  onExecutionTypeChange,
  workflowId,
  pageCount,
  nodeCount,
  edgeCount,
}: WorkflowSettingsPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Workflow settings</h3>
        <p className="text-xs text-muted-foreground">Execution pattern and workspace overview</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <PanelSection title="Workflow identity">
          <Field label="Workflow ID">
            <code className="block rounded-md border border-border bg-muted/50 px-2.5 py-2 font-mono text-xs">
              {workflowId}
            </code>
          </Field>
        </PanelSection>

        <PanelSection title="Execution type">
          <Field label="Pattern" hint="Auto-detected from connections; override if needed">
            <Select
              value={executionType}
              onChange={(event) =>
                onExecutionTypeChange(event.target.value as WorkflowExecutionType)
              }
            >
              {EXECUTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground">
            {EXECUTION_TYPES.find((type) => type.value === executionType)?.description}
          </p>
        </PanelSection>

        <PanelSection title="Workspace">
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={Layers} label="Pages" value={String(pageCount)} />
            <StatCard icon={Network} label="Agents" value={String(nodeCount)} />
            <StatCard icon={GitBranch} label="Connectors" value={String(edgeCount)} />
          </div>
        </PanelSection>

        <PanelSection title="Cross-workflow">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Use multiple pages to represent separate workflows. Link outputs to inputs via dependency
            connectors or reuse a workflow as a sub-flow in another page.
          </p>
        </PanelSection>
      </div>
    </div>
  )
})

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-center">
      <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-violet-500" />
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
