import { Bot, GitBranch, Play, Settings2, Spline, Terminal, Wrench } from 'lucide-react'
import { DetailsPanelContent } from '@/components/agent-workflow/AgentPropertiesShell'
import { AttachCapabilityPanel } from '@/components/agent-workflow/AttachCapabilityPanel'
import { ExecutionSidebarPanel } from '@/components/agent-workflow/ExecutionSidebarPanel'
import type { AgentCapability, AgentCapabilityKind } from '@/components/agent-workflow/agent-capabilities'
import type { CanvasFocus } from '@/components/agent-workflow/canvas-focus'
import { agentLabel, isExecutorNode, isMcpToolNode, isToolNode } from '@/components/agent-workflow/tool-agent-mapping'
import { isSubWorkflowNode } from '@/components/agent-workflow/sub-workflow-ops'
import { isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import { ModelProviderLogo, resolveModelProvider } from '@/components/agent-workflow/model-providers'
import type { Diagram, DiagramDocument } from '@/components/designer/diagram-types'
import type { AgentWorkflowMeta, WorkflowRunState } from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

/** What the editor has opened on the canvas (desktop): a node, a connector, the run, or settings. */
export type EditorFocus =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'run' }
  | { kind: 'settings' }

const RUN_STATUS_LABELS: Record<WorkflowRunState['status'], string> = {
  idle: 'Enter an input and run the workflow',
  running: 'Running…',
  'waiting-approval': 'Waiting for your approval',
  completed: 'Run completed',
  failed: 'Run failed',
  cancelled: 'Run cancelled',
}

interface BuildFocusArgs {
  focus: EditorFocus | null
  diagram: Diagram
  doc: DiagramDocument
  onChange: (updater: (previous: Diagram) => Diagram) => void
  onClose: () => void
  onOpenSubWorkflow: (pageId: string) => void
  onWorkflowMetaChange: (patch: Partial<AgentWorkflowMeta>) => void
  onModelConfigChange: (patch: Partial<WorkflowModelConfig>) => void
  serverModelConfig: WorkflowModelConfig
  llmConfigured: boolean
  attach: {
    agentId: string
    kind: AgentCapabilityKind
    attachedIds: string[]
    onAttach: (capability: AgentCapability) => void
    onClose: () => void
  } | null
  run: {
    state: WorkflowRunState
    testInput: string
    onTestInputChange: (value: string) => void
    onExecute: () => void
    isExecuting: boolean
    canExecute: boolean
    onCancel: () => void
    onSubmitApproval: (value: string) => void
    onSubmitFeedback: (value: string) => void
    onShowDetails: () => void
  }
}

/**
 * The card the canvas shows for the editor's focus. Node, connector and settings cards reuse
 * the panels the right sidebar used to show; the run card is the run chat, opened from Start.
 */
export function buildCanvasFocus(args: BuildFocusArgs): CanvasFocus | null {
  const { focus, diagram, doc, onChange, onClose } = args
  if (!focus) return null
  const workflowMeta = doc.workflow
  const modelConfig = workflowMeta?.modelConfig ?? args.serverModelConfig

  const details = (selection: Parameters<typeof DetailsPanelContent>[0]['selection'], extra?: object) => (
    <DetailsPanelContent
      multiSelectCount={0}
      canConvertToSubWorkflow={false}
      selection={selection}
      doc={doc}
      diagram={diagram}
      onChange={onChange}
      onOpenSubWorkflow={args.onOpenSubWorkflow}
      workflowMeta={workflowMeta}
      modelConfig={modelConfig}
      serverModelConfig={args.serverModelConfig}
      onWorkflowMetaChange={args.onWorkflowMetaChange}
      onModelConfigChange={args.onModelConfigChange}
      llmConfigured={args.llmConfigured}
      {...extra}
    />
  )

  if (focus.kind === 'run') {
    const start = diagram.nodes.find(isStartFlowNode)
    const { run } = args
    return {
      key: 'run',
      target: start ? { kind: 'node', id: start.id } : { kind: 'center' },
      title: 'Run workflow',
      subtitle: RUN_STATUS_LABELS[run.state.status],
      icon: <Play className="fill-current" />,
      width: 460,
      layout: 'fill',
      onClose,
      content: (
        <ExecutionSidebarPanel
          testInput={run.testInput}
          onTestInputChange={run.onTestInputChange}
          onExecute={run.onExecute}
          isExecuting={run.isExecuting}
          canExecute={run.canExecute}
          runStatus={run.state.status}
          runId={run.state.runId}
          onCancel={run.onCancel}
          approvalPrompt={run.state.approvalPrompt}
          onSubmitApproval={run.onSubmitApproval}
          onSubmitFeedback={run.onSubmitFeedback}
          stepOutputs={run.state.stepOutputs}
          trace={run.state.trace}
          messages={run.state.messages}
          finalResponse={run.state.finalResponse}
          errors={run.state.errors}
          onShowDetails={run.onShowDetails}
          emptyHint="Each agent lights up on the canvas as it runs. The full trace and logs are in the bottom panel."
        />
      ),
    }
  }

  if (focus.kind === 'settings') {
    return {
      key: 'settings',
      target: { kind: 'center' },
      title: 'Workflow settings',
      subtitle: 'Execution type and model for this workflow',
      icon: <Settings2 />,
      onClose,
      content: details(null),
    }
  }

  if (focus.kind === 'edge') {
    const edge = diagram.edges.find((candidate) => candidate.id === focus.id)
    if (!edge) return null
    const fromLabel = diagram.nodes.find((node) => node.id === edge.from)?.label ?? 'Source'
    const toLabel = diagram.nodes.find((node) => node.id === edge.to)?.label ?? 'Target'
    return {
      key: `edge:${edge.id}`,
      target: { kind: 'edge', id: edge.id },
      title: 'Connector',
      subtitle: `${fromLabel} → ${toLabel}`,
      icon: <Spline />,
      width: 400,
      onClose,
      content: details({ kind: 'edge', id: edge.id }, { selectedEdge: edge, fromLabel, toLabel }),
    }
  }

  const node = diagram.nodes.find((candidate) => candidate.id === focus.id)
  if (!node) return null
  const attaching = args.attach?.agentId === node.id ? args.attach : null
  const subtitle = isToolNode(node)
    ? `${isMcpToolNode(node) ? 'MCP tool · ' : ''}Under ${agentLabel(diagram, node.mappedAgentId)}`
    : isExecutorNode(node)
      ? 'Executor'
      : isSubWorkflowNode(node)
        ? 'Sub-workflow'
        : node.agent
          ? 'Agent'
          : null
  const Icon = isToolNode(node)
    ? Wrench
    : isExecutorNode(node)
      ? Terminal
      : isSubWorkflowNode(node)
        ? GitBranch
        : Bot
  // An agent shows its model client's logo, matching the collapsed node.
  const provider = node.agent && !isToolNode(node) && !isExecutorNode(node) ? resolveModelProvider(node.agent) : undefined
  return {
    key: `node:${node.id}${attaching ? ':attach' : ''}`,
    target: { kind: 'node', id: node.id },
    title: attaching ? `Attach to ${node.label}` : node.label || 'Node',
    subtitle: attaching
      ? 'Add tools, skills, memory or integrations'
      : provider
        ? `${subtitle ?? 'Agent'} · ${provider.label}`
        : subtitle,
    icon: provider ? <ModelProviderLogo provider={provider} className="size-9" /> : <Icon />,
    onClose,
    content: attaching ? (
      <AttachCapabilityPanel
        agentLabel={node.label}
        initialKind={attaching.kind}
        attachedIds={attaching.attachedIds}
        onAttach={attaching.onAttach}
        onClose={attaching.onClose}
      />
    ) : (
      details({ kind: 'node', id: node.id }, { selectedNode: node })
    ),
  }
}
