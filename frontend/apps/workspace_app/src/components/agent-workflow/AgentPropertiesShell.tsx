import type { ExecutionRecord } from '@/services/execution-history-store'
import { isGraphWorkflow, isSwitchNode } from '@/components/agent-workflow/workflow-edge-groups'
import { pageWorkflowId } from '@/components/agent-workflow/page-workflow-id'
import { memo, useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  ChevronLeft,
  Flag,
  GitBranch,
  Info,
  Maximize,
  MessageSquare,
  Minimize,
  PanelRightClose,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { ChatSession } from '@/components/agent-workflow/hooks/use-chat-sessions'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { AgentConfigPanel } from '@/components/agent-workflow/AgentConfigPanel'
import { SwitchConfigPanel } from '@/components/agent-workflow/SwitchConfigPanel'
import { AttachCapabilityPanel } from '@/components/agent-workflow/AttachCapabilityPanel'
import { ConnectorConfigPanel } from '@/components/agent-workflow/ConnectorConfigPanel'
import { findOrchestration, resolveExecutionType } from '@/components/agent-workflow/orchestration-patterns'
import { ExecutorConfigPanel } from '@/components/agent-workflow/ExecutorConfigPanel'
import { ToolConfigPanel } from '@/components/agent-workflow/ToolConfigPanel'
import { SubWorkflowConfigPanel } from '@/components/agent-workflow/SubWorkflowConfigPanel'
import { WorkflowSettingsPanel } from '@/components/agent-workflow/WorkflowSettingsPanel'
import { ExecutionSidebarPanel } from '@/components/agent-workflow/ExecutionSidebarPanel'
import {
  GenerateWorkflowChat,
  type GenerateChatMessage,
} from '@/components/agent-workflow/GenerateWorkflowChat'
import type {
  AgentCapability,
  AgentCapabilityKind,
} from '@/components/agent-workflow/agent-capabilities'
import {
  agentLabel,
  isExecutorNode,
  isMcpToolNode,
  isToolNode,
} from '@/components/agent-workflow/tool-agent-mapping'
import { isSubWorkflowNode } from '@/components/agent-workflow/sub-workflow-ops'
import { isFlowBoundaryNode, isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import type { Selection } from '@/components/designer/selection-utils'
import type { Diagram, DiagramDocument, DiagramEdge, DiagramNode } from '@/components/designer/diagram-types'
import type {
  AgentWorkflowMeta,
  ExecutionTraceStep,
  WorkflowChatMessage,
  WorkflowExecutionEvent,
  WorkflowExecutionType,
  WorkflowRunState,
  WorkflowRunStatus,
} from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import type { CanvasPlan } from '@/components/agent-workflow/workflow-plan-from-diagram'
import { cn } from '@/utils/cn'

interface ExecutionSidebarOptions {
  testInput: string
  onTestInputChange: (value: string) => void
  onExecute: () => void
  isExecuting?: boolean
  canExecute?: boolean
  runStatus: WorkflowRunStatus
  runId?: string | null
  onCancel?: () => void
  approvalPrompt?: WorkflowRunState['approvalPrompt']
  onSubmitApproval?: (value: string) => void
  onSubmitFeedback?: (value: string) => void
  stepOutputs?: Record<string, string>
  trace?: ExecutionTraceStep[]
  messages?: WorkflowChatMessage[]
  history?: ExecutionRecord[]
  finalResponse?: string | null
  errors?: WorkflowExecutionEvent[]
  onShowDetails?: () => void
  needsReview?: boolean
}

interface AttachCapabilityOptions {
  agentLabel: string
  initialKind: AgentCapabilityKind
  attachedIds: string[]
  onAttach: (capability: AgentCapability) => void
  onClose: () => void
}

interface GenerateChatOptions {
  messages: GenerateChatMessage[]
  onMessagesChange: (updater: (previous: GenerateChatMessage[]) => GenerateChatMessage[]) => void
  model: GenerateWorkflowModel
  onModelChange: (model: GenerateWorkflowModel) => void
  ollamaBaseUrl: string
  replacesCanvas: boolean
  getCurrentWorkflow: () => CanvasPlan | null
  onGenerated: (plan: WorkflowGenerationPlan, base: CanvasPlan | null) => void
  onClose: () => void
  /** Saved sessions, listed beside the chat when it is expanded. */
  chats?: {
    sessions: ChatSession[]
    activeId: string
    onSelect: (id: string) => void
    onNew: () => void
    onDelete: (id: string) => void
  }
}

/** The session list shown to the left of the expanded Workflow AI chat. */
function ChatList({ chats }: { chats: NonNullable<GenerateChatOptions['chats']> }) {
  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-border/60 bg-muted/20 px-2 py-3" aria-label="Sessions">
      <button
        type="button"
        onClick={chats.onNew}
        className="group mb-3 flex h-9 items-center gap-2.5 rounded-lg px-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-foreground/[0.05]"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card shadow-sm transition-colors group-hover:border-foreground/30">
          <Plus className="h-3.5 w-3.5" />
        </span>
        New session
      </button>
      <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sessions</p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {chats.sessions.map((session) => {
          const active = session.id === chats.activeId
          return (
            <div
              key={session.id}
              className={cn(
                'group flex items-center rounded-lg transition-colors',
                active ? 'bg-foreground/[0.07]' : 'hover:bg-foreground/[0.04]',
              )}
            >
              <button
                type="button"
                onClick={() => chats.onSelect(session.id)}
                className={cn(
                  'min-w-0 flex-1 px-2.5 py-2 text-left',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate text-[12.5px]">{session.title || 'New session'}</span>
                </span>
              </button>
              {session.messages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => chats.onDelete(session.id)}
                  aria-label={`Delete ${session.title || 'session'}`}
                  title="Delete session"
                  className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

/**
 * A close cross drawn corner to corner (3→21), so it spans the same box as lucide's
 * Maximize brackets beside it; lucide's X only spans 6→18 and looks smaller.
 */
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M4 4 20 20M20 4 4 20" />
    </svg>
  )
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
  /** Fill parent (mobile drawer) — full width, no resize chrome. */
  embedded?: boolean
  execution?: ExecutionSidebarOptions
  attachCapability?: AttachCapabilityOptions | null
  /** When set, the panel shows the Generate chat instead of details / execution. */
  generate?: GenerateChatOptions | null
  /** Workflow AI widened over the workspace (controlled by the page, which hides the canvas). */
  chatExpanded?: boolean
  onChatExpandedChange?: (expanded: boolean) => void
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
  attachCapability = null,
  embedded = false,
  generate = null,
  chatExpanded: chatExpandedProp = false,
  onChatExpandedChange,
}: AgentPropertiesShellProps) {
  const workflowMeta = doc.workflow
  const modelConfig = workflowMeta?.modelConfig ?? serverModelConfig
  const attaching = Boolean(attachCapability) && !executionPanelOpen

  const selectedNode: DiagramNode | undefined =
    selection?.kind === 'node' ? diagram.nodes.find((node) => node.id === selection.id) : undefined
  const selectedEdge: DiagramEdge | undefined =
    selection?.kind === 'edge' ? diagram.edges.find((edge) => edge.id === selection.id) : undefined

  const fromLabel =
    selectedEdge && diagram.nodes.find((node) => node.id === selectedEdge.from)?.label
  const toLabel = selectedEdge && diagram.nodes.find((node) => node.id === selectedEdge.to)?.label

  const multiSelectCount = selection?.kind === 'nodes' ? selection.ids.length : 0

  // While Workflow AI is open, selecting something on the canvas shows its properties.
  // The chat stays mounted underneath, so a running generation keeps streaming.
  const [showDetailsOverChat, setShowDetailsOverChat] = useState(false)
  const selectionKey =
    selection?.kind === 'nodes' ? `nodes:${selection.ids.join(',')}` : selection ? `${selection.kind}:${selection.id}` : ''
  useEffect(() => {
    setShowDetailsOverChat(Boolean(selectionKey))
  }, [selectionKey])
  const chatVisible = Boolean(generate) && !showDetailsOverChat
  // Workflow AI can be widened to fill the whole workspace.
  const chatExpanded = chatExpandedProp && chatVisible && !embedded
  const setChatExpanded = (next: boolean | ((value: boolean) => boolean)) =>
    onChatExpandedChange?.(typeof next === 'function' ? next(chatExpanded) : next)
  useEffect(() => {
    if (!chatExpanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChatExpanded(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatExpanded])

  const detailsTitle = attaching
    ? 'Attach'
    : multiSelectCount > 0
      ? `${multiSelectCount} selected`
      : selection?.kind === 'node' && selectedNode
        ? selectedNode.label
        : selection?.kind === 'edge'
          ? 'Connector'
          : 'Workflow'

  const detailsSubtitle = attaching
    ? attachCapability?.agentLabel ?? null
    : selection?.kind === 'edge' && selectedEdge
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
      serverModelConfig={serverModelConfig}
      onWorkflowMetaChange={onWorkflowMetaChange}
      onModelConfigChange={onModelConfigChange}
      llmConfigured={llmConfigured}
      fromLabel={fromLabel}
      toLabel={toLabel}
    />
  )

  if (collapsed && !embedded) {
    return (
      <aside
        className="relative flex h-full shrink-0 flex-col border-l border-border/60 bg-background"
        style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
      >
        <div className="flex flex-col items-center gap-2 border-b border-border/60 py-2">
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
            {generate ? 'AI' : executionPanelOpen ? 'Run' : attaching ? 'Attach' : 'Panel'}
          </span>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        'flex flex-col bg-background',
        chatExpanded
          ? 'relative h-full min-w-0 flex-1 animate-in fade-in-0 duration-200'
          : cn('relative h-full shrink-0', !chatVisible && 'border-l border-border/60'),
        embedded && 'w-full border-l-0',
        chatVisible && !chatExpanded && 'shadow-[-1px_0_0_hsl(var(--border)/0.35)]',
      )}
      style={chatExpanded ? undefined : { width: embedded ? '100%' : width }}
    >
      {!embedded && !chatExpanded && (
        <DesignerResizeHandle
          side="left"
          onPointerDown={onResizePointerDown}
          ariaLabel="Resize right panel"
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            'flex shrink-0 items-center justify-between px-3 py-2',
            (!chatVisible || chatExpanded) && 'border-b border-border/60',
            chatExpanded && 'px-5 py-3',
          )}
        >
          <div className="min-w-0 flex-1">
            {chatVisible ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground/10 text-foreground dark:text-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight text-foreground">Workflow AI</p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    Describe a workflow and it's drafted onto the canvas
                  </p>
                </div>
              </div>
            ) : executionPanelOpen && !generate ? (
              <TooltipProvider delayDuration={200}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground/10 text-foreground">
                    <Play className="h-3 w-3 fill-current" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">Run chat</p>
                    <p className="truncate text-[11px] leading-tight text-muted-foreground">
                      Send a message to run this workflow
                    </p>
                  </div>
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
          {generate && !chatVisible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setShowDetailsOverChat(false)}
              aria-label="Back to Workflow AI"
              title="Back to Workflow AI"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
          {generate && chatVisible && !embedded && onChatExpandedChange && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              onClick={() => setChatExpanded((value) => !value)}
              aria-label={chatExpanded ? 'Exit full screen' : 'Expand Workflow AI to the workspace'}
              title={chatExpanded ? 'Exit full screen (Esc)' : 'Expand to workspace'}
            >
              {chatExpanded ? (
                <Minimize className="h-[17px] w-[17px]" strokeWidth={1.5} />
              ) : (
                <Maximize className="h-[17px] w-[17px]" strokeWidth={1.5} />
              )}
            </Button>
          )}
          {generate && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
              onClick={() => {
                setChatExpanded(false)
                generate.onClose()
              }}
              aria-label="Close Workflow AI"
              title="Close"
            >
              <CloseIcon className="h-[17px] w-[17px]" />
            </Button>
          )}
          {!embedded && !chatVisible && (
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
          )}
        </div>

        <div className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
          {generate && (
            <div className={cn('flex h-full', !chatVisible && 'hidden')}>
              {chatExpanded && generate.chats ? <ChatList chats={generate.chats} /> : null}
              <div className={cn('h-full min-w-0 flex-1', chatExpanded && 'mx-auto max-w-3xl')}>
              <GenerateWorkflowChat
                key={generate.chats?.activeId}
                messages={generate.messages}
                onMessagesChange={generate.onMessagesChange}
                model={generate.model}
                onModelChange={generate.onModelChange}
                serverModel={serverModelConfig.model}
                ollamaBaseUrl={generate.ollamaBaseUrl}
                pages={doc.pages}
                activePageId={doc.activePageId}
                llmConfigured={llmConfigured}
                replacesCanvas={generate.replacesCanvas}
                getCurrentWorkflow={generate.getCurrentWorkflow}
                onGenerated={generate.onGenerated}
              />
              </div>
            </div>
          )}
          {chatVisible ? null : generate ? (
            detailsContent
          ) : executionPanelOpen ? (
            execution ? (
              <ExecutionSidebarPanel
                testInput={execution.testInput}
                onTestInputChange={execution.onTestInputChange}
                onExecute={execution.onExecute}
                isExecuting={execution.isExecuting}
                canExecute={execution.canExecute}
                runStatus={execution.runStatus}
                runId={execution.runId}
                onCancel={execution.onCancel}
                approvalPrompt={execution.approvalPrompt}
                onSubmitApproval={execution.onSubmitApproval}
                onSubmitFeedback={execution.onSubmitFeedback}
                stepOutputs={execution.stepOutputs}
                trace={execution.trace}
                messages={execution.messages}
                history={execution.history}
                finalResponse={execution.finalResponse}
                errors={execution.errors}
                onShowDetails={execution.onShowDetails}
              />
            ) : (
              <div className="p-4 text-xs text-muted-foreground">Execution controls unavailable.</div>
            )
          ) : attaching && attachCapability ? (
            <AttachCapabilityPanel
              agentLabel={attachCapability.agentLabel}
              initialKind={attachCapability.initialKind}
              attachedIds={attachCapability.attachedIds}
              onAttach={attachCapability.onAttach}
              onClose={attachCapability.onClose}
            />
          ) : (
            detailsContent
          )}
        </div>
      </div>
    </aside>
  )
})

export function DetailsPanelContent({
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
  serverModelConfig,
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
  serverModelConfig: WorkflowModelConfig
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

  if (selection?.kind === 'node' && selectedNode && isFlowBoundaryNode(selectedNode)) {
    return <FlowBoundaryState node={selectedNode} diagram={diagram} />
  }

  if (selection?.kind === 'node' && selectedNode && isSwitchNode(selectedNode)) {
    return <SwitchConfigPanel node={selectedNode} diagram={diagram} onChange={onChange} />
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
    return <AgentConfigPanel node={selectedNode} diagram={diagram} onChange={onChange} />
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
      executionType={resolveExecutionType(workflowMeta?.executionType, diagram)}
      runsAsGraph={isGraphWorkflow(diagram)}
      patternSetBy={(() => {
        const orchestration = findOrchestration(diagram)
        return orchestration ? diagram.nodes.find((node) => node.id === orchestration.orchestratorId)?.label : undefined
      })()}
      onExecutionTypeChange={(type: WorkflowExecutionType) =>
        onWorkflowMetaChange?.({ executionType: type })
      }
      modelConfig={modelConfig}
      serverModelConfig={serverModelConfig}
      onModelConfigChange={onModelConfigChange}
      modelConfigReadOnly={!onModelConfigChange}
      llmConfigured={llmConfigured}
      workflowId={pageWorkflowId(doc, doc.activePageId)}
      pageCount={doc.pages.length}
      nodeCount={diagram.nodes.length}
      edgeCount={diagram.edges.length}
    />
  )
}

function FlowBoundaryState({ node, diagram }: { node: DiagramNode; diagram: Diagram }) {
  const start = isStartFlowNode(node)
  const Icon = start ? Play : Flag
  const linkedId = start
    ? diagram.edges.find((edge) => edge.from === node.id)?.to
    : diagram.edges.find((edge) => edge.to === node.id)?.from
  const linkedLabel = linkedId ? diagram.nodes.find((item) => item.id === linkedId)?.label : undefined

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <Icon className={cn('h-5 w-5', start && 'ml-0.5 fill-current')} />
      </div>
      <p className="text-sm font-medium text-foreground">
        {start ? 'Workflow entry' : 'Workflow completion'}
      </p>
      <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
        {start
          ? 'The agent or executor connected from Start runs first.'
          : 'Connect the final step into End to mark where the workflow completes.'}
      </p>
      <p className="mt-4 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        {linkedLabel
          ? `${start ? 'Starts with' : 'Ends after'} ${linkedLabel}`
          : 'Not connected yet'}
      </p>
    </div>
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
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/10 text-foreground dark:text-foreground">
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
