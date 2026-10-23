import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppConfig } from '@/hooks/use-app-config'
import { selectedNodeIds, type Selection } from '@/components/designer/selection-utils'
import { ShareDialog } from '@/components/designer/ShareDialog'
import { PagesBar } from '@/components/designer/PagesBar'
import { resolveDesignerPalette } from '@/utils/resolve-designer-palette'
import {
  createNodeId,
  resolveFlowDirection,
  type Diagram,
  type DiagramNode,
  type FlowDirection,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type {
  AgentWorkflowMeta,
  WorkflowDeployment,
  WorkflowValidationIssue,
} from '@/types/agent-workflow'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import {
  resolveWorkflowModelConfig,
  workflowActiveModelConfig,
  isLocalModel,
  OLLAMA_DEFAULT_URL,
} from '@/components/agent-workflow/workflow-model-config'
import { AgentWorkflowHeader, type EditorView } from '@/components/agent-workflow/AgentWorkflowHeader'
import { WorkspaceStatusBar } from '@/components/agent-workflow/WorkspaceStatusBar'
import { AgentLibrarySidebar } from '@/components/agent-workflow/AgentLibrarySidebar'
import { AgentPropertiesShell } from '@/components/agent-workflow/AgentPropertiesShell'
import {
  BottomInspectorPanel,
  type InspectorTab,
} from '@/components/agent-workflow/BottomInspectorPanel'
import { ExecutionFlowCanvas } from '@/components/agent-workflow/ExecutionFlowCanvas'
import { getExecutablePlan } from '@/components/agent-workflow/build-execution-plan'
import { useWorkflowRunner } from '@/components/agent-workflow/use-workflow-runner'
import {
  AgentWorkflowCanvas,
  type AgentWorkflowCanvasHandle,
} from '@/components/agent-workflow/AgentWorkflowCanvas'
import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
  createWorkflowId,
  enrichAgentNode,
  enrichDiagram,
  flowNodeSize,
  TOOL_NODE_HEIGHT,
  TOOL_NODE_WIDTH,
  TOOL_PALETTE_ID,
  isMappedToolPalette,
} from '@/components/agent-workflow/agent-workflow-defaults'
import {
  createFlowBoundaryNode,
  END_NODE_PALETTE_ID,
  FLOW_BOUNDARY_HEIGHT,
  FLOW_BOUNDARY_WIDTH,
  findEndNode,
  isStartFlowNode,
} from '@/components/agent-workflow/workflow-flow-nodes'
import { findStartNode, START_NODE_PALETTE_ID } from '@/components/agent-workflow/workflow-start'
import { buildCanvasFocus, type EditorFocus } from '@/components/agent-workflow/editor-focus'
import {
  modelForProvider,
  modelProviderById,
  resolveModelProvider,
  type ModelProviderId,
} from '@/components/agent-workflow/model-providers'
import { placeAfterStart, startEdge, withStartNode } from '@/components/agent-workflow/workflow-start-node'
import type { NodeRunStatus } from '@/components/agent-workflow/canvas-focus'
import { SelectAgentDialog } from '@/components/agent-workflow/SelectAgentDialog'
import type { AgentCapability, AgentCapabilityKind } from '@/components/agent-workflow/agent-capabilities'
import type { AgentAttachAction } from '@/components/agent-workflow/AgentNodeCard'
import { insertHitlOnEdge, HITL_PALETTE_ID } from '@/components/agent-workflow/insert-hitl-on-edge'
import {
  ConvertSubWorkflowDialog,
  InsertWorkflowDialog,
} from '@/components/agent-workflow/InsertWorkflowDialog'
import type { GenerateChatMessage } from '@/components/agent-workflow/GenerateWorkflowChat'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import {
  WorkflowTemplateGrid,
  WorkflowTemplatesDialog,
} from '@/components/agent-workflow/WorkflowTemplatesDialog'
import type { WorkflowTemplate } from '@/components/agent-workflow/agent-workflow-templates'
import { diagramFromGenerationPlanSafe } from '@/components/agent-workflow/workflow-from-generation'
import {
  keepAgentSettings,
  planFromDiagram,
  type CanvasPlan,
} from '@/components/agent-workflow/workflow-plan-from-diagram'
import { Button } from '@/components/ui/button'
import { BookOpen, Copy, Database, Play, Settings2, Trash2, Unlink, Wrench } from 'lucide-react'
import {
  NodeContextMenu,
  type NodeContextMenuState,
  type NodeMenuEntry,
} from '@/components/agent-workflow/NodeContextMenu'
import { diagramContentCenter } from '@/components/agent-workflow/sub-workflow-ops'
import {
  attachToolToAgent,
  isAgentNode,
  isToolNode,
  listAgentNodes,
  pickAgentForToolPlacement,
  removeToolsMappedToAgent,
} from '@/components/agent-workflow/tool-agent-mapping'
import { inferWorkflowType, validateWorkflow } from '@/components/agent-workflow/validate-workflow'
import { layoutWorkflowDiagram } from '@/components/agent-workflow/workflow-layout'
import {
  AGENT_WORKFLOW_TOOL_ID,
  clearExecutionSnapshot,
  mergeDiagramIntoDocument,
  saveWorkflowDocument,
} from '@/components/agent-workflow/workflow-storage'
import { useWorkflowEditorPanels } from '@/components/agent-workflow/hooks/use-workflow-editor-panels'
import { useWorkflowDocument } from '@/components/agent-workflow/hooks/use-workflow-document'
import { persistWorkflowBuildSpec } from '@/components/agent-workflow/workflow-build-storage'
import { buildOrchestrationDocument } from '@/components/agent-workflow/build-orchestration-document'
import { orchestrationIdentity, saveOrchestration } from '@/services/orchestration-api'
import { MobileAppDrawer } from '@/components/agent-workflow/MobileAppDrawer'
import { MobilePageShell } from '@/components/agent-workflow/MobilePageShell'
import { MobileWorkspaceHeader } from '@/components/agent-workflow/MobileWorkspaceHeader'
import {
  MobileWorkspaceNav,
  mobileTabFromPath,
} from '@/components/agent-workflow/MobileWorkspaceNav'
import { useServerLlmConfig } from '@/hooks/use-server-llm-config'
import { useWorkspaceBreakpoint } from '@/hooks/use-workspace-breakpoint'
import { useSubWorkflowActions } from '@/components/agent-workflow/hooks/use-sub-workflow-actions'
import { useUnsavedWorkflowGuard } from '@/components/agent-workflow/hooks/use-unsaved-workflow-guard'
import { UnsavedChangesDialog } from '@/components/agent-workflow/UnsavedChangesDialog'
import type { WorkflowEditorViewMode } from '@/components/agent-workflow/WorkflowEditorViewToggle'
import { WorkflowBuildCodeView } from '@/components/agent-workflow/WorkflowBuildCodeView'
import { DevProfiler } from '@/utils/render-profiler'
import { APP_NAME, ROUTES } from '@/constants'
import { getSession } from '@/services/project-auth-store'
import { DeploymentsCanvasView } from '@/components/agent-workflow/DeploymentsCanvasView'
import type { BlocksTab, LibrarySection } from '@/components/agent-workflow/AgentLibrarySidebar'
import {
  getNextPublishedVersion,
  publishWorkflowInstance,
} from '@/services/published-instances-store'

const TOOL_ID = AGENT_WORKFLOW_TOOL_ID

function isValidWorkflowInput(raw: string): boolean {
  return raw.trim().length > 0
}

function defaultWorkflowMeta(): AgentWorkflowMeta {
  return {
    workflowId: createWorkflowId(),
    version: 1,
    status: 'draft',
    executionType: 'sequential',
  }
}

export default function AgentWorkflowPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { megaMenu } = useAppConfig()
  const tool = useMemo(
    () => megaMenu.tools.find((candidate) => candidate.route === `/tools/${TOOL_ID}`),
    [megaMenu.tools],
  )

  const { palette } = useMemo(() => resolveDesignerPalette(tool, TOOL_ID), [tool])
  const paletteById = useMemo(() => {
    const map = new Map<string, PaletteItem>()
    palette.forEach((item) => map.set(item.id, item))
    return map
  }, [palette])

  const [selection, setSelection] = useState<Selection>(null)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [validationIssues, setValidationIssues] = useState<WorkflowValidationIssue[]>([])
  const [isValidated, setIsValidated] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [testInput, setTestInput] = useState('Summarize the quarterly report')
  const [agentPickOpen, setAgentPickOpen] = useState(false)
  const [attachTarget, setAttachTarget] = useState<{
    agentId: string
    kind: AgentCapabilityKind
  } | null>(null)
  const [generatePanelOpen, setGeneratePanelOpen] = useState(false)
  // Desktop: what is opened as a card on the canvas (replaces the right details panel).
  const [editorFocus, setEditorFocus] = useState<EditorFocus | null>(null)
  // The node actions menu (right-click on a node, or "⋯" on its expanded card).
  const [nodeMenu, setNodeMenu] = useState<NodeContextMenuState | null>(null)
  const [generateMessages, setGenerateMessages] = useState<GenerateChatMessage[]>([])
  // Null until the user picks one; defaults to the workflow's local model when it has one.
  const [generateModelChoice, setGenerateModelChoice] = useState<GenerateWorkflowModel | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [appMenuOpen, setAppMenuOpen] = useState(false)
  const [librarySection, setLibrarySection] = useState<LibrarySection | null>(null)
  // The Built-in blocks tab, the agent a picked model client goes to (from its model slot), and
  // a picked model client waiting for the user to choose an agent.
  const [libraryBlocksTab, setLibraryBlocksTab] = useState<BlocksTab>('blocks')
  const [modelTargetAgentId, setModelTargetAgentId] = useState<string | null>(null)
  const [modelPickProvider, setModelPickProvider] = useState<ModelProviderId | null>(null)
  // The template picker: closed by default on desktop (the canvas offers "Add first agent" and a
  // Templates button), shown by default on mobile. null = not chosen yet.
  const [showCanvasEmptyState, setShowCanvasEmptyState] = useState<boolean | null>(null)
  const showDeploymentsBoard = librarySection === 'deployments'
  const [executionPanelOpen, setExecutionPanelOpen] = useState(false)
  const [editorView, setEditorView] = useState<WorkflowEditorViewMode>('canvas')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('trace')
  const { state: runState, start: startExecution, submitApproval, submitFeedback, cancel: cancelExecution, reset: resetExecution } =
    useWorkflowRunner()
  const { modelConfig: serverModelConfig, configured: llmConfigured, isLoading: llmConfigLoading } =
    useServerLlmConfig()

  const { left, right, bottom } = useWorkflowEditorPanels()
  const expandLeftPanel = left.expand
  const { isMobile } = useWorkspaceBreakpoint()
  const mobileTab = mobileTabFromPath(location.pathname)
  const noopPointer = useCallback(() => {}, [])

  useEffect(() => {
    if (!isMobile) {
      if (location.pathname !== ROUTES.agentWorkflow) {
        navigate(ROUTES.agentWorkflow, { replace: true })
      }
      return
    }
    left.collapse()
    right.collapse()
    bottom.collapse()
  }, [
    isMobile,
    location.pathname,
    navigate,
    left.collapse,
    right.collapse,
    bottom.collapse,
  ])
  /** Keep the right panel open for workflow settings / execution when nothing is selected. */
  const keepRightOpenRef = useRef(false)

  const invalidateValidation = useCallback(() => setIsValidated(false), [])

  const {
    doc,
    setDoc,
    activePage,
    diagram,
    workflowName,
    handleChange,
    handleUndo,
    handleRedo,
    selectPage,
    addMainPage,
    addSubPage,
    createWorkflowTab,
    createNewWorkspace,
    renamePage,
    setActiveMainPage,
    deletePage,
  } = useWorkflowDocument(paletteById, invalidateValidation)

  const unsavedGuard = useUnsavedWorkflowGuard(doc, testInput)
  const {
    isDirty,
    dialogOpen: unsavedDialogOpen,
    setDialogOpen: setUnsavedDialogOpen,
    isSaving: isUnsavedSaving,
    guardAction,
    closeDialog: closeUnsavedDialog,
    discardPending,
    saveAndContinue,
    markSaved,
    registerSaveHandler,
  } = unsavedGuard

  const handleWorkflowMetaChange = useCallback(
    (patch: Partial<AgentWorkflowMeta>) => {
      invalidateValidation()
      setDoc((previous) => ({
        ...previous,
        workflow: {
          ...(previous.workflow ?? defaultWorkflowMeta()),
          ...patch,
        },
      }))
    },
    [setDoc, invalidateValidation],
  )

  const handleModelConfigChange = useCallback(
    (patch: Partial<WorkflowModelConfig>) => {
      invalidateValidation()
      setDoc((previous) => {
        const workflow = previous.workflow ?? defaultWorkflowMeta()
        return {
          ...previous,
          workflow: {
            ...workflow,
            modelConfig: resolveWorkflowModelConfig({ ...workflow.modelConfig, ...patch }),
          },
        }
      })
    },
    [setDoc, invalidateValidation],
  )

  const openWorkflowSettings = useCallback(() => {
    keepRightOpenRef.current = true
    setSelection(null)
    if (isMobile) {
      navigate(ROUTES.agentWorkflowInspect)
      return
    }
    setEditorFocus({ kind: 'settings' })
  }, [isMobile, navigate])

  const openGeneratePanel = useCallback(() => {
    keepRightOpenRef.current = true
    setGeneratePanelOpen(true)
    if (isMobile) {
      navigate(ROUTES.agentWorkflowInspect)
      return
    }
    right.expand()
  }, [isMobile, navigate, right])

  const closeGeneratePanel = useCallback(() => setGeneratePanelOpen(false), [])

  // ⌘/Ctrl + K toggles the Workflow AI chat.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return
      if (event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      if (generatePanelOpen) closeGeneratePanel()
      else openGeneratePanel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [generatePanelOpen, openGeneratePanel, closeGeneratePanel])

  const canvasRef = useRef<AgentWorkflowCanvasHandle>(null)

  const getCanvasInsertAnchor = useCallback(
    () => canvasRef.current?.getInsertAnchor() ?? diagramContentCenter(diagram),
    [diagram],
  )

  const subWorkflow = useSubWorkflowActions({
    doc,
    diagram,
    selection,
    setDoc,
    setSelection,
    setIsValidated,
    handleChange,
    getCanvasInsertAnchor,
  })

  const workflowMeta = doc.workflow ?? defaultWorkflowMeta()
  const toolbarModelConfig = useMemo(
    () => workflowActiveModelConfig(workflowMeta, serverModelConfig),
    [workflowMeta, serverModelConfig],
  )
  const toolbarModelConfigured = isLocalModel(toolbarModelConfig)
    ? Boolean(toolbarModelConfig.model.trim())
    : llmConfigured
  const inferredType = useMemo(() => inferWorkflowType(diagram), [diagram])

  useEffect(() => {
    if (tool) document.title = `${tool.title} — ${APP_NAME}`
  }, [tool])

  const showExecutionLogs = useCallback(() => {
    setInspectorTab('logs')
    bottom.expand()
    if (isMobile) navigate(ROUTES.agentWorkflowLogs)
  }, [bottom, isMobile, navigate])

  useEffect(() => {
    if (runState.status === 'waiting-approval') {
      keepRightOpenRef.current = true
      setExecutionPanelOpen(true)
      if (isMobile) {
        setGeneratePanelOpen(false)
        right.expand()
      } else {
        setEditorFocus({ kind: 'run' })
      }
    }
  }, [runState.status, right.expand, isMobile])

  const handleSelectionChange = useCallback((next: Selection) => {
    setSelection(next)
    setAttachTarget((current) => {
      if (!current) return null
      if (next?.kind === 'node' && next.id === current.agentId) return current
      return null
    })
  }, [])

  // Desktop: the right panel only hosts Workflow AI; details open as cards on the canvas.
  // Mobile: expand details when a node/edge is selected; collapse when the canvas is cleared.
  useEffect(() => {
    if (!isMobile) {
      if (generatePanelOpen) right.expand()
      else right.collapse()
      return
    }
    const hasSelection = selection !== null
    if (hasSelection) {
      keepRightOpenRef.current = false
      right.expand()
      return
    }
    if (keepRightOpenRef.current || executionPanelOpen || generatePanelOpen) {
      right.expand()
      return
    }
    right.collapse()
  }, [selection, executionPanelOpen, generatePanelOpen, right.expand, right.collapse, isMobile])

  const handleSelectPage = useCallback(
    (pageId: string) => {
      selectPage(pageId)
      setSelection(null)
    },
    [selectPage],
  )

  const handleNavigateHome = useCallback(() => {
    guardAction(() => navigate('/'))
  }, [guardAction, navigate])

  const toggleCodeView = useCallback(
    () => setEditorView((previous) => (previous === 'code' ? 'canvas' : 'code')),
    [],
  )

  const handleCreateWorkflowTab = useCallback(() => {
    createWorkflowTab()
  }, [createWorkflowTab])

  const handleAddMainPage = useCallback(() => {
    addMainPage()
    setSelection(null)
  }, [addMainPage])

  const handleAddSubToMain = useCallback(
    (pageId: string) => {
      addSubPage(pageId)
      setSelection(null)
    },
    [addSubPage],
  )

  const handleAddPage = useCallback(() => {
    handleAddMainPage()
  }, [handleAddMainPage])

  const handleCreateNewWorkspace = useCallback(() => {
    createNewWorkspace()
    setSelection(null)
    setEditorView('canvas')
    resetExecution()
    setExecutionPanelOpen(false)
  }, [createNewWorkspace, resetExecution])

  const handleDeletePage = useCallback(
    (pageId: string) => {
      deletePage(pageId)
      setSelection(null)
    },
    [deletePage],
  )

  const handleSetActiveMain = useCallback(
    (pageId: string) => {
      setActiveMainPage(pageId)
      setSelection(null)
    },
    [setActiveMainPage],
  )

  const addToolForAgent = useCallback(
    (
      agentId: string,
      options?: {
        paletteId?: string
        label?: string
        toolId?: string
        mcpUrl?: string
      },
    ) => {
      const paletteId = options?.paletteId ?? TOOL_PALETTE_ID
      const item = paletteById.get(paletteId)
      if (!item) return
      const nodeId = createNodeId()
      const label = options?.label ?? item.label
      handleChange((previous) => {
        const base: DiagramNode = {
          id: nodeId,
          paletteId,
          label,
          x: 0,
          y: 0,
        }
        let node = enrichAgentNode(base, item)
        if (node.agent) {
          node = {
            ...node,
            agent: {
              ...node.agent,
              ...(options?.mcpUrl ? { mcpUrl: options.mcpUrl } : {}),
              ...(options?.toolId ? { tools: [options.toolId] } : {}),
            },
          }
        }
        node = attachToolToAgent(previous, node, agentId)
        const nodes = previous.nodes.map((candidate) => {
          if (candidate.id !== agentId || !candidate.agent || !options?.toolId) return candidate
          if (candidate.agent.tools.includes(options.toolId)) return candidate
          return {
            ...candidate,
            agent: {
              ...candidate.agent,
              tools: [...candidate.agent.tools, options.toolId],
            },
          }
        })
        return { ...previous, nodes: [...nodes, node] }
      })
      setSelection({ kind: 'node', id: nodeId })
    },
    [paletteById, handleChange],
  )

  const attachCapabilityToAgent = useCallback(
    (agentId: string, capability: AgentCapability) => {
      addToolForAgent(agentId, {
        paletteId: capability.paletteId,
        label: capability.nodeLabel ?? capability.label,
        toolId: capability.id,
        mcpUrl: capability.mcpUrl,
      })
      toast.success(`Added ${capability.label} under the agent`)
    },
    [addToolForAgent],
  )

  const handleAgentAttachAction = useCallback(
    (agentId: string, action: AgentAttachAction) => {
      setSelection({ kind: 'node', id: agentId })
      if (action === 'model' && !isMobile) {
        // The model slot: open the model clients, picking for this agent.
        setModelTargetAgentId(agentId)
        setLibraryBlocksTab('models')
        setLibrarySection('blocks')
        expandLeftPanel()
        return
      }
      if (isMobile) right.expand()
      else setEditorFocus({ kind: 'node', id: agentId })

      if (action === 'config' || action === 'model') {
        setAttachTarget(null)
        if (isMobile) toast.success('Opened the agent configuration panel')
        return
      }

      const kind: AgentCapabilityKind =
        action === 'knowledge'
          ? 'skill'
          : action === 'tool' ||
              action === 'skill' ||
              action === 'integration' ||
              action === 'memory' ||
              action === 'mcp'
            ? action
            : 'tool'

      setAttachTarget({ agentId, kind })
    },
    [right.expand, isMobile, expandLeftPanel],
  )

  /** Run an agent on a model client, keeping its model if the client offers it. */
  const assignModelProvider = useCallback(
    (agentId: string, providerId: ModelProviderId) => {
      const provider = modelProviderById(providerId)
      const agentNode = diagram.nodes.find((node) => node.id === agentId)
      if (!provider || !agentNode?.agent || !isAgentNode(agentNode)) return
      const model = modelForProvider(provider, agentNode.agent.model)
      handleChange((previous) => ({
        ...previous,
        nodes: previous.nodes.map((node) =>
          node.id === agentId && node.agent
            ? { ...node, agent: { ...node.agent, modelProvider: provider.id, model } }
            : node,
        ),
      }))
      toast.success(`${agentNode.label} runs on ${provider.label} · ${model}`)
    },
    [diagram.nodes, handleChange],
  )

  /** A model client picked in the library goes to the agent it was opened for, else the open,
   *  selected or only agent; otherwise the user chooses one. */
  const handlePickModelProvider = useCallback(
    (providerId: ModelProviderId) => {
      const agents = listAgentNodes(diagram)
      const isAgent = (id: string | null | undefined) => Boolean(id && agents.some((agent) => agent.id === id))
      const focusedId = editorFocus?.kind === 'node' ? editorFocus.id : null
      const selectedId = selection?.kind === 'node' ? selection.id : null
      const target = [modelTargetAgentId, focusedId, selectedId].find(isAgent) ?? (agents.length === 1 ? agents[0].id : null)
      if (target) {
        assignModelProvider(target, providerId)
        return
      }
      if (agents.length === 0) {
        toast.error('Add an agent first, then choose its model client')
        return
      }
      setModelPickProvider(providerId)
    },
    [diagram, editorFocus, selection, modelTargetAgentId, assignModelProvider],
  )

  const modelTargetNode = modelTargetAgentId
    ? diagram.nodes.find((node) => node.id === modelTargetAgentId)
    : undefined
  const modelTargetLabel = modelTargetNode?.label
  const modelTargetProviderId = resolveModelProvider(modelTargetNode?.agent)?.id

  // The model-client target only lasts while the library's blocks section is open.
  useEffect(() => {
    if (librarySection !== 'blocks') setModelTargetAgentId(null)
  }, [librarySection])

  const handleInsertHitlOnEdge = useCallback(
    (edgeId: string) => {
      const item = paletteById.get(HITL_PALETTE_ID)
      if (!item) {
        toast.error('Human Review block is not available in the palette')
        return
      }
      let insertedId: string | null = null
      handleChange((previous) => {
        const result = insertHitlOnEdge(previous, edgeId, item)
        if (!result) return previous
        insertedId = result.nodeId
        return result.diagram
      })
      if (insertedId) {
        setSelection({ kind: 'node', id: insertedId })
        toast.success('Added human-in-the-loop review on this connector')
      }
    },
    [paletteById, handleChange],
  )

  const addBlock = useCallback(
    (paletteId: string) => {
      const item = paletteById.get(paletteId)
      if (!item) return

      if (isMappedToolPalette(paletteId)) {
        const agents = listAgentNodes(diagram)
        if (agents.length === 0) {
          toast.error('Add an agent before adding tools')
          return
        }
        if (agents.length === 1) {
          addToolForAgent(agents[0].id, { paletteId })
          return
        }
        setAgentPickOpen(true)
        return
      }

      if (paletteId === START_NODE_PALETTE_ID && findStartNode(diagram)) {
        toast.message('Start is already on this workflow tab')
        return
      }
      if (paletteId === END_NODE_PALETTE_ID && findEndNode(diagram)) {
        toast.message('End is already on this workflow tab')
        return
      }

      const anchor = getCanvasInsertAnchor()
      const offset = (diagram.nodes.length % 5) * 20
      const base: DiagramNode =
        paletteId === START_NODE_PALETTE_ID || paletteId === END_NODE_PALETTE_ID
          ? createFlowBoundaryNode(
              paletteId,
              anchor.x - FLOW_BOUNDARY_WIDTH / 2 + offset,
              anchor.y - FLOW_BOUNDARY_HEIGHT / 2 + offset,
              item.label,
            )
          : (() => {
              const size = flowNodeSize(
                { id: '', paletteId, label: item.label, x: 0, y: 0 },
                diagram.direction,
              )
              // The first agent goes right after Start (and is connected to it below).
              const afterStart = placeAfterStart(diagram, size)
              return {
                id: createNodeId(),
                paletteId,
                label: item.label,
                x: afterStart ? afterStart.x : anchor.x - size.width / 2 + offset,
                y: afterStart ? afterStart.y : anchor.y - size.height / 2 + offset,
                ...size,
              }
            })()
      const node = enrichAgentNode(base, item)
      handleChange((previous) => ({ ...previous, nodes: [...previous.nodes, node] }))
      setSelection({ kind: 'node', id: node.id })
    },
    [paletteById, diagram, handleChange, addToolForAgent, getCanvasInsertAnchor],
  )

  const zoomBy = useCallback((factor: number) => {
    canvasRef.current?.zoomBy(factor)
  }, [])

  const runAutoLayout = useCallback(() => {
    handleChange((previous) =>
      layoutWorkflowDiagram(previous, resolveFlowDirection(previous.direction)),
    )
    requestAnimationFrame(() => canvasRef.current?.fitView())
    toast.success('Auto-layout applied')
  }, [handleChange])

  const handleFlowDirectionChange = useCallback(
    (direction: FlowDirection) => {
      if (resolveFlowDirection(diagram.direction) === direction) return
      handleChange((previous) => layoutWorkflowDiagram(previous, direction))
      requestAnimationFrame(() => canvasRef.current?.fitView())
    },
    [diagram.direction, handleChange],
  )

  const canvasHasAgents = useMemo(() => listAgentNodes(diagram).length > 0, [diagram])

  // Read at send time, so the Workflow AI edits the canvas as it is now.
  const activePageRef = useRef(activePage)
  activePageRef.current = activePage
  const getCurrentWorkflow = useCallback(
    () => planFromDiagram(activePageRef.current, inferWorkflowType(activePageRef.current.diagram)),
    [],
  )

  const handleWorkflowGenerated = useCallback(
    (plan: WorkflowGenerationPlan, base: CanvasPlan | null = null) => {
      const generated = diagramFromGenerationPlanSafe(plan, paletteById)
      // Every workflow begins at Start, wired to its entry agents.
      const enrichedDiagram = withStartNode(enrichDiagram(generated.diagram, paletteById))
      invalidateValidation()
      setDoc((previous) => {
        const current = previous.workflow ?? defaultWorkflowMeta()
        return {
          ...previous,
          // An update keeps the workflow's id and version; a new draft starts fresh.
          workflow: base
            ? { ...current, executionType: generated.workflowMeta.executionType ?? current.executionType }
            : { ...current, ...generated.workflowMeta },
          pages: previous.pages.map((page) =>
            page.id === previous.activePageId
              ? {
                  ...page,
                  name: generated.workflowName,
                  diagram: base
                    ? keepAgentSettings(enrichedDiagram, generated.nodeIdByKey, base, page.diagram)
                    : enrichedDiagram,
                }
              : page,
          ),
        }
      })
      setSelection(null)
      setEditorView('canvas')
      requestAnimationFrame(() => canvasRef.current?.fitView())
    },
    [invalidateValidation, paletteById, setDoc],
  )

  const storedModelConfig = doc.workflow?.modelConfig
  const ollamaBaseUrl = storedModelConfig?.baseUrl?.trim() || OLLAMA_DEFAULT_URL
  const generateModel = useMemo<GenerateWorkflowModel>(() => {
    if (generateModelChoice) return generateModelChoice
    if (isLocalModel(storedModelConfig) && storedModelConfig?.model?.trim()) {
      return { provider: 'ollama', model: storedModelConfig.model.trim(), baseUrl: ollamaBaseUrl }
    }
    return { provider: 'server' }
  }, [generateModelChoice, storedModelConfig, ollamaBaseUrl])

  const generateOptions = useMemo(
    () =>
      generatePanelOpen
        ? {
            messages: generateMessages,
            onMessagesChange: setGenerateMessages,
            model: generateModel,
            onModelChange: setGenerateModelChoice,
            ollamaBaseUrl,
            replacesCanvas: canvasHasAgents,
            getCurrentWorkflow,
            onGenerated: handleWorkflowGenerated,
            onClose: closeGeneratePanel,
          }
        : null,
    [
      generatePanelOpen,
      generateMessages,
      generateModel,
      ollamaBaseUrl,
      canvasHasAgents,
      getCurrentWorkflow,
      handleWorkflowGenerated,
      closeGeneratePanel,
    ],
  )

  const handleApplyTemplate = useCallback(
    (template: WorkflowTemplate) => {
      if (diagram.nodes.length > 0) {
        const confirmed = window.confirm(
          'Replace the current canvas with this template? Unsaved layout on this page will be overwritten.',
        )
        if (!confirmed) return
      }
      handleWorkflowGenerated(template.plan)
      toast.success(`Applied “${template.title}” — edit agents and connectors as needed`)
    },
    [diagram.nodes.length, handleWorkflowGenerated],
  )

  const handleSave = useCallback(async () => {
    const nextDoc = {
      ...doc,
      workflow: {
        ...(doc.workflow ?? defaultWorkflowMeta()),
        version: (doc.workflow?.version ?? 1) + 1,
        status: 'draft' as const,
      },
    }
    setDoc(nextDoc)
    setIsValidated(false)
    const result = await persistWorkflowBuildSpec({
      doc: nextDoc,
      pageId: activePage.id,
      diagram,
      paletteById,
      syncToDisk: true,
      serverModelConfig,
    })
    if (result.databaseRecordId) {
      toast.success('Draft saved to PostgreSQL')
    } else {
      toast.success('Draft saved · build spec cached locally')
    }
    markSaved()
  }, [doc, setDoc, activePage.id, diagram, paletteById, serverModelConfig, markSaved])

  const handleSaveAs = useCallback(() => {
    toast.info('Save as…', {
      description: 'Choose Export JSON from the app menu to download a copy for now.',
    })
  }, [])

  const handleClearCanvas = useCallback(() => {
    handleChange((previous) => ({ nodes: [], edges: [], direction: previous.direction }))
    setSelection(null)
  }, [handleChange])

  /** Remove nodes with their connectors, and the tools attached to removed agents. */
  const deleteNodesById = useCallback(
    (nodeIds: string[]) => {
      handleChange((previous) => {
        const removeIds = new Set(nodeIds)
        for (const node of previous.nodes) {
          if (node.mappedAgentId && removeIds.has(node.mappedAgentId)) {
            removeIds.add(node.id)
          }
        }
        let base = previous
        for (const nodeId of nodeIds) {
          const target = base.nodes.find((node) => node.id === nodeId)
          if (target && isAgentNode(target)) {
            base = removeToolsMappedToAgent(base, target.id)
          }
        }
        return {
          nodes: base.nodes.filter((node) => !removeIds.has(node.id)),
          edges: base.edges.filter(
            (edge) => !removeIds.has(edge.from) && !removeIds.has(edge.to),
          ),
        }
      })
      setSelection(null)
    },
    [handleChange],
  )

  const handleDeleteSelection = useCallback(() => {
    if (!selection) return
    if (selection.kind === 'edge') {
      handleChange((previous) => ({
        ...previous,
        edges: previous.edges.filter((edge) => edge.id !== selection.id),
      }))
      setSelection(null)
      return
    }
    deleteNodesById(selectedNodeIds(selection))
  }, [selection, handleChange, deleteNodesById])

  const handleValidate = useCallback(() => {
    const issues = validateWorkflow(diagram, paletteById)
    setValidationIssues(issues)
    const hasErrors = issues.some((issue) => issue.severity === 'error')
    if (hasErrors || diagram.nodes.length === 0) {
      setIsValidated(false)
      setDoc((previous) => ({
        ...previous,
        workflow: {
          ...(previous.workflow ?? defaultWorkflowMeta()),
          executionType: inferredType,
          status: 'draft',
        },
      }))
      toast.error(
        diagram.nodes.length === 0
          ? 'Add at least one block before validating.'
          : `Validation found ${issues.filter((issue) => issue.severity === 'error').length} error(s)`,
      )
      return
    }

    const session = getSession()
    if (!session) {
      toast.error('Sign in before validating the workflow.')
      return
    }
    const page = doc.pages.find((candidate) => candidate.id === doc.activePageId) ?? doc.pages[0]
    if (!page) {
      toast.error('No workflow page found.')
      return
    }

    const document = buildOrchestrationDocument({
      doc,
      pageId: page.id,
      diagram,
      workspaceId: session.workspaceId,
      userId: session.accountId,
    })
    void saveOrchestration({
      identity: orchestrationIdentity(page.id),
      name: page.name,
      document,
    })
      .then(() => {
        setIsValidated(true)
        setDoc((previous) => ({
          ...previous,
          workflow: {
            ...(previous.workflow ?? defaultWorkflowMeta()),
            executionType: inferredType,
            status: 'validated',
          },
        }))
        toast.success('Workflow validated and draft saved')
      })
      .catch((error: unknown) => {
        setIsValidated(false)
        toast.error(error instanceof Error ? error.message : 'Could not validate the workflow.')
      })
  }, [diagram, paletteById, inferredType, setDoc, doc])

  const openExecutionPanel = useCallback(() => {
    keepRightOpenRef.current = true
    setSelection(null)
    setExecutionPanelOpen(true)
    if (isMobile) {
      setGeneratePanelOpen(false)
      navigate(ROUTES.agentWorkflowInspect)
      return
    }
    setEditorFocus({ kind: 'run' })
  }, [isMobile, navigate])

  const handleBackToDesign = useCallback(() => {
    keepRightOpenRef.current = false
    resetExecution()
    setExecutionPanelOpen(false)
    setSelection(null)
  }, [resetExecution])

  /** Desktop: a node or connector clicked on the canvas opens as a card; Start opens the run. */
  const handleNodeOpen = useCallback(
    (nodeId: string) => {
      if (isMobile) return
      const node = diagram.nodes.find((candidate) => candidate.id === nodeId)
      if (!node) return
      if (isStartFlowNode(node)) {
        openExecutionPanel()
        return
      }
      setEditorFocus({ kind: 'node', id: nodeId })
    },
    [isMobile, diagram.nodes, openExecutionPanel],
  )

  const handleEdgeOpen = useCallback(
    (edgeId: string) => {
      if (!isMobile) setEditorFocus({ kind: 'edge', id: edgeId })
    },
    [isMobile],
  )

  const closeEditorFocus = useCallback(() => {
    setEditorFocus((current) => {
      // Closing the run card ends "run mode" but keeps the result highlighted on the canvas.
      if (current?.kind === 'run') {
        keepRightOpenRef.current = false
        setExecutionPanelOpen(false)
      }
      return null
    })
    setAttachTarget(null)
    setSelection(null)
  }, [])

  // The expanded node or connector collapses when another node or connector is selected (which
  // then expands instead). A click on empty canvas closes it through the canvas; pressing empty
  // canvas to pan clears the selection but keeps it open.
  useEffect(() => {
    if (editorFocus?.kind !== 'node' && editorFocus?.kind !== 'edge') return
    if (selection === null) return
    const stillSelected =
      (editorFocus.kind === 'node' && selection.kind === 'node' && selection.id === editorFocus.id) ||
      (editorFocus.kind === 'edge' && selection.kind === 'edge' && selection.id === editorFocus.id)
    if (!stillSelected) {
      setEditorFocus(null)
      setAttachTarget(null)
    }
  }, [selection, editorFocus])

  // A focused node or connector that no longer exists (deleted, page switched) closes its card.
  useEffect(() => {
    if (editorFocus?.kind === 'node' && !diagram.nodes.some((node) => node.id === editorFocus.id)) {
      setEditorFocus(null)
    }
    if (editorFocus?.kind === 'edge' && !diagram.edges.some((edge) => edge.id === editorFocus.id)) {
      setEditorFocus(null)
    }
  }, [editorFocus, diagram])

  // Every main workflow page has Start, the only way to run it: added to empty pages and to older
  // workflows saved without one (wired to their entry agents). Added without an undo entry, so
  // undo never removes it (clearing the canvas keeps Start too).
  const activePageKind = activePage.kind
  const hasStartNode = diagram.nodes.some(isStartFlowNode)
  useEffect(() => {
    if (activePageKind === 'sub' || hasStartNode) return
    setDoc((previous) => ({
      ...previous,
      pages: previous.pages.map((page) =>
        page.id === previous.activePageId && !page.diagram.nodes.some(isStartFlowNode)
          ? { ...page, diagram: withStartNode(page.diagram) }
          : page,
      ),
    }))
  }, [activePageKind, hasStartNode, setDoc])

  // The first agent added to a page (clicked or dropped) is connected from Start.
  const agentCountRef = useRef<{ pageId: string; count: number } | null>(null)
  useEffect(() => {
    const count = listAgentNodes(diagram).length
    const previous = agentCountRef.current
    agentCountRef.current = { pageId: activePage.id, count }
    if (!previous || previous.pageId !== activePage.id || previous.count !== 0 || count !== 1) return
    const start = diagram.nodes.find(isStartFlowNode)
    const agent = listAgentNodes(diagram)[0]
    if (!start || !agent) return
    if (diagram.edges.some((edge) => edge.from === start.id || edge.to === agent.id)) return
    handleChange((current) =>
      current.edges.some((edge) => edge.from === start.id)
        ? current
        : { ...current, edges: [...current.edges, startEdge(current, start.id, agent.id)] },
    )
  }, [diagram, activePage.id, handleChange])

  // Ring around each node for the current (or last) run.
  const runStatusByNode = useMemo(() => {
    if (runState.status === 'idle') return undefined
    const statuses: Record<string, NodeRunStatus> = {}
    for (const id of runState.completedNodeIds) statuses[id] = 'completed'
    for (const step of runState.trace) {
      if (step.nodeId && step.status === 'error') statuses[step.nodeId] = 'error'
    }
    if (runState.activeNodeId && (runState.status === 'running' || runState.status === 'waiting-approval')) {
      statuses[runState.activeNodeId] = runState.status === 'waiting-approval' ? 'waiting' : 'running'
    }
    return statuses
  }, [runState.status, runState.completedNodeIds, runState.trace, runState.activeNodeId])

  const handleViewInstance = useCallback(() => {
    setLibrarySection('deployments')
    if (isMobile) navigate(ROUTES.agentWorkflow)
  }, [isMobile, navigate])

  const handleBackFromDeployments = useCallback(() => {
    setLibrarySection(null)
  }, [])

  const headerView: EditorView = showDeploymentsBoard ? 'deployments' : editorView === 'code' ? 'code' : 'editor'
  const handleHeaderViewChange = useCallback(
    (view: EditorView) => {
      if (view === 'deployments') {
        setLibrarySection('deployments')
        return
      }
      setLibrarySection((section) => (section === 'deployments' ? null : section))
      setEditorView(view === 'code' ? 'code' : 'canvas')
    },
    [],
  )

  const canvasView = useMemo(
    () => ({
      showGrid,
      onShowGridChange: setShowGrid,
      snapToGrid,
      onSnapToGridChange: setSnapToGrid,
    }),
    [showGrid, snapToGrid],
  )

  const openLibrary = useCallback(() => {
    setLibrarySection('blocks')
    expandLeftPanel()
  }, [expandLeftPanel])

  useEffect(() => {
    const openDeployments = () => setLibrarySection('deployments')
    window.addEventListener('eleven-nodes-open-library-deployments', openDeployments)
    return () =>
      window.removeEventListener('eleven-nodes-open-library-deployments', openDeployments)
  }, [])

  const handleDeploy = useCallback(() => {
    if (!isValidated) {
      toast.error('Validate the workflow before deploying')
      return
    }
    const session = getSession()
    if (!session) {
      toast.error('Sign in to deploy a workflow instance')
      return
    }
    const version = getNextPublishedVersion(
      session.accountId,
      session.workspaceId,
      workflowMeta.workflowId,
      workflowMeta.version ?? 0,
    )
    const deployment: WorkflowDeployment = {
      workflowId: workflowMeta.workflowId,
      endpointUrl: `https://api.elevennodes.app/v1/workflows/${workflowMeta.workflowId}/v/${version}/run`,
      triggerMethod: 'POST',
      authType: 'api-key',
      requestSchema: '{\n  "prompt": "string"\n}',
      responseSchema: '{\n  "runId": "string",\n  "status": "completed",\n  "output": {}\n}',
      status: 'deployed',
      version,
      deployedAt: new Date().toISOString(),
    }
    setDoc((previous) => ({
      ...previous,
      workflow: {
        ...(previous.workflow ?? defaultWorkflowMeta()),
        status: 'deployed',
        version: deployment.version,
        deployment,
      },
    }))
    try {
      publishWorkflowInstance({
        accountId: session.accountId,
        workspaceId: session.workspaceId,
        workflowId: deployment.workflowId,
        workflowName,
        instanceName: session.displayName,
        accountType: session.accountType,
        endpointUrl: deployment.endpointUrl,
        version: deployment.version,
        triggerMethod: deployment.triggerMethod,
        authType: deployment.authType,
        status: 'deployed',
        deployedAt: deployment.deployedAt,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not create a new deployment version.'
      toast.error(message)
      return
    }
    setLogs((previous) => [
      ...previous,
      `[${deployment.deployedAt}] Deployed v${deployment.version} → ${deployment.endpointUrl}`,
    ])
    toast.success(`Deployed v${deployment.version}`, {
      description: 'A new deployment version was added under Deployments.',
      action: {
        label: 'View deployments',
        onClick: () => handleViewInstance(),
      },
    })
  }, [isValidated, workflowMeta, testInput, setDoc, workflowName, handleViewInstance])

  const handleExecute = useCallback(() => {
    if (runState.status === 'running' || runState.status === 'waiting-approval') {
      return
    }
    if (!isValidated) {
      toast.error('Validate the workflow before executing.')
      return
    }
    const session = getSession()
    if (!session) {
      toast.error('Sign in before executing the workflow.')
      return
    }

    keepRightOpenRef.current = true
    setExecutionPanelOpen(true)
    setInspectorTab('logs')
    if (isMobile) {
      right.expand()
      setGeneratePanelOpen(false)
      bottom.expand()
      navigate(ROUTES.agentWorkflowLogs)
    } else {
      setEditorFocus({ kind: 'run' })
    }

    if (!isValidWorkflowInput(testInput)) {
      toast.error('Enter a message in the Execution panel before executing.')
      return
    }

    if (listAgentNodes(diagram).length === 0) {
      toast.error('Add at least one Agent block before executing.')
      return
    }

    const page = doc.pages.find((candidate) => candidate.id === doc.activePageId) ?? doc.pages[0]
    if (!page) {
      toast.error('No workflow page found.')
      return
    }

    const diagramSnapshot = { nodes: diagram.nodes, edges: diagram.edges }
    const docToSave = mergeDiagramIntoDocument(doc, page.id, diagramSnapshot, page.name)
    saveWorkflowDocument(docToSave)
    clearExecutionSnapshot()
    setEditorView('canvas')

    const executionPlan = getExecutablePlan(diagramSnapshot)
    if (executionPlan.length === 0) {
      toast.error('No executable agents in this workflow.')
      return
    }

    const document = buildOrchestrationDocument({
      doc: docToSave,
      pageId: page.id,
      diagram: diagramSnapshot,
      workspaceId: session.workspaceId,
      userId: session.accountId,
    })
    void saveOrchestration({
      identity: orchestrationIdentity(page.id),
      name: page.name,
      document,
    })
      .then(() => {
        resetExecution()
        return startExecution(executionPlan, testInput, {
          workspaceId: session.workspaceId,
          pageId: page.id,
          userId: session.accountId,
        })
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Could not execute the workflow.')
      })
  }, [
    doc,
    diagram,
    testInput,
    isValidated,
    runState.status,
    bottom,
    right,
    isMobile,
    navigate,
    resetExecution,
    startExecution,
  ])

  useEffect(() => {
    registerSaveHandler(handleSave)
  }, [registerSaveHandler, handleSave])

  const handleWorkflowNameChange = useCallback(
    (name: string) => {
      renamePage(activePage.id, name)
    },
    [activePage.id, renamePage],
  )

  const transformDroppedNode = useCallback((node: DiagramNode, item: PaletteItem) => {
    const isTool = isMappedToolPalette(node.paletteId)
    return enrichAgentNode(
      {
        ...node,
        width: isTool ? TOOL_NODE_WIDTH : AGENT_NODE_WIDTH,
        height: isTool ? TOOL_NODE_HEIGHT : AGENT_NODE_HEIGHT,
      },
      item,
    )
  }, [])

  const finalizeDroppedNode = useCallback(
    (node: DiagramNode, currentDiagram: Diagram, world: { x: number; y: number }) => {
      if (!isMappedToolPalette(node.paletteId)) return node
      if (listAgentNodes(currentDiagram).length === 0) {
        toast.error('Add an agent before placing tools')
        return null
      }
      const agent = pickAgentForToolPlacement(currentDiagram, world)
      if (!agent) return null
      return attachToolToAgent(currentDiagram, node, agent.id)
    },
    [],
  )

  const agentNodes = useMemo(() => listAgentNodes(diagram), [diagram])
  const errorCount = validationIssues.filter((issue) => issue.severity === 'error').length
  const isExecutionMode = runState.status !== 'idle'
  const isExecuting = runState.status === 'running' || runState.status === 'waiting-approval'
  const displayTrace = runState.trace
  const workflowDescription = useMemo(() => {
    const plan = getExecutablePlan(diagram)
    const approvalEdges = diagram.edges.filter((edge) => edge.connector?.humanApproval).length
    return `${plan.length}-step workflow${approvalEdges ? ` with ${approvalEdges} human approval gate(s)` : ''}.`
  }, [diagram])

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = diagram.nodes.find((node) => node.id === nodeId)
      if (!source) return
      const copy: DiagramNode = {
        ...source,
        id: createNodeId(),
        label: `${source.label} copy`,
        x: source.x + 40,
        y: source.y + 40,
        ...(source.agent ? { agent: { ...source.agent } } : {}),
      }
      handleChange((previous) => ({ ...previous, nodes: [...previous.nodes, copy] }))
      setSelection({ kind: 'node', id: copy.id })
      toast.success(`Duplicated ${source.label}`)
    },
    [diagram.nodes, handleChange],
  )

  const disconnectNode = useCallback(
    (nodeId: string) => {
      handleChange((previous) => ({
        ...previous,
        edges: previous.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      }))
    },
    [handleChange],
  )

  /** The actions offered for a node, by its type. */
  const nodeMenuEntries = (nodeId: string): NodeMenuEntry[] => {
    const node = diagram.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) return []
    const connected = diagram.edges.some((edge) => edge.from === node.id || edge.to === node.id)
    const disconnect: NodeMenuEntry = {
      label: 'Disconnect all',
      icon: Unlink,
      onSelect: () => disconnectNode(node.id),
      disabled: !connected,
      hint: connected ? undefined : 'No connections',
    }
    if (isStartFlowNode(node)) {
      return [
        { label: 'Run workflow', icon: Play, onSelect: openExecutionPanel },
        { kind: 'separator' },
        disconnect,
        { kind: 'separator' },
        { label: 'Delete', icon: Trash2, onSelect: () => {}, destructive: true, disabled: true, hint: 'Start is required' },
      ]
    }
    const open: NodeMenuEntry = {
      label: 'Open settings',
      icon: Settings2,
      shortcut: 'Click',
      onSelect: () => handleNodeOpen(node.id),
    }
    const remove: NodeMenuEntry = {
      label: 'Delete',
      icon: Trash2,
      shortcut: '⌫',
      destructive: true,
      onSelect: () => {
        setEditorFocus(null)
        deleteNodesById([node.id])
      },
    }
    if (isToolNode(node)) return [open, { kind: 'separator' }, disconnect, { kind: 'separator' }, remove]
    const agent = isAgentNode(node)
    return [
      open,
      ...(agent
        ? ([
            { kind: 'separator' },
            { label: 'Add tool', icon: Wrench, onSelect: () => handleAgentAttachAction(node.id, 'tool') },
            { label: 'Add memory', icon: Database, onSelect: () => handleAgentAttachAction(node.id, 'memory') },
            { label: 'Add knowledge', icon: BookOpen, onSelect: () => handleAgentAttachAction(node.id, 'knowledge') },
          ] satisfies NodeMenuEntry[])
        : []),
      { kind: 'separator' },
      { label: 'Duplicate', icon: Copy, onSelect: () => duplicateNode(node.id) },
      disconnect,
      { kind: 'separator' },
      remove,
    ]
  }

  const openNodeMenu = useCallback((nodeId: string, x: number, y: number) => {
    setNodeMenu({ nodeId, x, y })
  }, [])

  const canvasFocusBase = isMobile
    ? null
    : buildCanvasFocus({
        focus: editorFocus,
        diagram,
        doc,
        onChange: handleChange,
        onClose: closeEditorFocus,
        onOpenSubWorkflow: handleSelectPage,
        onWorkflowMetaChange: handleWorkflowMetaChange,
        onModelConfigChange: handleModelConfigChange,
        serverModelConfig,
        llmConfigured,
        attach: attachTarget
          ? {
              agentId: attachTarget.agentId,
              kind: attachTarget.kind,
              attachedIds: diagram.nodes
                .filter((node) => node.mappedAgentId === attachTarget.agentId)
                .flatMap((node) => node.agent?.tools ?? []),
              onAttach: (capability) => attachCapabilityToAgent(attachTarget.agentId, capability),
              onClose: () => setAttachTarget(null),
            }
          : null,
        run: {
          state: runState,
          testInput,
          onTestInputChange: setTestInput,
          onExecute: handleExecute,
          isExecuting,
          canExecute: agentNodes.length > 0,
          onCancel: cancelExecution,
          onSubmitApproval: submitApproval,
          onSubmitFeedback: submitFeedback,
          onShowDetails: showExecutionLogs,
        },
      })

  // Node cards get the same actions menu from their header's "⋯" button.
  const canvasFocus =
    canvasFocusBase && editorFocus?.kind === 'node'
      ? { ...canvasFocusBase, onMore: (x: number, y: number) => openNodeMenu(editorFocus.id, x, y) }
      : canvasFocusBase

  // Several nodes selected: the right panel used to offer "Convert to sub-workflow" here.
  const multiSelectCount = selection?.kind === 'nodes' ? selection.ids.length : 0
  const selectionBar =
    !isMobile && multiSelectCount > 1 ? (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card py-1 pl-3 pr-1 text-xs shadow-md">
        <span className="font-medium text-foreground">{multiSelectCount} selected</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7"
          disabled={!subWorkflow.canConvert}
          onClick={subWorkflow.requestConvert}
        >
          Convert to sub-workflow
        </Button>
      </div>
    ) : null

  if (!tool) return <Navigate to="/404" replace />

  return (
    <DevProfiler id="AgentWorkflowPage">
    <div
      className={
        isMobile
          ? 'workspace-surface flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground'
          : 'workspace-surface flex h-screen flex-col overflow-hidden bg-background text-foreground'
      }
    >
      {isMobile ? (
        <MobileWorkspaceHeader
          tab={mobileTab}
          workflowName={workflowName}
          onWorkflowNameChange={handleWorkflowNameChange}
          version={workflowMeta.version}
          status={workflowMeta.status}
          validationErrorCount={errorCount}
          isDirty={isDirty}
          onSave={handleSave}
          onValidate={handleValidate}
          onDeploy={handleDeploy}
          onGenerate={openGeneratePanel}
          onExecute={openExecutionPanel}
          canExecute={agentNodes.length > 0 && !isExecutionMode}
          isExecuting={isExecuting}
          isValidated={isValidated}
          onNavigateHome={handleNavigateHome}
          onOpenSettings={openWorkflowSettings}
          onOpenAppMenu={() => setAppMenuOpen(true)}
          serverModelConfig={toolbarModelConfig}
          llmConfigured={toolbarModelConfigured}
        />
      ) : (
        <AgentWorkflowHeader
          workflowName={workflowName}
          onWorkflowNameChange={handleWorkflowNameChange}
          status={workflowMeta.status}
          isDirty={isDirty}
          onSave={handleSave}
          onValidate={handleValidate}
          onDeploy={handleDeploy}
          onGenerate={openGeneratePanel}
          isValidated={isValidated}
          onNavigateHome={handleNavigateHome}
          onViewInstance={handleViewInstance}
          onShare={() => setShareOpen(true)}
          view={headerView}
          onViewChange={handleHeaderViewChange}
        />
      )}

      <div
        className={
          isMobile
            ? 'flex min-h-0 flex-1 flex-col pb-[calc(4.85rem+env(safe-area-inset-bottom,0px))]'
            : 'flex min-h-0 flex-1'
        }
      >
        {isMobile && mobileTab === 'library' && showDeploymentsBoard ? (
          <MobilePageShell tone="canvas">
            <DeploymentsCanvasView onBackToCanvas={handleBackFromDeployments} />
          </MobilePageShell>
        ) : null}

        {isMobile && mobileTab === 'library' && !showDeploymentsBoard ? (
          <MobilePageShell>
            <AgentLibrarySidebar
              onAddAgent={(paletteId) => {
                addBlock(paletteId)
                navigate(ROUTES.agentWorkflow)
              }}
              doc={doc}
              activePageId={doc.activePageId}
              onMountWorkflow={(pageId) => {
                subWorkflow.mountWorkflow(pageId)
                navigate(ROUTES.agentWorkflow)
              }}
              onCreateWorkflowTab={handleCreateWorkflowTab}
              onOpenSettings={openWorkflowSettings}
              serverModelConfig={toolbarModelConfig}
              llmConfigured={toolbarModelConfigured}
              activeSection={librarySection ?? 'blocks'}
              onSectionChange={setLibrarySection}
              width={320}
              collapsed={false}
              onResizePointerDown={noopPointer}
              onToggleCollapse={() => navigate(ROUTES.agentWorkflow)}
              embedded
            />
          </MobilePageShell>
        ) : null}

        {isMobile && mobileTab === 'inspect' ? (
          <MobilePageShell>
            <AgentPropertiesShell
              diagram={diagram}
              doc={doc}
              selection={selection}
              onChange={handleChange}
              width={320}
              collapsed={false}
              onResizePointerDown={noopPointer}
              onToggleCollapse={() => navigate(ROUTES.agentWorkflow)}
              onOpenSubWorkflow={handleSelectPage}
              onConvertToSubWorkflow={subWorkflow.requestConvert}
              canConvertToSubWorkflow={subWorkflow.canConvert}
              onWorkflowMetaChange={handleWorkflowMetaChange}
              onModelConfigChange={handleModelConfigChange}
              serverModelConfig={serverModelConfig}
              llmConfigured={llmConfigured}
              executionPanelOpen={executionPanelOpen}
              generate={generateOptions}
              embedded
              attachCapability={
                attachTarget
                  ? {
                      agentLabel:
                        diagram.nodes.find((node) => node.id === attachTarget.agentId)?.label ??
                        'agent',
                      initialKind: attachTarget.kind,
                      attachedIds: diagram.nodes
                        .filter((node) => node.mappedAgentId === attachTarget.agentId)
                        .flatMap((node) => node.agent?.tools ?? []),
                      onAttach: (capability) => {
                        attachCapabilityToAgent(attachTarget.agentId, capability)
                      },
                      onClose: () => setAttachTarget(null),
                    }
                  : null
              }
              execution={{
                testInput,
                onTestInputChange: setTestInput,
                onExecute: handleExecute,
                isExecuting,
                canExecute: agentNodes.length > 0,
                runStatus: runState.status,
                runId: runState.runId,
                onCancel: cancelExecution,
                approvalPrompt: runState.approvalPrompt,
                onSubmitApproval: submitApproval,
                onSubmitFeedback: submitFeedback,
                stepOutputs: runState.stepOutputs,
                trace: displayTrace,
                messages: runState.messages,
                finalResponse: runState.finalResponse,
                errors: runState.errors,
                onShowDetails: showExecutionLogs,
                needsReview: Boolean(runState.approvalPrompt),
              }}
            />
          </MobilePageShell>
        ) : null}

        {isMobile && mobileTab === 'logs' ? (
          <MobilePageShell>
            <BottomInspectorPanel
              validationIssues={validationIssues}
              trace={displayTrace}
              logs={logs}
              executionEvents={runState.events}
              executionErrors={runState.errors}
              executionWarnings={runState.warnings}
              isExecuting={isExecuting}
              activeTab={inspectorTab}
              onActiveTabChange={setInspectorTab}
              stepOutputs={runState.stepOutputs}
              height={
                typeof window === 'undefined' ? 480 : Math.max(320, window.innerHeight - 140)
              }
              collapsed={false}
              onResizePointerDown={noopPointer}
              onToggleCollapse={() => navigate(ROUTES.agentWorkflow)}
            />
          </MobilePageShell>
        ) : null}

        {(!isMobile || mobileTab === 'design') && (
        <div
          className={
            isMobile
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--canvas))]'
              : 'flex min-h-0 min-w-0 flex-1 flex-col'
          }
        >
          {showDeploymentsBoard ? (
            <div className="flex min-h-0 flex-1">
              {!isMobile && (
                <AgentLibrarySidebar
                  onAddAgent={addBlock}
                  doc={doc}
                  activePageId={doc.activePageId}
                  onMountWorkflow={subWorkflow.mountWorkflow}
                  onCreateWorkflowTab={handleCreateWorkflowTab}
                  onOpenSettings={openWorkflowSettings}
                  serverModelConfig={toolbarModelConfig}
                  llmConfigured={toolbarModelConfigured}
                  width={left.size}
                  collapsed={left.collapsed}
                  onResizePointerDown={left.onResizePointerDown}
                  onToggleCollapse={left.toggle}
                  activeSection={librarySection}
                  onSectionChange={setLibrarySection}
                  canvasView={canvasView}
                  blocksTab={libraryBlocksTab}
                  onBlocksTabChange={setLibraryBlocksTab}
                  onPickModelProvider={handlePickModelProvider}
                  modelTargetLabel={modelTargetLabel}
                  activeModelProviderId={modelTargetProviderId}
                />
              )}
              <DeploymentsCanvasView onBackToCanvas={handleBackFromDeployments} />
            </div>
          ) : (
          <>

          <div className="flex min-h-0 flex-1">
            {!isMobile && (
              <AgentLibrarySidebar
                onAddAgent={addBlock}
                doc={doc}
                activePageId={doc.activePageId}
                onMountWorkflow={subWorkflow.mountWorkflow}
                onCreateWorkflowTab={handleCreateWorkflowTab}
                onOpenSettings={openWorkflowSettings}
                serverModelConfig={toolbarModelConfig}
                llmConfigured={toolbarModelConfigured}
                width={left.size}
                collapsed={left.collapsed}
                onResizePointerDown={left.onResizePointerDown}
                onToggleCollapse={left.toggle}
                activeSection={librarySection}
                onSectionChange={setLibrarySection}
                canvasView={canvasView}
                blocksTab={libraryBlocksTab}
                onBlocksTabChange={setLibraryBlocksTab}
                onPickModelProvider={handlePickModelProvider}
                modelTargetLabel={modelTargetLabel}
                activeModelProviderId={modelTargetProviderId}
              />
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {/* Desktop runs stay on the canvas (nodes light up); mobile keeps the run view. */}
              {isExecutionMode && isMobile ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <ExecutionFlowCanvas
                    diagram={diagram}
                    paletteById={paletteById}
                    runState={runState}
                    workflowName={workflowName}
                    workflowDescription={workflowDescription}
                    onBackToDesign={handleBackToDesign}
                    onRunAgain={handleExecute}
                  />
                </div>
              ) : (
                <>
                  {editorView === 'canvas' ? (
                    <AgentWorkflowCanvas
                      ref={canvasRef}
                      diagram={diagram}
                      paletteById={paletteById}
                      onChange={handleChange}
                      selection={selection}
                      onSelectionChange={handleSelectionChange}
                      snapToGrid={snapToGrid}
                      showGrid={showGrid}
                      activePageId={activePage.id}
                      onAutoLayout={runAutoLayout}
                      onFlowDirectionChange={handleFlowDirectionChange}
                      transformDroppedNode={transformDroppedNode}
                      finalizeDroppedNode={finalizeDroppedNode}
                      onOpenExecution={openExecutionPanel}
                      executionPanelOpen={executionPanelOpen}
                      onBackToDesign={isMobile ? handleBackToDesign : undefined}
                      focus={canvasFocus}
                      onNodeOpen={handleNodeOpen}
                      onEdgeOpen={handleEdgeOpen}
                      runStatusByNode={runStatusByNode}
                      selectionBar={selectionBar}
                      onNodeContextMenu={isMobile ? undefined : openNodeMenu}
                      onDropModelProvider={(nodeId, providerId) => assignModelProvider(nodeId, providerId)}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                      onNodeAttachAction={handleAgentAttachAction}
                      onInsertHitlOnEdge={handleInsertHitlOnEdge}
                      hideEmptyState={!(showCanvasEmptyState ?? isMobile)}
                      onOpenLibrary={isMobile ? undefined : openLibrary}
                      onBrowseTemplates={() => setShowCanvasEmptyState(true)}
                      onAskAi={openGeneratePanel}
                      onClearCanvas={handleClearCanvas}
                      emptyState={
                        isMobile ? (
                          <div className="flex h-full min-h-0 flex-col">
                            <div className="shrink-0 border-b border-border/80 px-4 pb-3 pt-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[15px] font-semibold tracking-tight text-foreground">
                                    Start from a template
                                  </p>
                                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                                    Pick a pattern, then edit on the canvas. Or{' '}
                                    <button
                                      type="button"
                                      className="font-medium text-foreground underline-offset-2 hover:underline dark:text-foreground"
                                      onClick={openGeneratePanel}
                                    >
                                      ask Workflow AI
                                    </button>
                                    .
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 shrink-0 px-2.5 text-muted-foreground"
                                  onClick={() => setShowCanvasEmptyState(false)}
                                >
                                  Skip
                                </Button>
                              </div>
                            </div>
                            <div
                              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
                              style={{ touchAction: 'pan-y' }}
                            >
                              <WorkflowTemplateGrid
                                density="mobile"
                                onSelect={handleApplyTemplate}
                              />
                              <p className="px-1 pb-2 pt-3 text-center text-[11px] text-muted-foreground">
                                Or open Library to add agents manually
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 px-5 py-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  Start from a workflow template
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Sequential, Parallel, Handoff, Group chat, Magentic, or
                                  Human-in-the-loop — then customize on the canvas. Or{' '}
                                  <button
                                    type="button"
                                    className="font-medium text-foreground underline-offset-2 hover:underline dark:text-foreground"
                                    onClick={openGeneratePanel}
                                  >
                                    ask Workflow AI
                                  </button>
                                  .
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-2 sm:justify-end">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => setShowCanvasEmptyState(false)}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                            <WorkflowTemplateGrid compact onSelect={handleApplyTemplate} />
                          </div>
                        )
                      }
                    />
                  ) : (
                    <WorkflowBuildCodeView
                      doc={doc}
                      pageId={activePage.id}
                      pageName={activePage.name}
                      diagram={diagram}
                      paletteById={paletteById}
                      serverModelConfig={serverModelConfig}
                      onBackToCanvas={() => setEditorView('canvas')}
                    />
                  )}
                </>
              )}

              <PagesBar
                pages={doc.pages}
                activePageId={doc.activePageId}
                activeMainPageId={doc.activeMainPageId}
                onSelect={handleSelectPage}
                onAdd={handleAddMainPage}
                onRename={renamePage}
                onDelete={handleDeletePage}
                onSetActiveMain={handleSetActiveMain}
                onAddSubToMain={handleAddSubToMain}
                density={isMobile ? 'comfortable' : 'compact'}
              />

              {!isMobile && (
                <BottomInspectorPanel
                  validationIssues={validationIssues}
                  trace={displayTrace}
                  logs={logs}
                  executionEvents={runState.events}
                  executionErrors={runState.errors}
                  executionWarnings={runState.warnings}
                  isExecuting={isExecuting}
                  activeTab={inspectorTab}
                  onActiveTabChange={setInspectorTab}
                  stepOutputs={runState.stepOutputs}
                  height={bottom.size}
                  collapsed={bottom.collapsed}
                  onResizePointerDown={bottom.onResizePointerDown}
                  onToggleCollapse={bottom.toggle}
                />
              )}
            </div>
          </div>
          </>
          )}
        </div>
        )}

        {/* Desktop: the right panel only hosts Workflow AI; details open as cards on the canvas. */}
        {!isMobile && !showDeploymentsBoard && generateOptions && (
          <AgentPropertiesShell
            diagram={diagram}
            doc={doc}
            selection={null}
            onChange={handleChange}
            width={right.size}
            collapsed={right.collapsed}
            onResizePointerDown={right.onResizePointerDown}
            onToggleCollapse={right.toggle}
            onOpenSubWorkflow={handleSelectPage}
            onConvertToSubWorkflow={subWorkflow.requestConvert}
            canConvertToSubWorkflow={subWorkflow.canConvert}
            onWorkflowMetaChange={handleWorkflowMetaChange}
            onModelConfigChange={handleModelConfigChange}
            serverModelConfig={serverModelConfig}
            llmConfigured={llmConfigured}
            executionPanelOpen={false}
            generate={generateOptions}
            attachCapability={null}
            execution={{
              testInput,
              onTestInputChange: setTestInput,
              onExecute: handleExecute,
              isExecuting,
              canExecute: agentNodes.length > 0,
              runStatus: runState.status,
              runId: runState.runId,
              onCancel: cancelExecution,
              approvalPrompt: runState.approvalPrompt,
              onSubmitApproval: submitApproval,
              onSubmitFeedback: submitFeedback,
              stepOutputs: runState.stepOutputs,
              trace: displayTrace,
              messages: runState.messages,
              finalResponse: runState.finalResponse,
              errors: runState.errors,
              onShowDetails: showExecutionLogs,
              needsReview: Boolean(runState.approvalPrompt),
            }}
          />
        )}
      </div>

      {!isMobile && (
        <WorkspaceStatusBar
          version={workflowMeta.version}
          status={workflowMeta.status}
          isDirty={isDirty}
          validationErrorCount={errorCount}
          onValidate={handleValidate}
          toolId={TOOL_ID}
          onManageAccess={() => setShareOpen(true)}
          serverModelConfig={toolbarModelConfig}
          llmConfigured={toolbarModelConfigured}
          llmConfigLoading={llmConfigLoading}
        />
      )}

      {isMobile ? <MobileWorkspaceNav /> : null}

      {isMobile ? (
        <MobileAppDrawer
          open={appMenuOpen}
          onOpenChange={setAppMenuOpen}
          workflowName={workflowName}
          selection={selection}
          isEmpty={diagram.nodes.length === 0}
          snapToGrid={snapToGrid}
          showGrid={showGrid}
          codeViewActive={editorView === 'code'}
          canConvertToSubWorkflow={subWorkflow.canConvert}
          onNewPage={handleAddPage}
          onNewWorkspace={handleCreateNewWorkspace}
          onSave={() => void handleSave()}
          onSaveAs={handleSaveAs}
          onImport={() => subWorkflow.openInsert('import')}
          onExportJson={() => toast.info('Export coming soon')}
          onExportSvg={() => toast.info('Export coming soon')}
          onExportPng={() => toast.info('Export coming soon')}
          onExportPdf={() => toast.info('Export coming soon')}
          onInsertWorkflow={() => subWorkflow.openInsert('workflow')}
          onInsertTemplates={() => setTemplatesOpen(true)}
          onCreateWorkflowTab={handleCreateWorkflowTab}
          onInsertImport={() => subWorkflow.openInsert('import')}
          onToggleCodeView={toggleCodeView}
          onDuplicate={() => toast.info('Duplicate coming soon')}
          onDeleteSelection={handleDeleteSelection}
          onConvertToSubWorkflow={subWorkflow.requestConvert}
          onClearCanvas={handleClearCanvas}
          onZoomIn={() => zoomBy(1.2)}
          onZoomOut={() => zoomBy(1 / 1.2)}
          onResetView={() => canvasRef.current?.fitView()}
          onFitToContent={() => canvasRef.current?.fitView()}
          onSnapToGridChange={setSnapToGrid}
          onShowGridChange={setShowGrid}
          onShare={() => setShareOpen(true)}
        />
      ) : null}

      <Outlet />

      {nodeMenu ? (
        <NodeContextMenu
          state={nodeMenu}
          title={diagram.nodes.find((node) => node.id === nodeMenu.nodeId)?.label}
          entries={nodeMenuEntries(nodeMenu.nodeId)}
          onClose={() => setNodeMenu(null)}
        />
      ) : null}

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        documentTitle={workflowName}
        toolId={TOOL_ID}
      />

      <SelectAgentDialog
        open={agentPickOpen}
        agents={agentNodes}
        onOpenChange={setAgentPickOpen}
        onSelect={(agentId) => addToolForAgent(agentId)}
      />

      {/* A model client picked with several agents and none chosen: ask which agent. */}
      <SelectAgentDialog
        open={modelPickProvider !== null}
        agents={agentNodes}
        onOpenChange={(open) => {
          if (!open) setModelPickProvider(null)
        }}
        onSelect={(agentId) => {
          if (modelPickProvider) assignModelProvider(agentId, modelPickProvider)
          setModelPickProvider(null)
        }}
      />

      <ConvertSubWorkflowDialog
        open={subWorkflow.convertOpen}
        onOpenChange={subWorkflow.setConvertOpen}
        agentCount={subWorkflow.selectedAgentCount}
        defaultName={subWorkflow.convertDefaultName}
        onConfirm={subWorkflow.confirmConvert}
      />

      <InsertWorkflowDialog
        open={subWorkflow.insertOpen}
        onOpenChange={subWorkflow.setInsertOpen}
        doc={doc}
        activePageId={doc.activePageId}
        defaultTab={subWorkflow.insertTab}
        onInsertFromPage={subWorkflow.insertFromPage}
        onImportDocument={subWorkflow.importDocument}
        onCreateWorkflowTab={handleCreateWorkflowTab}
      />

      <WorkflowTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={handleApplyTemplate}
      />

      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeUnsavedDialog()
          else setUnsavedDialogOpen(open)
        }}
        onSave={saveAndContinue}
        onDiscard={discardPending}
        isSaving={isUnsavedSaving}
      />

    </div>
    </DevProfiler>
  )
}
