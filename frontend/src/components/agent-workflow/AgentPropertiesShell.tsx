import { memo, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChevronLeft, GitBranch, Info, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { AgentConfigPanel } from '@/components/agent-workflow/AgentConfigPanel'
import { ConnectorConfigPanel } from '@/components/agent-workflow/ConnectorConfigPanel'
import { ExecutorConfigPanel } from '@/components/agent-workflow/ExecutorConfigPanel'
import { ToolConfigPanel } from '@/components/agent-workflow/ToolConfigPanel'
import { SubWorkflowConfigPanel } from '@/components/agent-workflow/SubWorkflowConfigPanel'
import { WorkflowSettingsPanel } from '@/components/agent-workflow/WorkflowSettingsPanel'
import { ExecutionSidebarPanel } from '@/components/agent-workflow/ExecutionSidebarPanel'
import {
  agentLabel,
  isExecutorNode,
  isMcpToolNode,
  isToolNode,
} from '@/components/agent-workflow/tool-agent-mapping'
import { isSubWorkflowNode } from '@/components/agent-workflow/sub-workflow-ops'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import type { Selection } from '@/components/designer/selection-utils'
import type { Diagram, DiagramDocument, DiagramEdge, DiagramNode } from '@/components/designer/diagram-types'
import type {
  AgentWorkflowMeta,
  ExecutionTraceStep,
  WorkflowExecutionType,
  WorkflowRunState,
  WorkflowRunStatus,
} from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

interface ExecutionSidebarOptions {
  testInput: string
  onTestInputChange: (value: string) => void
  onSimulate: () => void
  onExecute: () => void
  isExecuting?: boolean
  canExecute?: boolean
  runStatus: WorkflowRunStatus
  runId?: string | null
  onCancel?: () => void
  approvalPrompt?: WorkflowRunState['approvalPrompt']
  onSubmitApproval?: (value: string) => void
  stepOutputs?: Record<string, string>
  trace?: ExecutionTraceStep[]
  needsReview?: boolean
}

const EXECUTION_PANEL_HINT =
  'Run workflow and approve human-in-the-loop steps'

interface AgentPropertiesShellProps {
  diagram: Diagram
  doc: DiagramDocument
  selection: Selection
  onChange: (updater: (previous: Diagram) => Diagram) => void
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
  onOpenSubWorkflow?: (pageId: string) => void
  onConvertToSubWorkflow?: () => void
  canConvertToSubWorkflow?: boolean
  onWorkflowMetaChange?: (patch: Partial<AgentWorkflowMeta>) => void
  onModelConfigChange?: (patch: Partial<WorkflowModelConfig>) => void
  serverModelConfig: WorkflowModelConfig
  llmConfigured?: boolean
  executionPanelOpen?: boolean
  execution?: ExecutionSidebarOptions
}

export const AgentPropertiesShell = memo(function AgentPropertiesShell({
  diagram,
  doc,
  selection,
  onChange,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
  onOpenSubWorkflow,
  onConvertToSubWorkflow,
  canConvertToSubWorkflow = false,
  onWorkflowMetaChange,
  onModelConfigChange,
  serverModelConfig,
  llmConfigured = false,
  executionPanelOpen = false,
  execution,
}: AgentPropertiesShellProps) {
  const workflowMeta = doc.workflow
  const modelConfig = serverModelConfig

  const selectedNode: DiagramNode | undefined =
    selection?.kind === 'node' ? diagram.nodes.find((node) => node.id === selection.id) : undefined
  const selectedEdge: DiagramEdge | undefined =
    selection?.kind === 'edge' ? diagram.edges.find((edge) => edge.id === selection.id) : undefined

  const fromLabel =
    selectedEdge && diagram.nodes.find((node) => node.id === selectedEdge.from)?.label
  const toLabel = selectedEdge && diagram.nodes.find((node) => node.id === selectedEdge.to)?.label

  const multiSelectCount = selection?.kind === 'nodes' ? selection.ids.length : 0

  const detailsTitle =
    multiSelectCount > 0
      ? `${multiSelectCount} selected`
      : selection?.kind === 'node' && selectedNode
        ? selectedNode.label
        : selection?.kind === 'edge'
          ? 'Connector'
          : 'Workflow'

  const detailsSubtitle =
    selection?.kind === 'edge' && selectedEdge
      ? `${fromLabel ?? 'Source'} → ${toLabel ?? 'Target'}`
      : selection?.kind === 'node' && selectedNode && isToolNode(selectedNode)
        ? isMcpToolNode(selectedNode)
          ? `MCP tool · Under ${agentLabel(diagram, selectedNode.mappedAgentId)}`
          : `Under ${agentLabel(diagram, selectedNode.mappedAgentId)}`
        : null

  const detailsContent = (
    <DetailsPanelContent
      multiSelectCount={multiSelectCount}
      canConvertToSubWorkflow={canConvertToSubWorkflow}
      onConvertToSubWorkflow={onConvertToSubWorkflow}
      selection={selection}
      selectedNode={selectedNode}
      selectedEdge={selectedEdge}
      doc={doc}
      diagram={diagram}
      onChange={onChange}
      onOpenSubWorkflow={onOpenSubWorkflow}
      workflowMeta={workflowMeta}
      modelConfig={modelConfig}
      onWorkflowMetaChange={onWorkflowMetaChange}
      onModelConfigChange={onModelConfigChange}
      llmConfigured={llmConfigured}
      fromLabel={fromLabel}
      toLabel={toLabel}
    />
  )

  if (collapsed) {
    return (
      <aside
        className="relative flex h-full shrink-0 flex-col border-l border-border bg-card/50"
        style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
      >
        <div className="flex flex-col items-center gap-2 border-b border-border py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleCollapse}
            aria-label="Expand right panel"
            title="Expand panel"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
            {executionPanelOpen ? 'Run' : 'Panel'}
          </span>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-card/50"
      style={{ width }}
    >
      <DesignerResizeHandle
        side="left"
        onPointerDown={onResizePointerDown}
        ariaLabel="Resize right panel"
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <div className="min-w-0 flex-1">
            {executionPanelOpen ? (
              <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-foreground">Execution</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="About execution panel"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      {EXECUTION_PANEL_HINT}
                    </TooltipContent>
                  </Tooltip>
                  {execution?.needsReview && (
                    <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  )}
                </div>
              </TooltipProvider>
            ) : (
              <>
                <p className="truncate text-sm font-semibold text-foreground">{detailsTitle}</p>
                {detailsSubtitle && (
                  <p className="truncate text-[11px] text-muted-foreground">{detailsSubtitle}</p>
                )}
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleCollapse}
            aria-label="Collapse right panel"
            title="Collapse panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {executionPanelOpen ? (
            execution ? (
              <ExecutionSidebarPanel
                testInput={execution.testInput}
                onTestInputChange={execution.onTestInputChange}
                onSimulate={execution.onSimulate}
                onExecute={execution.onExecute}
                isExecuting={execution.isExecuting}
                canExecute={execution.canExecute}
                runStatus={execution.runStatus}
                runId={execution.runId}
                onCancel={execution.onCancel}
                approvalPrompt={execution.approvalPrompt}
                onSubmitApproval={execution.onSubmitApproval}
                stepOutputs={execution.stepOutputs}
                trace={execution.trace}
              />
            ) : (
              <div className="p-4 text-xs text-muted-foreground">Execution controls unavailable.</div>
            )
          ) : (
            detailsContent
          )}
        </div>
      </div>
    </aside>
  )
})

function DetailsPanelContent({
  multiSelectCount,
  canConvertToSubWorkflow,
  onConvertToSubWorkflow,
  selection,
  selectedNode,
  selectedEdge,
  doc,
  diagram,
  onChange,
  onOpenSubWorkflow,
  workflowMeta,
  modelConfig,
  onWorkflowMetaChange,
  onModelConfigChange,
  llmConfigured,
  fromLabel,
  toLabel,
}: {
  multiSelectCount: number
  canConvertToSubWorkflow: boolean
  onConvertToSubWorkflow?: () => void
  selection: Selection
  selectedNode?: DiagramNode
  selectedEdge?: DiagramEdge
  doc: DiagramDocument
  diagram: Diagram
  onChange: (updater: (previous: Diagram) => Diagram) => void
  onOpenSubWorkflow?: (pageId: string) => void
  workflowMeta?: AgentWorkflowMeta
  modelConfig: WorkflowModelConfig
  onWorkflowMetaChange?: (patch: Partial<AgentWorkflowMeta>) => void
  onModelConfigChange?: (patch: Partial<WorkflowModelConfig>) => void
  llmConfigured: boolean
  fromLabel?: string
  toLabel?: string
}): ReactNode {
  if (multiSelectCount > 0) {
    return (
      <MultiSelectState
        count={multiSelectCount}
        canConvert={canConvertToSubWorkflow}
        onConvert={onConvertToSubWorkflow}
      />
    )
  }

  if (selection?.kind === 'node' && selectedNode && isSubWorkflowNode(selectedNode)) {
    return (
      <SubWorkflowConfigPanel
        node={selectedNode}
        doc={doc}
        onOpenSubWorkflow={onOpenSubWorkflow ?? (() => {})}
      />
    )
  }

  if (selection?.kind === 'node' && selectedNode?.agent && isToolNode(selectedNode)) {
    return <ToolConfigPanel node={selectedNode} diagram={diagram} onChange={onChange} />
  }

  if (selection?.kind === 'node' && selectedNode?.agent && isExecutorNode(selectedNode)) {
    return <ExecutorConfigPanel node={selectedNode} onChange={onChange} llmConfigured={llmConfigured} />
  }

  if (selection?.kind === 'node' && selectedNode?.agent) {
    return <AgentConfigPanel node={selectedNode} onChange={onChange} />
  }

  if (selection?.kind === 'edge' && selectedEdge) {
    return (
      <ConnectorConfigPanel
        edge={selectedEdge}
        fromLabel={fromLabel ?? 'Source'}
        toLabel={toLabel ?? 'Target'}
        onChange={onChange}
      />
    )
  }

  return (
    <WorkflowSettingsPanel
      executionType={workflowMeta?.executionType ?? 'sequential'}
      onExecutionTypeChange={(type: WorkflowExecutionType) =>
        onWorkflowMetaChange?.({ executionType: type })
      }
      modelConfig={modelConfig}
      onModelConfigChange={onModelConfigChange}
      modelConfigReadOnly
      llmConfigured={llmConfigured}
      workflowId={workflowMeta?.workflowId ?? '—'}
      pageCount={doc.pages.length}
      nodeCount={diagram.nodes.length}
      edgeCount={diagram.edges.length}
    />
  )
}

function MultiSelectState({
  count,
  canConvert,
  onConvert,
}: {
  count: number
  canConvert: boolean
  onConvert?: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
        <GitBranch className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{count} items selected</p>
      <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
        Shift-click or Cmd/Ctrl-click agents to add or remove them from the selection.
      </p>
      {canConvert && onConvert && (
        <Button type="button" className="mt-5 gap-2" onClick={onConvert}>
          <GitBranch className="h-4 w-4" />
          Convert to sub-workflow
        </Button>
      )}
      {!canConvert && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          Select at least two agents to group into a sub-workflow.
        </p>
      )}
    </div>
  )
}
