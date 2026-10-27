import { pageWorkflowId } from '@/components/agent-workflow/page-workflow-id'
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
  createPage,
  flowPortSides,
  resolveFlowDirection,
  type Diagram,
  type DiagramDocument,
  type DiagramNode,
  type FlowDirection,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type {
  AgentWorkflowMeta,
  DeploymentStatus,
  WorkflowDeployment,
  WorkflowValidationIssue,
} from '@/types/agent-workflow'
import { findOrchestration, PATTERN_META } from '@/components/agent-workflow/orchestration-patterns'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import {
  resolveWorkflowModelConfig,
  workflowActiveModelConfig,
  isLocalModel,
  OLLAMA_DEFAULT_URL,
} from '@/components/agent-workflow/workflow-model-config'
import { WorkspaceTopBar } from '@/components/agent-workflow/WorkspaceTopBar'
import { WorkspaceAppRail, type AppRailView } from '@/components/agent-workflow/WorkspaceAppRail'
import { WorkflowContentHeader, type WorkspaceView } from '@/components/agent-workflow/WorkflowContentHeader'
import { WorkflowMapView } from '@/components/agent-workflow/WorkflowMapView'
import { WorkflowTimeline } from '@/components/agent-workflow/WorkflowTimeline'
import {
  DEFAULT_MAP_FILTERS,
  WorkflowOutlinePanel,
  type MapFilters,
} from '@/components/agent-workflow/WorkflowOutlinePanel'
import { ACTIVITY_DAYS, useWorkflowActivity } from '@/components/agent-workflow/hooks/use-workflow-activity'
import { AgentLibrarySidebar } from '@/components/agent-workflow/AgentLibrarySidebar'
import { AgentPropertiesShell, WorkflowSettingsSection } from '@/components/agent-workflow/AgentPropertiesShell'
import { WorkflowInsightsPanel } from '@/components/agent-workflow/WorkflowInsightsPanel'
import {
  isSettingsTab,
  WorkspaceSettingsView,
  type SettingsTab,
} from '@/components/agent-workflow/WorkspaceSettingsView'
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
  AGENT_PALETTE_ID,
  SKILL_PALETTE_ID,
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
import {
  findCapability,
  type AgentCapability,
  type AgentCapabilityKind,
} from '@/components/agent-workflow/agent-capabilities'
import type { CustomBlockKind } from '@/components/agent-workflow/AgentLibrarySidebar'
import type { AgentAttachAction } from '@/components/agent-workflow/AgentNodeCard'
import {
  insertHitlOnEdge,
  insertNodeOnEdge,
  promoteConnectorApprovals,
  HITL_PALETTE_ID,
} from '@/components/agent-workflow/insert-hitl-on-edge'
import { INSERT_REVIEW_ON_EDGE_EVENT } from '@/components/agent-workflow/ConnectorConfigPanel'
import { ImportWorkflowDialog } from '@/components/agent-workflow/InsertWorkflowDialog'
import { BlockPicker } from '@/components/agent-workflow/BlockPicker'
import { useChatSessions } from '@/components/agent-workflow/hooks/use-chat-sessions'
import { ExecutionsView } from '@/components/agent-workflow/ExecutionsView'
import { WorkflowConfigurationView } from '@/components/agent-workflow/WorkflowConfigurationView'
import { CustomCodeView } from '@/components/agent-workflow/CustomCodeView'
import { useModelConnections } from '@/components/agent-workflow/hooks/use-model-connections'
import { connectionProviderId } from '@/components/agent-workflow/AgentConfigPanel'
import { MODEL_CLIENT_REF_PREFIX, modelClientRef } from '@/services/model-connections-api'
import {
  importIntoDocument,
  isBlankDiagram,
  parseWorkflowFile,
  type ImportedWorkflow,
} from '@/components/agent-workflow/workflow-import'
import {
  fetchAccessRole,
  fetchAssistant,
  fetchWorkflowDefinition,
  setWorkflowPurpose,
  type WorkflowPurpose,
} from '@/services/assistant-api'
import { forgetAssistantWorkflow } from '@/services/workflow-run-api'
import { updateWorkflowConfiguration, type WorkflowConfiguration } from '@/services/workflow-configuration-store'
import { addExecution, useExecutions } from '@/services/execution-history-store'
import { catalogModelsFor, useModelCatalog } from '@/components/agent-workflow/hooks/use-model-catalog'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import {
  WorkflowTemplatesDialog,
} from '@/components/agent-workflow/WorkflowTemplatesDialog'
import type { WorkflowTemplate } from '@/components/agent-workflow/agent-workflow-templates'
import { diagramFromGenerationPlanSafe } from '@/components/agent-workflow/workflow-from-generation'
import {
  keepAgentSettings,
  planFromDiagram,
  type CanvasPlan,
} from '@/components/agent-workflow/workflow-plan-from-diagram'
import { cn } from '@/utils/cn'
import {
  BookOpen,
  Copy,
  Database,
  Play,
  Settings2,
  Trash2,
  Unlink,
  Wrench,
} from 'lucide-react'
import { addNodeAfter } from '@/components/agent-workflow/add-node-after'
import {
  NodeContextMenu,
  type NodeContextMenuState,
  type NodeMenuEntry,
} from '@/components/agent-workflow/NodeContextMenu'
import {
  diagramContentCenter,
  offsetToPlaceDiagram,
} from '@/components/agent-workflow/sub-workflow-ops'
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
// Whether the outline panel beside the library's icon column is open (desktop)
const OUTLINE_OPEN_KEY = 'eleven-nodes-agent-workflow-outline-open'
const STATUS_LABEL: Record<DeploymentStatus, string> = {
  draft: 'Draft',
  validated: 'Validated',
  deployed: 'Deployed',
  failed: 'Failed',
}

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
  const [showMap, setShowMap] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [validationIssues, setValidationIssues] = useState<WorkflowValidationIssue[]>([])
  const [isValidated, setIsValidated] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [testInput, setTestInput] = useState('')
  // Something from the library that goes under an agent, waiting for the user to pick which one.
  const [pendingAttach, setPendingAttach] = useState<
    | { kind: 'palette'; paletteId: string; openAfter?: boolean }
    | { kind: 'capability'; capability: AgentCapability }
    | null
  >(null)
  const [attachTarget, setAttachTarget] = useState<{
    agentId: string
    kind: AgentCapabilityKind
  } | null>(null)
  const [generatePanelOpen, setGeneratePanelOpen] = useState(false)
  // Workflow AI widened over the workspace (the canvas area), keeping the library and status bar.
  const [aiExpanded, setAiExpanded] = useState(false)
  useEffect(() => {
    if (!generatePanelOpen) setAiExpanded(false)
  }, [generatePanelOpen])
  // Desktop: what is opened as a card on the canvas (replaces the right details panel).
  const [editorFocus, setEditorFocus] = useState<EditorFocus | null>(null)
  // The node actions menu (right-click on a node, or "⋯" on its expanded card).
  const [nodeMenu, setNodeMenu] = useState<NodeContextMenuState | null>(null)
  // The "add after" menu, opened from the "+" beside a node's output port.
  const [addAfterMenu, setAddAfterMenu] = useState<NodeContextMenuState | null>(null)
  // The "insert between" menu, opened from the "+" on a connector (`nodeId` holds the edge id).
  const [insertMenu, setInsertMenu] = useState<NodeContextMenuState | null>(null)
  // Workflow AI conversations; the open one feeds the chat.
  const chats = useChatSessions()
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
  const showDeploymentsBoard = librarySection === 'deployments'
  const [executionPanelOpen, setExecutionPanelOpen] = useState(false)
  // Desktop opens on the map; mobile has no map and shows the canvas for it.
  const [editorView, setEditorView] = useState<WorkflowEditorViewMode>('map')
  const [mapZoom, setMapZoom] = useState(1)
  // Bumped by "fit" to put the map back in the middle
  const [mapKey, setMapKey] = useState(0)
  const [mapFilters, setMapFilters] = useState<MapFilters>(DEFAULT_MAP_FILTERS)
  const [outlineOpen, setOutlineOpen] = useState(() => {
    try {
      return window.localStorage.getItem(OUTLINE_OPEN_KEY) !== '0'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(OUTLINE_OPEN_KEY, outlineOpen ? '1' : '0')
    } catch {
      // Storage blocked: the panel just opens by default next time.
    }
  }, [outlineOpen])
  // The Executions view (top nav): run history with each agent's trace and output.
  const [showExecutions, setShowExecutions] = useState(false)
  const [showConfiguration, setShowConfiguration] = useState(false)
  // The app rail's Custom code area: the user's own tools, middlewares, skills and context providers
  const [showCustomCode, setShowCustomCode] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('trace')
  const { state: runState, start: startExecution, submitApproval, submitFeedback, cancel: cancelExecution, reset: resetExecution } =
    useWorkflowRunner()
  const { modelConfig: serverModelConfig, configured: llmConfigured } =
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
    createWorkflowTab,
    createNewWorkspace,
    renamePage,
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

  // File → Import: a workflow JSON file whose nodes are copied onto this canvas.
  const [importOpen, setImportOpen] = useState(false)
  const importWorkflowDocument = useCallback(
    (imported: DiagramDocument, configuration?: Partial<WorkflowConfiguration>) => {
      const sourcePage = imported.pages.find((page) => page.id === imported.activePageId) ?? imported.pages[0]
      if (!sourcePage || sourcePage.diagram.nodes.length === 0) {
        toast.error('No workflow found in the file.')
        return
      }
      const startsEmpty = isBlankDiagram(diagram)
      // Onto an empty tab the file keeps its own positions; otherwise it lands beside what's there.
      const offset = startsEmpty
        ? { x: 0, y: 0 }
        : offsetToPlaceDiagram(diagram, sourcePage.diagram, getCanvasInsertAnchor())
      const result = importIntoDocument(doc, imported, doc.activePageId, offset)
      if (!result) {
        toast.error('No workflow found in the file.')
        return
      }
      invalidateValidation()
      setDoc(result.document)
      // The file's Configuration settings replace this workflow's only when starting from empty.
      if (configuration && startsEmpty) {
        updateWorkflowConfiguration(pageWorkflowId(doc, doc.activePageId), configuration)
      }
      setSelection(null)
      requestAnimationFrame(() => canvasRef.current?.fitView())
      toast.success(`Imported "${result.pageName}".`)
    },
    [diagram, doc, getCanvasInsertAnchor, setDoc, invalidateValidation],
  )

  // ?open=<workflowId> (e.g. "Open in canvas" in the Admin Center): show that workflow in its own
  // tab under the same workflow id, so saving it updates the stored workflow (and, for a published
  // assistant, what everyone's chat runs). A tab that already has it is just selected.
  const openRequested = useRef<string | null>(null)
  useEffect(() => {
    const workflowId = new URLSearchParams(location.search).get('open')
    if (!workflowId || openRequested.current === workflowId) return
    openRequested.current = workflowId
    navigate(location.pathname, { replace: true })
    const existing = doc.pages.find((page) => page.workflowId === workflowId)
    if (existing) {
      setDoc((previous) => ({ ...previous, activePageId: existing.id }))
      return
    }
    void fetchWorkflowDefinition(workflowId)
      .then(({ name, definition }) => {
        const imported = parseWorkflowFile(JSON.stringify(definition))
        const page = { ...createPage(name), workflowId }
        const withPage = { ...doc, pages: [...doc.pages, page] }
        const result = importIntoDocument(withPage, imported.document, page.id, { x: 0, y: 0 })
        if (!result) throw new Error('The workflow has no canvas to open.')
        setDoc({ ...result.document, activePageId: page.id, activeMainPageId: page.id })
        if (imported.configuration) updateWorkflowConfiguration(workflowId, imported.configuration)
        requestAnimationFrame(() => canvasRef.current?.fitView())
        toast.success(`Opened "${name}". Saving it updates the stored workflow.`)
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not open the workflow.'))
  }, [location.search, location.pathname, navigate, doc, setDoc])

  const workflowMeta = doc.workflow ?? defaultWorkflowMeta()
  const activeWorkflowId = pageWorkflowId(doc, doc.activePageId)
  const activity = useWorkflowActivity(activeWorkflowId)
  // Settings (desktop) is a page in the workspace, kept in `?settings=<tab>` so it can be linked to
  const settingsParam = new URLSearchParams(location.search).get('settings')
  const settingsTab: SettingsTab | null = !isMobile && isSettingsTab(settingsParam) ? settingsParam : null
  const openSettings = useCallback(
    (tab: SettingsTab | null) => {
      const params = new URLSearchParams(location.search)
      if (tab) params.set('settings', tab)
      else params.delete('settings')
      const search = params.toString()
      navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true })
    },
    [location.pathname, location.search, navigate],
  )
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
    if (isMobile) navigate(ROUTES.agentWorkflowLogs)
    else {
      setShowConfiguration(false)
      setShowCustomCode(false)
      setShowExecutions(true)
    }
  }, [isMobile, navigate])

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

  // Desktop: the right panel hosts Workflow AI, and the workflow's Insights when the chat is closed
  // (node details open as cards on the canvas); opening the chat opens the panel, closing it leaves
  // the panel as the user had it. Mobile: expand details when a node/edge is selected; collapse
  // when the canvas is cleared.
  useEffect(() => {
    if (!isMobile) {
      if (generatePanelOpen) right.expand()
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

  const addToolForAgent = useCallback(
    (
      agentId: string,
      options?: {
        paletteId?: string
        label?: string
        toolId?: string
        mcpUrl?: string
        /** Leave the selection alone (the attach list stays open to add more). */
        keepSelection?: boolean
      },
    ) => {
      const paletteId = options?.paletteId ?? TOOL_PALETTE_ID
      const item = paletteById.get(paletteId)
      if (!item) return undefined
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
      if (!options?.keepSelection) setSelection({ kind: 'node', id: nodeId })
      return nodeId
    },
    [paletteById, handleChange],
  )

  const attachCapabilityToAgent = useCallback(
    (agentId: string, capability: AgentCapability, options?: { keepSelection?: boolean }) => {
      addToolForAgent(agentId, {
        paletteId: capability.paletteId,
        label: capability.nodeLabel ?? capability.label,
        toolId: capability.id,
        mcpUrl: capability.mcpUrl,
        keepSelection: options?.keepSelection,
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
        setLibrarySection('models')
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
  const { catalog: modelCatalog } = useModelCatalog()

  const { connections: modelClients } = useModelConnections()
  const assignModelProvider = useCallback(
    (agentId: string, providerId: ModelProviderId) => {
      // A saved model client (yours or the admin's) picked or dropped from the library.
      if (providerId.startsWith(MODEL_CLIENT_REF_PREFIX)) {
        const client = modelClients.find((item) => modelClientRef(item.id) === providerId)
        const target = diagram.nodes.find((node) => node.id === agentId)
        if (!client || !target?.agent || !isAgentNode(target)) return
        handleChange((previous) => ({
          ...previous,
          nodes: previous.nodes.map((node) =>
            node.id === agentId && node.agent
              ? {
                  ...node,
                  agent: {
                    ...node.agent,
                    modelConnectionId: client.id,
                    modelProvider: connectionProviderId(client.providerType),
                    model: client.model,
                  },
                }
              : node,
          ),
        }))
        toast.success(`${target.label} runs on ${client.name} · ${client.model}`)
        return
      }
      const provider = modelProviderById(providerId)
      const agentNode = diagram.nodes.find((node) => node.id === agentId)
      if (!provider || !agentNode?.agent || !isAgentNode(agentNode)) return
      const model = modelForProvider(
        provider,
        agentNode.agent.model,
        catalogModelsFor(modelCatalog, provider.id).map((item) => item.id),
      )
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
    [diagram.nodes, handleChange, modelCatalog, modelClients],
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
  const modelTargetProviderId = modelTargetNode?.agent?.modelConnectionId
    ? modelClientRef(modelTargetNode.agent.modelConnectionId)
    : resolveModelProvider(modelTargetNode?.agent)?.id

  // The model-client target only lasts while the library's blocks section is open.
  useEffect(() => {
    if (librarySection !== 'models' && librarySection !== 'blocks') setModelTargetAgentId(null)
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
        toast.success('Added a Human Review step')
      }
    },
    [paletteById, handleChange],
  )

  useEffect(() => {
    const onInsertReview = (event: Event) => {
      const edgeId = (event as CustomEvent<{ edgeId?: string }>).detail?.edgeId
      if (edgeId) handleInsertHitlOnEdge(edgeId)
    }
    window.addEventListener(INSERT_REVIEW_ON_EDGE_EVENT, onInsertReview)
    return () => window.removeEventListener(INSERT_REVIEW_ON_EDGE_EVENT, onInsertReview)
  }, [handleInsertHitlOnEdge])

  /** The agent library items go under: the open or selected agent, else the only one. */
  const libraryTargetAgentId = useCallback((): string | null => {
    const agents = listAgentNodes(diagram)
    const isAgent = (id: string | null | undefined) => Boolean(id && agents.some((agent) => agent.id === id))
    const focusedId = editorFocus?.kind === 'node' ? editorFocus.id : null
    const selectedId = selection?.kind === 'node' ? selection.id : null
    return [focusedId, selectedId].find(isAgent) ?? (agents.length === 1 ? agents[0].id : null)
  }, [diagram, editorFocus, selection])

  const addBlock = useCallback(
    (paletteId: string, options?: { openAfter?: boolean }): string | undefined => {
      const item = paletteById.get(paletteId)
      if (!item) return undefined

      if (isMappedToolPalette(paletteId)) {
        if (listAgentNodes(diagram).length === 0) {
          toast.error('Add an agent before adding tools')
          return undefined
        }
        const target = libraryTargetAgentId()
        if (target) return addToolForAgent(target, { paletteId })
        setPendingAttach({ kind: 'palette', paletteId, openAfter: options?.openAfter })
        return undefined
      }

      if (paletteId === START_NODE_PALETTE_ID && findStartNode(diagram)) {
        toast.message('Start is already on this workflow tab')
        return undefined
      }
      if (paletteId === END_NODE_PALETTE_ID && findEndNode(diagram)) {
        toast.message('End is already on this workflow tab')
        return undefined
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
      return node.id
    },
    [paletteById, diagram, handleChange, addToolForAgent, getCanvasInsertAnchor, libraryTargetAgentId],
  )

  /** A ready-made tool / skill / integration / MCP server / memory from the library, under an agent. */
  const addCapabilityFromLibrary = useCallback(
    (capabilityId: string) => {
      const capability = findCapability(capabilityId)
      if (!capability) return
      if (listAgentNodes(diagram).length === 0) {
        toast.error(`Add an agent first, then add ${capability.label}`)
        return
      }
      const target = libraryTargetAgentId()
      if (target) attachCapabilityToAgent(target, capability)
      else setPendingAttach({ kind: 'capability', capability })
    },
    [diagram, libraryTargetAgentId, attachCapabilityToAgent],
  )

  /** "Create your own": a blank agent, tool or skill, opened so the user can define it. */
  const createCustomBlock = useCallback(
    (kind: CustomBlockKind) => {
      const paletteId = kind === 'agent' ? AGENT_PALETTE_ID : kind === 'tool' ? TOOL_PALETTE_ID : SKILL_PALETTE_ID
      const nodeId = addBlock(paletteId, { openAfter: true })
      if (nodeId && !isMobile) setEditorFocus({ kind: 'node', id: nodeId })
    },
    [addBlock, isMobile],
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
      const reviewItem = paletteById.get(HITL_PALETTE_ID)
      const withStart = withStartNode(enrichDiagram(generated.diagram, paletteById))
      // Approvals in the plan become Human Review steps on the canvas.
      const enrichedDiagram = reviewItem ? promoteConnectorApprovals(withStart, reviewItem) : withStart
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
            messages: chats.active.messages,
            onMessagesChange: chats.setMessages,
            chats: {
              sessions: chats.sessions,
              activeId: chats.active.id,
              onSelect: chats.selectChat,
              onNew: chats.newChat,
              onDelete: chats.deleteChat,
            },
            model: generateModel,
            onModelChange: setGenerateModelChoice,
            ollamaBaseUrl,
            replacesCanvas: canvasHasAgents,
            getCurrentWorkflow,
            onGenerated: handleWorkflowGenerated,
            // The assistant's complete workflow lands exactly as File → Import would place it.
            onImportWorkflow: (imported: ImportedWorkflow) =>
              importWorkflowDocument(imported.document, imported.configuration),
            onClose: closeGeneratePanel,
          }
        : null,
    [
      generatePanelOpen,
      chats,
      generateModel,
      ollamaBaseUrl,
      canvasHasAgents,
      getCurrentWorkflow,
      handleWorkflowGenerated,
      importWorkflowDocument,
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
      toast.success('Workflow saved to the database')
    } else {
      toast.warning('Saved on this device only', {
        description: result.databaseError ?? 'The database could not be reached.',
      })
    }
    markSaved(nextDoc)
  }, [doc, setDoc, activePage.id, diagram, paletteById, serverModelConfig, markSaved])

  // Admins choose what a workflow is for; "ai_assistant" publishes it as everyone's chat assistant.
  const [isAdmin, setIsAdmin] = useState(false)
  const [assistantWorkflowId, setAssistantWorkflowId] = useState<string | null>(null)
  const [purposeBusy, setPurposeBusy] = useState(false)
  useEffect(() => {
    let live = true
    void fetchAccessRole().then((role) => {
      if (!live || role !== 'admin') return
      setIsAdmin(true)
      fetchAssistant()
        .then((assistant) => live && setAssistantWorkflowId(assistant?.workflowId ?? null))
        .catch(() => undefined)
    })
    return () => {
      live = false
    }
  }, [])
  const activePurposeWorkflowId = pageWorkflowId(doc, activePage.id)
  const handlePurposeChange = useCallback(
    async (purpose: WorkflowPurpose) => {
      setPurposeBusy(true)
      try {
        // Publish what is on the canvas now: the server publishes the saved copy.
        await handleSave()
        await setWorkflowPurpose(activePurposeWorkflowId, purpose)
        forgetAssistantWorkflow()
        setAssistantWorkflowId((current) =>
          purpose === 'ai_assistant' ? activePurposeWorkflowId : current === activePurposeWorkflowId ? null : current,
        )
        toast.success(
          purpose === 'ai_assistant'
            ? 'Published as the AI assistant. Everyone\'s chat now runs this workflow; your saves update it.'
            : 'This is your own workflow again; the chat no longer runs it.',
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not change the purpose.')
      } finally {
        setPurposeBusy(false)
      }
    },
    [handleSave, activePurposeWorkflowId],
  )

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

  /** Check the workflow and save it as a draft. Run and Deploy call it on their own first. */
  const handleValidate = useCallback((options?: { quiet?: boolean }): Promise<boolean> => {
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
          : `Fix ${issues.filter((issue) => issue.severity === 'error').length} issue(s) before running`,
      )
      return Promise.resolve(false)
    }

    const session = getSession()
    if (!session) {
      toast.error('Sign in before running the workflow.')
      return Promise.resolve(false)
    }
    const page = doc.pages.find((candidate) => candidate.id === doc.activePageId) ?? doc.pages[0]
    if (!page) {
      toast.error('No workflow page found.')
      return Promise.resolve(false)
    }

    const document = buildOrchestrationDocument({
      doc,
      pageId: page.id,
      diagram,
      workspaceId: session.workspaceId,
      userId: session.accountId,
    })
    return saveOrchestration({
      identity: orchestrationIdentity(page.id, pageWorkflowId(doc, page.id)),
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
        if (!options?.quiet) toast.success('Workflow checked and draft saved')
        return true
      })
      .catch((error: unknown) => {
        setIsValidated(false)
        toast.error(error instanceof Error ? error.message : 'Could not check the workflow.')
        return false
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

  const workspaceView: WorkspaceView = showConfiguration
    ? 'configuration'
    : showExecutions
      ? 'executions'
      : editorView
  const handleWorkspaceViewChange = useCallback((view: WorkspaceView) => {
    if (settingsTab) openSettings(null)
    setLibrarySection((section) => (section === 'deployments' ? null : section))
    setShowExecutions(view === 'executions')
    setShowConfiguration(view === 'configuration')
    setShowCustomCode(false)
    if (view === 'map' || view === 'canvas' || view === 'code') setEditorView(view)
  }, [openSettings, settingsTab])

  // The app rail's areas: the editor (map, canvas or code), runs, configuration and deployments
  const appRailView: AppRailView = settingsTab
    ? 'settings'
    : showDeploymentsBoard
    ? 'deployments'
    : showCustomCode
      ? 'code'
    : showConfiguration
      ? 'configuration'
      : showExecutions
        ? 'executions'
        : 'editor'
  const handleAppRailChange = useCallback((view: AppRailView) => {
    if (view === 'settings') {
      openSettings(settingsTab ?? 'insights')
      return
    }
    if (settingsTab) openSettings(null)
    setShowCustomCode(view === 'code')
    if (view === 'deployments') {
      setLibrarySection('deployments')
      return
    }
    setLibrarySection((section) => (section === 'deployments' ? null : section))
    setShowExecutions(view === 'executions')
    setShowConfiguration(view === 'configuration')
  }, [openSettings, settingsTab])

  // Blocks are dropped on the canvas, so opening the library leaves the map for it.
  useEffect(() => {
    if (librarySection && librarySection !== 'deployments' && editorView === 'map') setEditorView('canvas')
  }, [librarySection, editorView])

  const canvasView = useMemo(
    () => ({
      showGrid,
      onShowGridChange: setShowGrid,
      snapToGrid,
      onSnapToGridChange: setSnapToGrid,
      showMap,
      onShowMapChange: setShowMap,
    }),
    [showGrid, snapToGrid, showMap],
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

  const deployValidated = useCallback(() => {
    const session = getSession()
    if (!session) {
      toast.error('Sign in to deploy a workflow instance')
      return
    }
    const version = getNextPublishedVersion(
      session.accountId,
      session.workspaceId,
      activeWorkflowId,
      workflowMeta.version ?? 0,
    )
    const deployment: WorkflowDeployment = {
      workflowId: activeWorkflowId,
      endpointUrl: `https://api.elevennodes.app/v1/workflows/${activeWorkflowId}/v/${version}/run`,
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

  /** Deploy, checking (and saving) the workflow first when it changed since the last check. */
  const handleDeploy = useCallback(async () => {
    if (!isValidated && !(await handleValidate({ quiet: true }))) return
    deployValidated()
  }, [isValidated, handleValidate, deployValidated])

  const executeValidated = useCallback(() => {
    if (runState.status === 'running' || runState.status === 'waiting-approval') {
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
      identity: orchestrationIdentity(page.id, pageWorkflowId(docToSave, page.id)),
      name: page.name,
      document,
    })
      .then(() => {
        resetExecution()
        return startExecution(executionPlan, testInput, {
          workflowId: pageWorkflowId(docToSave, page.id),
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

  /** Run, checking (and saving) the workflow first when it changed since the last check. */
  const handleExecute = useCallback(async () => {
    if (runState.status === 'running' || runState.status === 'waiting-approval') return
    if (!isValidated && !(await handleValidate({ quiet: true }))) return
    executeValidated()
  }, [runState.status, isValidated, handleValidate, executeValidated])

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
  // The status bar's issues follow the canvas as it is edited, not just the last Validate
  const liveIssues = useMemo(() => validateWorkflow(diagram, paletteById), [diagram, paletteById])
  const handleSelectIssue = useCallback(
    (issue: WorkflowValidationIssue) => {
      if (issue.nodeId) {
        setSelection({ kind: 'node', id: issue.nodeId })
        handleNodeOpen(issue.nodeId)
      } else if (issue.edgeId) {
        setSelection({ kind: 'edge', id: issue.edgeId })
        handleEdgeOpen(issue.edgeId)
      }
    },
    [handleNodeOpen, handleEdgeOpen],
  )
  /** A node picked on the map, in the outline or in search: open it as a card on the canvas. */
  const openNodeOnCanvas = useCallback(
    (nodeId: string) => {
      setShowExecutions(false)
      setShowConfiguration(false)
      setShowCustomCode(false)
      setLibrarySection((section) => (section === 'deployments' ? null : section))
      setEditorView('canvas')
      setSelection({ kind: 'node', id: nodeId })
      handleNodeOpen(nodeId)
    },
    [handleNodeOpen],
  )
  const selectIssueOnCanvas = useCallback(
    (issue: WorkflowValidationIssue) => {
      setShowExecutions(false)
      setShowConfiguration(false)
      setShowCustomCode(false)
      setEditorView('canvas')
      handleSelectIssue(issue)
    },
    [handleSelectIssue],
  )
  const headerZoom = useCallback(
    (factor: number) => {
      if (editorView === 'map') setMapZoom((zoom) => Math.min(3, Math.max(0.4, zoom * factor)))
      else zoomBy(factor)
    },
    [editorView, zoomBy],
  )
  const headerFit = useCallback(() => {
    if (editorView === 'map') {
      setMapZoom(1)
      setMapKey((key) => key + 1)
    } else canvasRef.current?.fitView()
  }, [editorView])
  const workflowSubtitle = useMemo(() => {
    const orchestration = findOrchestration(diagram)
    const pattern = orchestration ? PATTERN_META[orchestration.pattern].label : 'Sequential'
    const count = agentNodes.length
    return `${pattern} workflow · ${count} agent${count === 1 ? '' : 's'} · v${workflowMeta.version ?? 0}`
  }, [diagram, agentNodes.length, workflowMeta.version])

  const isExecutionMode = runState.status !== 'idle'
  const isExecuting = runState.status === 'running' || runState.status === 'waiting-approval'

  // Each finished run goes into the execution history (the Executions view).
  const runStartRef = useRef<{ startedAt: string; input: string } | null>(null)
  useEffect(() => {
    const status = runState.status
    if (status === 'running' && !runStartRef.current) {
      runStartRef.current = { startedAt: new Date().toISOString(), input: testInput }
      return
    }
    if ((status === 'completed' || status === 'failed' || status === 'cancelled') && runStartRef.current) {
      const start = runStartRef.current
      runStartRef.current = null
      addExecution({
        id: runState.runId ?? `run-${Date.now().toString(36)}`,
        runId: runState.runId,
        workflowName,
        pageId: doc.activePageId,
        status,
        input: start.input,
        startedAt: start.startedAt,
        finishedAt: new Date().toISOString(),
        trace: runState.trace,
        messages: runState.messages,
        stepOutputs: runState.stepOutputs,
        finalResponse: runState.finalResponse,
        errors: runState.errors,
        warnings: runState.warnings,
      })
    }
    // Recorded once per transition; the other values are read as they are at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState.status])
  const displayTrace = runState.trace

  // Earlier runs of this tab stay in the run chat (oldest first). Once a run ends it is also the
  // newest history entry, so it is left out while it is still the run on screen.
  const executions = useExecutions()
  const chatHistory = useMemo(() => {
    const runs = executions.filter((record) => record.pageId === doc.activePageId)
    const finished = runState.status === 'completed' || runState.status === 'failed' || runState.status === 'cancelled'
    return (finished ? runs.slice(1) : runs).reverse()
  }, [executions, doc.activePageId, runState.status])
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

  /** A new, unplaced flow block (agent, review, End, …) sized for the current flow direction. */
  const createFlowBlock = useCallback(
    (paletteId: string, item: PaletteItem): DiagramNode =>
      enrichAgentNode(
        paletteId === END_NODE_PALETTE_ID
          ? createFlowBoundaryNode(paletteId, 0, 0, item.label)
          : {
              id: createNodeId(),
              paletteId,
              label: item.label,
              x: 0,
              y: 0,
              ...flowNodeSize({ id: '', paletteId, label: item.label, x: 0, y: 0 }, diagram.direction),
            },
        item,
      ),
    [diagram.direction],
  )

  /** A block added right after `sourceId`, connected from it. End is reused when the tab has one. */
  const addBlockAfter = useCallback(
    (sourceId: string, paletteId: string) => {
      const item = paletteById.get(paletteId)
      if (!item) return
      const existingEnd = paletteId === END_NODE_PALETTE_ID ? findEndNode(diagram) : undefined
      if (existingEnd) {
        if (diagram.edges.some((edge) => edge.from === sourceId && edge.to === existingEnd.id)) {
          toast.message('Already connected to End')
          return
        }
        handleChange((previous) => ({
          ...previous,
          edges: [
            ...previous.edges,
            {
              id: `edge-${createNodeId()}`,
              from: sourceId,
              to: existingEnd.id,
              ...flowPortSides(previous.direction),
              routing: 'curved',
            },
          ],
        }))
        return
      }
      const node = createFlowBlock(paletteId, item)
      handleChange((previous) => addNodeAfter(previous, sourceId, node))
      setSelection({ kind: 'node', id: node.id })
    },
    [paletteById, diagram, handleChange, createFlowBlock],
  )

  /** A block put on a connector, between its two ends. A Human Review reuses the review insert. */
  const insertBlockOnEdge = useCallback(
    (edgeId: string, paletteId: string) => {
      if (paletteId === HITL_PALETTE_ID) {
        handleInsertHitlOnEdge(edgeId)
        return
      }
      const item = paletteById.get(paletteId)
      if (!item) return
      const node = createFlowBlock(paletteId, item)
      handleChange((previous) => insertNodeOnEdge(previous, edgeId, node) ?? previous)
      setSelection({ kind: 'node', id: node.id })
    },
    [paletteById, handleChange, handleInsertHitlOnEdge, createFlowBlock],
  )

  /** A picked capability goes under the node the "+" was clicked on (an agent). */
  const attachCapabilityById = useCallback(
    (agentId: string, capabilityId: string) => {
      const capability = findCapability(capabilityId)
      if (capability) attachCapabilityToAgent(agentId, capability)
    },
    [attachCapabilityToAgent],
  )

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
              // Stay on the attach list so several tools can be added in a row.
              onAttach: (capability) =>
                attachCapabilityToAgent(attachTarget.agentId, capability, { keepSelection: true }),
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
  const selectionBar = null

  const outlinePanel = (
    <WorkflowOutlinePanel
      diagram={diagram}
      pages={doc.pages}
      activePageId={doc.activePageId}
      onSelectPage={handleSelectPage}
      onAddPage={handleAddMainPage}
      onRenamePage={renamePage}
      onDeletePage={handleDeletePage}
      onOpenNode={openNodeOnCanvas}
      filters={mapFilters}
      onFiltersChange={setMapFilters}
      workflowName={workflowName}
      modelLabel={toolbarModelConfig?.model}
      version={workflowMeta.version}
      statusLabel={STATUS_LABEL[workflowMeta.status] ?? workflowMeta.status}
      onCollapse={() => setOutlineOpen(false)}
    />
  )

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
      ) : null}

      {/* Desktop: the blue app rail down the left, then the top bar over everything else */}
      <div className={isMobile ? 'contents' : 'flex min-h-0 flex-1'}>
      {!isMobile && (
        <WorkspaceAppRail
          view={appRailView}
          onViewChange={handleAppRailChange}
          onAddBlocks={() => (librarySection === 'blocks' ? setLibrarySection(null) : openLibrary())}
          addBlocksOpen={librarySection === 'blocks'}
          onAskAi={openGeneratePanel}
          onNavigateHome={handleNavigateHome}
          onOpenSettings={openWorkflowSettings}
          canvasView={canvasView}
        />
      )}
      <div className={isMobile ? 'contents' : 'flex min-w-0 flex-1 flex-col'}>
      {!isMobile && (
        <WorkspaceTopBar
          diagram={diagram}
          pages={doc.pages}
          activePageId={doc.activePageId}
          onOpenNode={openNodeOnCanvas}
          onSelectPage={handleSelectPage}
          issues={liveIssues}
          onSelectIssue={selectIssueOnCanvas}
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
                        attachCapabilityToAgent(attachTarget.agentId, capability, { keepSelection: true })
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
              : cn('flex min-h-0 min-w-0 flex-col', aiExpanded && !showDeploymentsBoard ? 'flex-none' : 'flex-1')
          }
        >
          {showDeploymentsBoard ? (
            <div className="flex min-h-0 flex-1">
              <DeploymentsCanvasView onBackToCanvas={handleBackFromDeployments} />
            </div>
          ) : (
          <>

          <div className="flex min-h-0 flex-1">
            {/* The workspace toolbar (library and outline) belongs to the editor only */}
            {!isMobile && !settingsTab && !showExecutions && !showConfiguration && !showCustomCode && (
              <AgentLibrarySidebar
                onAddAgent={addBlock}
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
                onAddCapability={addCapabilityFromLibrary}
                onCreateCustom={createCustomBlock}
                modelTargetLabel={modelTargetLabel}
                activeModelProviderId={modelTargetProviderId}
                compactRail
                outline={outlineOpen && !settingsTab ? outlinePanel : undefined}
                onToggleOutline={() => setOutlineOpen((open) => !open)}
              />
            )}

            <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', aiExpanded && 'hidden')}>
              {settingsTab ? (
                <WorkspaceSettingsView
                  tab={settingsTab}
                  onTabChange={openSettings}
                  insights={
                    <WorkflowInsightsPanel workflowId={activeWorkflowId} name={workflowName} diagram={diagram} />
                  }
                  workflowSettings={
                    <WorkflowSettingsSection
                      doc={doc}
                      diagram={diagram}
                      modelConfig={workflowMeta.modelConfig ?? serverModelConfig}
                      serverModelConfig={serverModelConfig}
                      onWorkflowMetaChange={handleWorkflowMetaChange}
                      onModelConfigChange={handleModelConfigChange}
                      llmConfigured={llmConfigured}
                    />
                  }
                />
              ) : showCustomCode ? (
                <CustomCodeView />
              ) : (
              <>
              {/* The workflow header (name, Run, Save…) belongs to the editor: map, canvas and code */}
              {!isMobile && !showExecutions && !showConfiguration && (
                <WorkflowContentHeader
                  name={workflowName}
                  onNameChange={handleWorkflowNameChange}
                  subtitle={workflowSubtitle}
                  status={workflowMeta.status}
                  isDirty={isDirty}
                  view={workspaceView}
                  onViewChange={handleWorkspaceViewChange}
                  onRun={openExecutionPanel}
                  canRun={agentNodes.length > 0 && !isExecuting}
                  isExecuting={isExecuting}
                  onSave={handleSave}
                  onAskAi={openGeneratePanel}
                  onShare={() => setShareOpen(true)}
                  onDeploy={handleDeploy}
                  canDeploy={isValidated}
                  purpose={
                    isAdmin
                      ? {
                          value: assistantWorkflowId === activePurposeWorkflowId ? 'ai_assistant' : 'user_build',
                          onChange: (next) => void handlePurposeChange(next),
                          busy: purposeBusy,
                        }
                      : undefined
                  }
                  onZoomIn={() => headerZoom(1.2)}
                  onZoomOut={() => headerZoom(1 / 1.2)}
                  onFit={headerFit}
                  onAutoLayout={workspaceView === 'canvas' ? runAutoLayout : undefined}
                  onUndo={workspaceView === 'canvas' ? handleUndo : undefined}
                  flowDirection={resolveFlowDirection(diagram.direction)}
                  onFlowDirectionChange={workspaceView === 'canvas' ? handleFlowDirectionChange : undefined}
                />
              )}
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
                  {showConfiguration ? (
                    <WorkflowConfigurationView
                      workflowId={activeWorkflowId}
                      settings={tool?.designer?.configuration}
                    />
                  ) : showExecutions ? (
                    <ExecutionsView pageId={doc.activePageId} />
                  ) : editorView === 'map' && !isMobile ? (
                    <WorkflowMapView
                      key={mapKey}
                      diagram={diagram}
                      workflowName={workflowName}
                      activity={activity.workflow}
                      filters={mapFilters}
                      zoom={mapZoom}
                      onZoomChange={setMapZoom}
                      onOpenNode={openNodeOnCanvas}
                      onOpenCanvas={() => setEditorView('canvas')}
                    />
                  ) : editorView === 'canvas' || editorView === 'map' ? (
                    <AgentWorkflowCanvas
                      ref={canvasRef}
                      diagram={diagram}
                      paletteById={paletteById}
                      onChange={handleChange}
                      selection={selection}
                      onSelectionChange={handleSelectionChange}
                      snapToGrid={snapToGrid}
                      showGrid={showGrid}
                      showMap={showMap}
                      activePageId={activePage.id}
                      onAutoLayout={runAutoLayout}
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
                      onAddNodeAfter={(nodeId, x, y) => setAddAfterMenu({ nodeId, x, y })}
                      onInsertNodeOnEdge={(edgeId, x, y) => setInsertMenu({ nodeId: edgeId, x, y })}
                      hideEmptyState
                      onOpenLibrary={isMobile ? undefined : openLibrary}
                      onBrowseTemplates={() => setImportOpen(true)}
                      onAskAi={openGeneratePanel}
                      onClearCanvas={handleClearCanvas}
                      hideControls={!isMobile}
                    />
                  ) : (
                    <WorkflowBuildCodeView
                      doc={doc}
                      pageId={activePage.id}
                      pageName={activePage.name}
                      diagram={diagram}
                      paletteById={paletteById}
                      serverModelConfig={serverModelConfig}
                      configurationDefaults={
                        tool?.designer?.configuration?.defaults as Partial<WorkflowConfiguration> | undefined
                      }
                    />
                  )}
                </>
              )}

              {isMobile ? (
                <PagesBar
                  pages={doc.pages}
                  activePageId={doc.activePageId}
                  onSelect={handleSelectPage}
                  onAdd={handleAddMainPage}
                  onRename={renamePage}
                  onDelete={handleDeletePage}
                  density="comfortable"
                />
              ) : workspaceView === 'map' || workspaceView === 'canvas' ? (
                <WorkflowTimeline days={ACTIVITY_DAYS} daily={activity.daily} onRefresh={activity.reload} />
              ) : null}
              </>
              )}

            </div>
          </div>
          </>
          )}
        </div>
        )}

        {/* Desktop: the right panel hosts Workflow AI, or the workflow's Insights when the chat is closed;
            node details open as cards on the canvas. */}
        {/* Desktop: the right panel only holds Workflow AI; insights and settings are in Settings */}
        {!isMobile && !showDeploymentsBoard && generatePanelOpen && (
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
            onWorkflowMetaChange={handleWorkflowMetaChange}
            onModelConfigChange={handleModelConfigChange}
            serverModelConfig={serverModelConfig}
            llmConfigured={llmConfigured}
            executionPanelOpen={false}
            generate={generateOptions ?? undefined}
            chatExpanded={aiExpanded}
            onChatExpandedChange={setAiExpanded}
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
              history: chatHistory,
              finalResponse: runState.finalResponse,
              errors: runState.errors,
              onShowDetails: showExecutionLogs,
              needsReview: Boolean(runState.approvalPrompt),
            }}
          />
        )}
      </div>

      </div>
      </div>

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
          onNewPage={handleAddPage}
          onNewWorkspace={handleCreateNewWorkspace}
          onSave={() => void handleSave()}
          onSaveAs={handleSaveAs}
          onImport={() => setImportOpen(true)}
          onExportJson={() => toast.info('Export coming soon')}
          onExportSvg={() => toast.info('Export coming soon')}
          onExportPng={() => toast.info('Export coming soon')}
          onExportPdf={() => toast.info('Export coming soon')}
          onInsertTemplates={() => setImportOpen(true)}
          onCreateWorkflowTab={handleCreateWorkflowTab}
          onInsertImport={() => setImportOpen(true)}
          onToggleCodeView={toggleCodeView}
          onDuplicate={() => toast.info('Duplicate coming soon')}
          onDeleteSelection={handleDeleteSelection}
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

      {addAfterMenu ? (
        <BlockPicker
          state={{
            x: addAfterMenu.x,
            y: addAfterMenu.y,
            title: `Add after ${diagram.nodes.find((node) => node.id === addAfterMenu.nodeId)?.label ?? 'this node'}`,
            allowCapabilities: Boolean(
              diagram.nodes.find((node) => node.id === addAfterMenu.nodeId && isAgentNode(node)),
            ),
            allowEnd: true,
          }}
          onPickBlock={(paletteId) => addBlockAfter(addAfterMenu.nodeId, paletteId)}
          onPickCapability={(capabilityId) => attachCapabilityById(addAfterMenu.nodeId, capabilityId)}
          onClose={() => setAddAfterMenu(null)}
        />
      ) : null}

      {insertMenu ? (
        <BlockPicker
          state={{ x: insertMenu.x, y: insertMenu.y, title: 'Insert between', allowCapabilities: false, allowEnd: false }}
          onPickBlock={(paletteId) => insertBlockOnEdge(insertMenu.nodeId, paletteId)}
          onPickCapability={() => {}}
          onClose={() => setInsertMenu(null)}
        />
      ) : null}

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        documentTitle={workflowName}
        toolId={TOOL_ID}
      />

      <SelectAgentDialog
        open={pendingAttach !== null}
        agents={agentNodes}
        onOpenChange={(open) => {
          if (!open) setPendingAttach(null)
        }}
        onSelect={(agentId) => {
          const pending = pendingAttach
          setPendingAttach(null)
          if (!pending) return
          if (pending.kind === 'capability') {
            attachCapabilityToAgent(agentId, pending.capability)
            return
          }
          const nodeId = addToolForAgent(agentId, { paletteId: pending.paletteId })
          if (nodeId && pending.openAfter && !isMobile) setEditorFocus({ kind: 'node', id: nodeId })
        }}
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

      <ImportWorkflowDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportDocument={importWorkflowDocument}
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
