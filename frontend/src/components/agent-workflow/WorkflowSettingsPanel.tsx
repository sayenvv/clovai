import { memo } from 'react'
import { Cpu, GitBranch, Layers, Network } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { WorkflowModelConfigPanel } from '@/components/agent-workflow/WorkflowModelConfigPanel'
import type { WorkflowExecutionType } from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

interface WorkflowSettingsPanelProps {
  executionType: WorkflowExecutionType
  onExecutionTypeChange: (type: WorkflowExecutionType) => void
  modelConfig: WorkflowModelConfig
  onModelConfigChange: (patch: Partial<WorkflowModelConfig>) => void
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

const TAB_TRIGGER_CLASS =
  'h-8 flex-1 rounded-none border-b-2 border-transparent text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none'

export const WorkflowSettingsPanel = memo(function WorkflowSettingsPanel({
  executionType,
  onExecutionTypeChange,
  modelConfig,
  onModelConfigChange,
  workflowId,
  pageCount,
  nodeCount,
  edgeCount,
}: WorkflowSettingsPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Workflow settings</h3>
        <p className="text-xs text-muted-foreground">
          Execution pattern, model defaults, and workspace overview
        </p>
      </div>

      <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <TabsList className="h-8 w-full shrink-0">
          <TabsTrigger value="general" className={TAB_TRIGGER_CLASS}>
            General
          </TabsTrigger>
          <TabsTrigger value="model" className={TAB_TRIGGER_CLASS}>
            <Cpu className="mr-1 h-3 w-3" />
            Model
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-3 min-h-0 flex-1 overflow-y-auto space-y-5 pb-4">
          <PanelSection title="Workflow identity">
            <Field label="Workflow ID">
              <code className="block rounded-md border border-border bg-muted/50 px-2.5 py-2 font-mono text-xs">
                {workflowId}
              </code>
            </Field>
          </PanelSection>

          <PanelSection title="Execution type">
            <Field label="Pattern" hint="Maps to workflowType in exported JSON">
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
        </TabsContent>

        <TabsContent value="model" className="mt-3 min-h-0 flex-1 overflow-y-auto pb-4">
          <WorkflowModelConfigPanel modelConfig={modelConfig} onChange={onModelConfigChange} />
        </TabsContent>
      </Tabs>
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
