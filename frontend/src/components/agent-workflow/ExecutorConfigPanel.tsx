import { memo, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Boxes, Check, Code2, Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { PythonCodeEditorField } from '@/components/agent-workflow/PythonCodeEditorField'
import { defaultExecutorSource } from '@/components/agent-workflow/agent-workflow-defaults'
import {
  executorSourceNeedsNormalization,
  normalizeExecutorSource,
} from '@/components/agent-workflow/executor-source'
import { generateExecutorSource } from '@/services/generate-executor-source-api'
import { cn } from '@/utils/cn'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'
import type { AgentNodeConfig, AgentStatus, ExecutorHandlerKind } from '@/types/agent-workflow'

interface ExecutorConfigPanelProps {
  node: DiagramNode
  onChange: (updater: (previous: Diagram) => Diagram) => void
  llmConfigured?: boolean
}

const HANDLER_KINDS: {
  value: ExecutorHandlerKind
  label: string
  subtitle: string
  hint: string
  recommended?: boolean
}[] = [
  {
    value: 'class',
    label: 'Multi-handler & state',
    subtitle: 'For several message types and shared executor state',
    hint:
      'Choose this when the step handles multiple input types, keeps state across calls, or needs a structured executor class with @handler methods.',
    recommended: true,
  },
  {
    value: 'function',
    label: 'Single-step transform',
    subtitle: 'For one async handler with minimal boilerplate',
    hint:
      'Choose this when a single function receives a typed message and forwards or yields output via @executor — best for quick, stateless transforms.',
  },
]

const PYTHON_TYPES = ['str', 'int', 'float', 'bool', 'dict', 'list', 'Any']

function updateExecutor(
  onChange: ExecutorConfigPanelProps['onChange'],
  nodeId: string,
  patch: Partial<AgentNodeConfig>,
  label?: string,
) {
  onChange((previous) => ({
    ...previous,
    nodes: previous.nodes.map((candidate) => {
      if (candidate.id !== nodeId || !candidate.agent) return candidate
      return {
        ...candidate,
        label: label ?? candidate.label,
        agent: { ...candidate.agent, ...patch },
      }
    }),
  }))
}

export const ExecutorConfigPanel = memo(function ExecutorConfigPanel({
  node,
  onChange,
  llmConfigured = false,
}: ExecutorConfigPanelProps) {
  const config = node.agent!
  const handlerKind = config.executorHandlerKind ?? 'class'
  const [isGeneratingSource, setIsGeneratingSource] = useState(false)

  const patch = useCallback(
    (updates: Partial<AgentNodeConfig>, label?: string) => {
      updateExecutor(onChange, node.id, updates, label)
    },
    [node.id, onChange],
  )

  const handleHandlerKindChange = (kind: ExecutorHandlerKind) => {
    patch({
      executorHandlerKind: kind,
      executorSource: normalizeExecutorSource(defaultExecutorSource(kind)),
    })
  }

  useEffect(() => {
    const source = config.executorSource ?? ''
    if (!executorSourceNeedsNormalization(source)) return
    patch({ executorSource: normalizeExecutorSource(source) })
  }, [config.executorSource, node.id, patch])

  const handleGenerateSource = useCallback(async () => {
    if (!node.label.trim()) {
      toast.error('Add an executor name before generating handler code')
      return
    }

    setIsGeneratingSource(true)
    try {
      const result = await generateExecutorSource({
        executorName: node.label.trim(),
        description: config.description.trim(),
        handlerKind,
        executorId: config.executorId?.trim() || 'custom_executor',
        inputType: config.executorInputType ?? 'str',
        outputType: config.executorOutputType ?? 'str',
      })
      patch({ executorSource: normalizeExecutorSource(result.source) })
      if (result.origin === 'template') {
        toast.success('Handler drafted from template — configure LLM in server .env for AI generation')
      } else {
        toast.success('Handler code generated')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate handler code')
    } finally {
      setIsGeneratingSource(false)
    }
  }, [
    config.description,
    config.executorId,
    config.executorInputType,
    config.executorOutputType,
    handlerKind,
    node.label,
    patch,
  ])

  const executorFileName = `${(config.executorId?.trim() || 'handler').replace(/[^a-zA-Z0-9_-]/g, '_')}.py`

  return (
    <div className="flex h-full flex-col">
      <p className="border-b border-border px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Python handler for this workflow step — use{' '}
        <code className="text-[10px]">ctx.send_message</code> to forward results and{' '}
        <code className="text-[10px]">ctx.yield_output</code> for workflow output. Imports use{' '}
        <code className="text-[10px]">elevennodes</code>.
      </p>

      <Tabs defaultValue="identity" className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <TabsList className="h-8 w-full shrink-0">
          <TabsTrigger value="identity" className="flex-1 text-xs">
            Identity
          </TabsTrigger>
          <TabsTrigger value="handler" className="flex-1 text-xs">
            Handler
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex-1 text-xs">
            Messages
          </TabsTrigger>
          <TabsTrigger value="output" className="flex-1 text-xs">
            Output
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-3 flex-1 space-y-4 overflow-y-auto pb-4">
          <Field label="Display name">
            <Input value={node.label} onChange={(event) => patch({}, event.target.value)} />
          </Field>
          <Field
            label="Executor ID"
            hint="Stable identifier referenced by @executor(id=...) and workflow build exports"
          >
            <Input
              value={config.executorId ?? ''}
              onChange={(event) => patch({ executorId: event.target.value })}
              placeholder="custom_executor"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={3}
              value={config.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={config.status}
              onChange={(event) => patch({ status: event.target.value as AgentStatus })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </Select>
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Resettable executor</p>
              <p className="text-[11px] text-muted-foreground">
                Clear mutable state between workflow runs.
              </p>
            </div>
            <Switch
              checked={config.executorResettable ?? false}
              onCheckedChange={(checked) => patch({ executorResettable: checked })}
            />
          </div>
        </TabsContent>

        <TabsContent value="handler" className="mt-3 flex-1 space-y-4 overflow-y-auto pb-4">
          <Field label="Executor purpose" hint="Pick the pattern that matches what this step does in the workflow">
            <HandlerStylePicker value={handlerKind} onChange={handleHandlerKindChange} />
          </Field>
          <Field
            label="Handler source"
            hint={
              llmConfigured
                ? 'Edit Python directly or generate with AI. Expand for a larger editor.'
                : 'Edit Python directly. Configure server LLM settings to enable AI generation.'
            }
          >
            <PythonCodeEditorField
              value={config.executorSource ?? ''}
              onChange={(source) => patch({ executorSource: normalizeExecutorSource(source) })}
              fileName={executorFileName}
              onGenerate={handleGenerateSource}
              isGenerating={isGeneratingSource}
              minRows={10}
            />
          </Field>
        </TabsContent>

        <TabsContent value="messages" className="mt-3 flex-1 space-y-4 overflow-y-auto pb-4">
          <PanelSection title="Handler type annotations">
            <p className="mb-3 text-[11px] text-muted-foreground">
              Typed handler annotations for <code className="text-[10px]">@handler</code> methods or{' '}
              <code className="text-[10px]">WorkflowContext</code> generics.
            </p>
            <Field label="Input type" hint="Message type this handler receives">
              <Select
                value={config.executorInputType ?? 'str'}
                onChange={(event) => patch({ executorInputType: event.target.value })}
              >
                {PYTHON_TYPES.map((typeName) => (
                  <option key={typeName} value={typeName}>
                    {typeName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Output type (send_message)" hint="Type forwarded to downstream executors">
              <Select
                value={config.executorOutputType ?? 'str'}
                onChange={(event) => patch({ executorOutputType: event.target.value })}
              >
                {PYTHON_TYPES.map((typeName) => (
                  <option key={typeName} value={typeName}>
                    {typeName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Workflow output type (yield_output)"
              hint="Leave empty if this handler does not call ctx.yield_output"
            >
              <Input
                value={config.executorWorkflowOutputType ?? ''}
                onChange={(event) => patch({ executorWorkflowOutputType: event.target.value })}
                placeholder="e.g. str, bool — optional"
                className="font-mono text-xs"
              />
            </Field>
          </PanelSection>

          <PanelSection title="JSON schemas (optional)">
            <Field label="Input schema">
              <Textarea
                rows={5}
                className="font-mono text-xs"
                value={config.inputSchema}
                onChange={(event) => patch({ inputSchema: event.target.value })}
              />
            </Field>
            <Field label="Output schema">
              <Textarea
                rows={5}
                className="font-mono text-xs"
                value={config.outputSchema}
                onChange={(event) => patch({ outputSchema: event.target.value })}
              />
            </Field>
          </PanelSection>
        </TabsContent>

        <TabsContent value="output" className="mt-3 flex-1 space-y-4 overflow-y-auto pb-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Workflow output designation — controls how <code className="text-[10px]">ctx.yield_output(...)</code>{' '}
            results are collected when the workflow is built.
          </p>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Terminal workflow output</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Final workflow results surfaced via <code className="text-[10px]">get_outputs()</code>.
                </p>
              </div>
              <Switch
                checked={config.contributesToWorkflowOutput ?? false}
                onCheckedChange={(checked) => patch({ contributesToWorkflowOutput: checked })}
              />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Intermediate output</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Streaming intermediate results via{' '}
                  <code className="text-[10px]">get_intermediate_outputs()</code>.
                </p>
              </div>
              <Switch
                checked={config.contributesToIntermediateOutput ?? false}
                onCheckedChange={(checked) => patch({ contributesToIntermediateOutput: checked })}
              />
            </div>
          </div>

          <PanelSection title="Runtime limits">
            <Field label="Timeout (seconds)">
              <Input
                type="number"
                min={5}
                value={config.timeoutSeconds}
                onChange={(event) => patch({ timeoutSeconds: Number(event.target.value) })}
              />
            </Field>
            <Field label="Retry count">
              <Input
                type="number"
                min={0}
                max={10}
                value={config.retryCount}
                onChange={(event) => patch({ retryCount: Number(event.target.value) })}
              />
            </Field>
          </PanelSection>
        </TabsContent>
      </Tabs>
    </div>
  )
})

function HandlerStylePicker({
  value,
  onChange,
}: {
  value: ExecutorHandlerKind
  onChange: (kind: ExecutorHandlerKind) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {HANDLER_KINDS.map((option) => (
        <HandlerStyleCard
          key={option.value}
          option={option}
          selected={value === option.value}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}

function HandlerStyleCard({
  option,
  selected,
  onSelect,
}: {
  option: (typeof HANDLER_KINDS)[number]
  selected: boolean
  onSelect: () => void
}) {
  const Icon = option.value === 'class' ? Boxes : Code2

  return (
    <div className="relative min-h-[4.75rem] min-w-0">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-lg border p-2.5 text-left',
          'transition-[box-shadow,border-color,background-color] duration-200 ease-out',
          'hover:absolute hover:inset-x-0 hover:top-0 hover:z-30 hover:h-auto hover:overflow-visible',
          'hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] hover:ring-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'focus-visible:absolute focus-visible:inset-x-0 focus-visible:top-0 focus-visible:z-30 focus-visible:h-auto focus-visible:overflow-visible',
          selected
            ? 'border-orange-500/40 bg-orange-500/[0.07] hover:border-orange-500/50 hover:bg-card hover:ring-orange-500/20'
            : 'border-border/70 bg-muted/20 hover:border-border hover:bg-card hover:ring-border/80',
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors',
              selected
                ? 'border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300'
                : 'border-border/70 bg-background/80 text-muted-foreground group-hover:border-orange-500/20 group-hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          {selected ? (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          ) : option.recommended ? (
            <Badge
              variant="outline"
              className="h-4 shrink-0 gap-0.5 border-red-500/20 bg-red-500/5 px-1 text-[8px] font-medium text-red-700 dark:text-red-300"
            >
              <Sparkles className="h-2 w-2" />
              Rec
            </Badge>
          ) : null}
        </div>

        <div className="mt-1.5 min-w-0 space-y-0.5">
          <p className="line-clamp-1 text-xs font-medium leading-tight text-foreground group-hover:line-clamp-none group-focus-visible:line-clamp-none">
            {option.label}
          </p>
          <p className="line-clamp-1 text-[10px] leading-snug text-muted-foreground group-hover:line-clamp-none group-focus-visible:line-clamp-none">
            {option.subtitle}
          </p>
          <p className="line-clamp-1 text-[10px] leading-snug text-muted-foreground/75 group-hover:line-clamp-none group-focus-visible:line-clamp-none">
            {option.hint}
          </p>
        </div>
      </button>
    </div>
  )
}
