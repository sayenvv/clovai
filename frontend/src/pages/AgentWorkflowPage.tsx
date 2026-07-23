import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppConfig } from '@/hooks/use-app-config'
import { selectedNodeIds, type Selection } from '@/components/designer/selection-utils'
import { DesignerMenubar } from '@/components/designer/DesignerMenubar'
import { ShareDialog } from '@/components/designer/ShareDialog'
import { PagesBar } from '@/components/designer/PagesBar'
import { resolveDesignerPalette } from '@/utils/resolve-designer-palette'
import {
  createNodeId,
  type Diagram,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type {
  AgentWorkflowMeta,
  WorkflowDeployment,
  WorkflowValidationIssue,
} from '@/types/agent-workflow'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'
import { AgentWorkflowHeader } from '@/components/agent-workflow/AgentWorkflowHeader'
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
  TOOL_NODE_HEIGHT,
  TOOL_NODE_WIDTH,
  TOOL_PALETTE_ID,
  isMappedToolPalette,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { SelectAgentDialog } from '@/components/agent-workflow/SelectAgentDialog'
import type { AgentCapability, AgentCapabilityKind } from '@/components/agent-workflow/agent-capabilities'
import type { AgentAttachAction } from '@/components/agent-workflow/AgentNodeCard'
import { insertHitlOnEdge, HITL_PALETTE_ID } from '@/components/agent-workflow/insert-hitl-on-edge'
import {
  ConvertSubWorkflowDialog,
  InsertWorkflowDialog,
} from '@/components/agent-workflow/InsertWorkflowDialog'
import { GenerateWorkflowDialog } from '@/components/agent-workflow/GenerateWorkflowDialog'
import {
  WorkflowTemplateGrid,
  WorkflowTemplatesDialog,
} from '@/components/agent-workflow/WorkflowTemplatesDialog'
import type { WorkflowTemplate } from '@/components/agent-workflow/agent-workflow-templates'
import { diagramFromGenerationPlanSafe } from '@/components/agent-workflow/workflow-from-generation'
import { Button } from '@/components/ui/button'
import { diagramContentCenter } from '@/components/agent-workflow/sub-workflow-ops'
import {
  attachToolToAgent,
  isAgentNode,
  listAgentNodes,
  pickAgentForToolPlacement,
  removeToolsMappedToAgent,
  syncMappedToolLayout,
} from '@/components/agent-workflow/tool-agent-mapping'
import { autoLayoutNodes, inferWorkflowType, layoutWorkflowAgents, validateWorkflow } from '@/components/agent-workflow/validate-workflow'
import {
  AGENT_WORKFLOW_TOOL_ID,
  clearExecutionSnapshot,
  mergeDiagramIntoDocument,
  saveWorkflowDocument,
} from '@/components/agent-workflow/workflow-storage'
import { useWorkflowEditorPanels } from '@/components/agent-workflow/hooks/use-workflow-editor-panels'
import { useWorkflowDocument } from '@/components/agent-workflow/hooks/use-workflow-document'
import { persistWorkflowBuildSpec } from '@/components/agent-workflow/workflow-build-storage'
import { useServerLlmConfig } from '@/hooks/use-server-llm-config'
import { useSubWorkflowActions } from '@/components/agent-workflow/hooks/use-sub-workflow-actions'
import { useUnsavedWorkflowGuard } from '@/components/agent-workflow/hooks/use-unsaved-workflow-guard'
import { UnsavedChangesDialog } from '@/components/agent-workflow/UnsavedChangesDialog'
import type { WorkflowEditorViewMode } from '@/components/agent-workflow/WorkflowEditorViewToggle'
import { WorkflowBuildCodeView } from '@/components/agent-workflow/WorkflowBuildCodeView'
import { DevProfiler } from '@/utils/render-profiler'
import { APP_NAME, ROUTES } from '@/constants'
import { getSession } from '@/services/project-auth-store'
import { upsertPublishedInstance } from '@/services/published-instances-store'

const TOOL_ID = AGENT_WORKFLOW_TOOL_ID

function isValidWorkflowInput(raw: string): boolean {
  if (!raw.trim()) return false
  try {
    JSON.parse(raw)
    return true
  } catch {
    return false
  }
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
  const [testInput, setTestInput] = useState('{\n  "query": "Summarize the quarterly report"\n}')
  const [agentPickOpen, setAgentPickOpen] = useState(false)
  const [attachTarget, setAttachTarget] = useState<{
    agentId: string
    kind: AgentCapabilityKind
  } | null>(null)
  const [generateWorkflowOpen, setGenerateWorkflowOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [showCanvasEmptyState, setShowCanvasEmptyState] = useState(true)
  const [executionPanelOpen, setExecutionPanelOpen] = useState(false)
  const [editorView, setEditorView] = useState<WorkflowEditorViewMode>('canvas')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('trace')
  const [isPersistingExecution, setIsPersistingExecution] = useState(false)
  const { state: runState, start: startExecution, submitApproval, cancel: cancelExecution, reset: resetExecution } =
    useWorkflowRunner()
  const { modelConfig: serverModelConfig, configured: llmConfigured, isLoading: llmConfigLoading } =
    useServerLlmConfig()

  const { left, right, bottom } = useWorkflowEditorPanels()
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
    addPage,
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

  const openWorkflowSettings = useCallback(() => {
    keepRightOpenRef.current = true
    setSelection(null)
    right.expand()
  }, [right])

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
  const inferredType = useMemo(() => inferWorkflowType(diagram), [diagram])

  useEffect(() => {
    if (tool) document.title = `${tool.title} — ${APP_NAME}`
  }, [tool])

  useEffect(() => {
    if (runState.status === 'failed' && runState.errors.length > 0) {
      setInspectorTab('errors')
      if (bottom.collapsed) bottom.toggle()
    } else if (runState.status === 'waiting-approval') {
      keepRightOpenRef.current = true
      setExecutionPanelOpen(true)
      right.expand()
    }
  }, [runState.status, runState.errors.length, bottom.collapsed, bottom.toggle, right.expand])

  const handleSelectionChange = useCallback((next: Selection) => {
    setSelection(next)
    setAttachTarget((current) => {
      if (!current) return null
      if (next?.kind === 'node' && next.id === current.agentId) return current
      return null
    })
  }, [])

  // Expand details when a node/edge is selected; collapse when the canvas is cleared.
  useEffect(() => {
    const hasSelection = selection !== null
    if (hasSelection) {
      keepRightOpenRef.current = false
      right.expand()
      return
    }
    if (keepRightOpenRef.current || executionPanelOpen) {
      right.expand()
      return
    }
    right.collapse()
  }, [selection, executionPanelOpen, right.expand, right.collapse])

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

  const openCodeView = useCallback(() => setEditorView('code'), [])
  const toggleCodeView = useCallback(
    () => setEditorView((previous) => (previous === 'code' ? 'canvas' : 'code')),
    [],
  )

  const handleCreateWorkflowTab = useCallback(() => {
    createWorkflowTab()
  }, [createWorkflowTab])

  const handleAddPage = useCallback(() => {
    addPage()
    setSelection(null)
  }, [addPage])

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
      right.expand()

      if (action === 'config' || action === 'model') {
        setAttachTarget(null)
        toast.success('Opened the agent configuration panel')
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
    [right.expand],
  )

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

      const anchor = getCanvasInsertAnchor()
      const offset = (diagram.nodes.length % 5) * 20
      const base: DiagramNode = {
        id: createNodeId(),
        paletteId,
        label: item.label,
        x: anchor.x - AGENT_NODE_WIDTH / 2 + offset,
        y: anchor.y - AGENT_NODE_HEIGHT / 2 + offset,
        width: AGENT_NODE_WIDTH,
        height: AGENT_NODE_HEIGHT,
      }
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
    handleChange((previous) => {
      const agentNodes = previous.nodes.filter((node) => isAgentNode(node))
      const otherNodes = previous.nodes.filter((node) => !isAgentNode(node))
      const laidOutAgents =
        previous.edges.length > 0
          ? layoutWorkflowAgents(
              agentNodes,
              previous.edges.map((edge) => ({ from: edge.from, to: edge.to })),
            )
          : autoLayoutNodes(agentNodes)
      return syncMappedToolLayout({
        ...previous,
        nodes: [...laidOutAgents, ...otherNodes],
      })
    })
    requestAnimationFrame(() => canvasRef.current?.fitView())
    toast.success('Auto-layout applied')
  }, [handleChange])

  const handleWorkflowGenerated = useCallback(
    (plan: WorkflowGenerationPlan) => {
      const generated = diagramFromGenerationPlanSafe(plan, paletteById)
      const enrichedDiagram = enrichDiagram(generated.diagram, paletteById)
      invalidateValidation()
      setDoc((previous) => ({
        ...previous,
        workflow: {
          ...(previous.workflow ?? defaultWorkflowMeta()),
          ...generated.workflowMeta,
        },
        pages: previous.pages.map((page) =>
          page.id === previous.activePageId
            ? { ...page, name: generated.workflowName, diagram: enrichedDiagram }
            : page,
        ),
      }))
      setSelection(null)
      setEditorView('canvas')
      requestAnimationFrame(() => canvasRef.current?.fitView())
    },
    [invalidateValidation, paletteById, setDoc],
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

  const handleValidate = useCallback(() => {
    const issues = validateWorkflow(diagram, paletteById)
    setValidationIssues(issues)
    const hasErrors = issues.some((issue) => issue.severity === 'error')
    setIsValidated(!hasErrors && diagram.nodes.length > 0)
    setDoc((previous) => ({
      ...previous,
      workflow: {
        ...(previous.workflow ?? defaultWorkflowMeta()),
        executionType: inferredType,
        status: hasErrors ? 'draft' : 'validated',
      },
    }))
    if (hasErrors) {
      toast.error(`Validation found ${issues.filter((issue) => issue.severity === 'error').length} error(s)`)
    } else {
      toast.success('Workflow validated successfully')
    }
  }, [diagram, paletteById, inferredType, setDoc])

  const openExecutionPanel = useCallback(() => {
    keepRightOpenRef.current = true
    setSelection(null)
    setExecutionPanelOpen(true)
    right.expand()
  }, [right])

  const handleBackToDesign = useCallback(() => {
    keepRightOpenRef.current = false
    resetExecution()
    setExecutionPanelOpen(false)
    setSelection(null)
  }, [resetExecution])

  const handleViewInstance = useCallback(() => {
    navigate(ROUTES.agentWorkflowDashboardInstances)
  }, [navigate])

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
    const deployment: WorkflowDeployment = {
      workflowId: workflowMeta.workflowId,
      endpointUrl: `https://api.elevennodes.app/v1/workflows/${workflowMeta.workflowId}/run`,
      triggerMethod: 'POST',
      authType: 'api-key',
      requestSchema: testInput.trim() || '{\n  "input": "string"\n}',
      responseSchema: '{\n  "runId": "string",\n  "status": "completed",\n  "output": {}\n}',
      status: 'deployed',
      version: (workflowMeta.version ?? 1) + 1,
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
    upsertPublishedInstance({
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
    setLogs((previous) => [
      ...previous,
      `[${deployment.deployedAt}] Deployed v${deployment.version} → ${deployment.endpointUrl}`,
    ])
    toast.success('Workflow deployed', {
      description: 'Your published instance is ready on the dashboard.',
      action: {
        label: 'View instance',
        onClick: () => navigate(ROUTES.agentWorkflowDashboardInstances),
      },
    })
  }, [isValidated, workflowMeta, testInput, setDoc, workflowName, navigate])

  const handleExecute = useCallback(() => {
    if (isPersistingExecution || runState.status === 'running' || runState.status === 'waiting-approval') {
      return
    }

    keepRightOpenRef.current = true
    right.expand()
    setExecutionPanelOpen(true)
    setInspectorTab('trace')

    if (!isValidWorkflowInput(testInput)) {
      toast.error('Add valid JSON workflow input in the Execution panel before executing.')
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
    resetExecution()
    setEditorView('canvas')

    const executionPlan = getExecutablePlan(diagramSnapshot)
    if (executionPlan.length === 0) {
      toast.error('No executable agents in this workflow.')
      return
    }

    setIsPersistingExecution(true)
    void persistWorkflowBuildSpec({
      doc: docToSave,
      pageId: page.id,
      diagram: diagramSnapshot,
      paletteById,
      serverModelConfig,
      syncToDisk: true,
      requireApi: true,
    })
      .then((saved) =>
        startExecution(executionPlan, testInput, {
          workspaceId: saved.workspaceId,
          pageId: saved.pageId,
        }),
      )
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Failed to save workflow before execution.'
        toast.error(message)
      })
      .finally(() => {
        setIsPersistingExecution(false)
      })
  }, [
    doc,
    diagram,
    testInput,
    paletteById,
    serverModelConfig,
    bottom,
    right,
    isPersistingExecution,
    runState.status,
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
  const isExecuting =
    isPersistingExecution || runState.status === 'running' || runState.status === 'waiting-approval'
  const displayTrace = runState.trace
  const workflowDescription = useMemo(() => {
    const plan = getExecutablePlan(diagram)
    const approvalEdges = diagram.edges.filter((edge) => edge.connector?.humanApproval).length
    return `${plan.length}-step workflow${approvalEdges ? ` with ${approvalEdges} human approval gate(s)` : ''}.`
  }, [diagram])

  if (!tool) return <Navigate to="/404" replace />

  return (
    <DevProfiler id="AgentWorkflowPage">
    <div className="workspace-surface flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AgentWorkflowHeader
        workflowName={workflowName}
        onWorkflowNameChange={handleWorkflowNameChange}
        version={workflowMeta.version}
        status={workflowMeta.status}
        validationErrorCount={errorCount}
        isDirty={isDirty}
        onSave={handleSave}
        onValidate={handleValidate}
        onDeploy={handleDeploy}
        onGenerate={() => setGenerateWorkflowOpen(true)}
        isValidated={isValidated}
        onNavigateHome={handleNavigateHome}
        onViewInstance={handleViewInstance}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DesignerMenubar
            selection={selection}
            isEmpty={diagram.nodes.length === 0}
            snapToGrid={snapToGrid}
            showGrid={showGrid}
            onNew={() => {
              handleChange(() => ({ nodes: [], edges: [] }))
              setSelection(null)
            }}
            onNewPage={handleAddPage}
            onNewWorkspace={handleCreateNewWorkspace}
            onImport={() => subWorkflow.openInsert('import')}
            onExportJson={() => toast.info('Export coming soon')}
            onExportSvg={() => toast.info('Export coming soon')}
            onExportPng={() => toast.info('Export coming soon')}
            onExportPdf={() => toast.info('Export coming soon')}
            onViewCode={openCodeView}
            viewCodeWhenEmpty
            codeViewActive={editorView === 'code'}
            onToggleCodeView={toggleCodeView}
            onDuplicate={() => {}}
            onDeleteSelection={() => {
              if (!selection) return
              handleChange((previous) => {
                if (selection.kind === 'edge') {
                  return { ...previous, edges: previous.edges.filter((edge) => edge.id !== selection.id) }
                }
                const nodeIds = selectedNodeIds(selection)
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
            }}
            onConvertToSubWorkflow={subWorkflow.requestConvert}
            canConvertToSubWorkflow={subWorkflow.canConvert}
            onInsertWorkflow={() => subWorkflow.openInsert('workflow')}
            onInsertImport={() => subWorkflow.openInsert('import')}
            onInsertTemplates={() => setTemplatesOpen(true)}
            onCreateWorkflowTab={handleCreateWorkflowTab}
            onZoomIn={() => zoomBy(1.2)}
            onZoomOut={() => zoomBy(1 / 1.2)}
            onResetView={() => canvasRef.current?.fitView()}
            onFitToContent={() => canvasRef.current?.fitView()}
            onSnapToGridChange={setSnapToGrid}
            onShowGridChange={setShowGrid}
            onShare={() => setShareOpen(true)}
            toolId={TOOL_ID}
            onManageAccess={() => setShareOpen(true)}
            onOpenWorkflowSettings={openWorkflowSettings}
            showSettingsMenu={false}
            serverModelConfig={serverModelConfig}
            llmConfigured={llmConfigured}
            llmConfigLoading={llmConfigLoading}
          />

          <div className="flex min-h-0 flex-1">
            <AgentLibrarySidebar
              onAddAgent={addBlock}
              doc={doc}
              activePageId={doc.activePageId}
              onMountWorkflow={subWorkflow.mountWorkflow}
              onCreateWorkflowTab={handleCreateWorkflowTab}
              onOpenSettings={openWorkflowSettings}
              serverModelConfig={serverModelConfig}
              llmConfigured={llmConfigured}
              width={left.size}
              collapsed={left.collapsed}
              onResizePointerDown={left.onResizePointerDown}
              onToggleCollapse={left.toggle}
            />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {isExecutionMode ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <ExecutionFlowCanvas
                    diagram={diagram}
                    paletteById={paletteById}
                    runState={runState}
                    workflowName={workflowName}
                    workflowDescription={workflowDescription}
                    onBackToDesign={handleBackToDesign}
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
                      transformDroppedNode={transformDroppedNode}
                      finalizeDroppedNode={finalizeDroppedNode}
                      onOpenExecution={openExecutionPanel}
                      executionPanelOpen={executionPanelOpen}
                      onBackToDesign={handleBackToDesign}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                      onNodeAttachAction={handleAgentAttachAction}
                      onInsertHitlOnEdge={handleInsertHitlOnEdge}
                      hideEmptyState={!showCanvasEmptyState}
                      emptyState={
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                Start from a workflow template
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Sequential, Parallel, Handoff, Group chat, Magnetic, or Human-in-the-loop —
                                then customize on the canvas. Or{' '}
                                <button
                                  type="button"
                                  className="font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-300"
                                  onClick={() => setGenerateWorkflowOpen(true)}
                                >
                                  generate with AI
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
                onSelect={handleSelectPage}
                onAdd={handleAddPage}
                onRename={renamePage}
                onDelete={handleDeletePage}
              />

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
            </div>
          </div>
        </div>

        <AgentPropertiesShell
          diagram={diagram}
          doc={doc}
          selection={selection}
          onChange={handleChange}
          width={right.size}
          collapsed={right.collapsed}
          onResizePointerDown={right.onResizePointerDown}
          onToggleCollapse={right.toggle}
          onOpenSubWorkflow={handleSelectPage}
          onConvertToSubWorkflow={subWorkflow.requestConvert}
          canConvertToSubWorkflow={subWorkflow.canConvert}
          onWorkflowMetaChange={handleWorkflowMetaChange}
          serverModelConfig={serverModelConfig}
          llmConfigured={llmConfigured}
          executionPanelOpen={executionPanelOpen}
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
            canExecute: agentNodes.length > 0 && !isExecutionMode,
            runStatus: runState.status,
            runId: runState.runId,
            onCancel: cancelExecution,
            approvalPrompt: runState.approvalPrompt,
            onSubmitApproval: submitApproval,
            stepOutputs: runState.stepOutputs,
            trace: displayTrace,
            needsReview: Boolean(runState.approvalPrompt),
          }}
        />
      </div>

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

      <GenerateWorkflowDialog
        open={generateWorkflowOpen}
        onOpenChange={setGenerateWorkflowOpen}
        workflowName={workflowName}
        llmConfigured={llmConfigured}
        onGenerated={(plan) => handleWorkflowGenerated(plan)}
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
