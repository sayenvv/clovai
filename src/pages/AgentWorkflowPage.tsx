import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LayoutGrid, Maximize2 } from 'lucide-react'
import { useAppConfig } from '@/hooks/use-app-config'
import { Button } from '@/components/ui/button'
import { DesignerCanvas } from '@/components/designer/DesignerCanvas'
import { selectedNodeIds, type Selection } from '@/components/designer/selection-utils'
import { DesignerMenubar } from '@/components/designer/DesignerMenubar'
import { ShareDialog } from '@/components/designer/ShareDialog'
import { PagesBar } from '@/components/designer/PagesBar'
import { computeCenteredViewport, zoomViewportAt } from '@/components/designer/viewport-utils'
import { resolveDesignerPalette } from '@/utils/resolve-designer-palette'
import { STORAGE_KEYS } from '@/constants'
import {
  createNodeId,
  createPage,
  type Diagram,
  type DiagramDocument,
  type DiagramNode,
  type Viewport,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type {
  AgentWorkflowMeta,
  ExecutionTraceStep,
  WorkflowDeployment,
  WorkflowValidationIssue,
} from '@/types/agent-workflow'
import { AgentWorkflowHeader } from '@/components/agent-workflow/AgentWorkflowHeader'
import { AgentLibrarySidebar } from '@/components/agent-workflow/AgentLibrarySidebar'
import { AgentPropertiesShell } from '@/components/agent-workflow/AgentPropertiesShell'
import { BottomInspectorPanel } from '@/components/agent-workflow/BottomInspectorPanel'
import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
  createWorkflowId,
  enrichAgentNode,
  enrichDiagram,
  TOOL_NODE_HEIGHT,
  TOOL_NODE_WIDTH,
  TOOL_PALETTE_ID,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { SelectAgentDialog } from '@/components/agent-workflow/SelectAgentDialog'
import {
  ConvertSubWorkflowDialog,
  InsertWorkflowDialog,
  type InsertDialogTab,
  type InsertWorkflowMode,
} from '@/components/agent-workflow/InsertWorkflowDialog'
import {
  convertAgentsToSubWorkflow,
  diagramContentCenter,
  insertDiagramAt,
  isSubWorkflowNode,
  mergeImportedDocument,
  mountPageAsSubWorkflow,
  offsetToPlaceDiagram,
} from '@/components/agent-workflow/sub-workflow-ops'
import {
  attachToolToAgent,
  isAgentNode,
  listAgentNodes,
  pickAgentForToolPlacement,
  removeToolsMappedToAgent,
  shouldSyncToolLayout,
  syncMappedToolLayout,
} from '@/components/agent-workflow/tool-agent-mapping'
import { autoLayoutNodes, inferWorkflowType, validateWorkflow } from '@/components/agent-workflow/validate-workflow'
import {
  AGENT_WORKFLOW_TOOL_ID,
  loadWorkflowDocument,
  mergeDiagramIntoDocument,
  saveExecutionSnapshot,
  saveWorkflowDocument,
} from '@/components/agent-workflow/workflow-storage'
import { useVerticalResize } from '@/hooks/use-vertical-resize'
import { useHorizontalResize } from '@/hooks/use-horizontal-resize'

const TOOL_ID = AGENT_WORKFLOW_TOOL_ID
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }
const BOTTOM_PANEL_STORAGE_KEY = 'clovai-agent-workflow-panel-height'
const BOTTOM_PANEL_COLLAPSED_KEY = 'clovai-agent-workflow-panel-collapsed'
const BOTTOM_PANEL_DEFAULT = 180
const BOTTOM_PANEL_MIN = 100
const LEFT_PANEL_STORAGE_KEY = 'clovai-agent-workflow-left-panel-width'
const LEFT_PANEL_COLLAPSED_KEY = 'clovai-agent-workflow-left-panel-collapsed'
const LEFT_PANEL_DEFAULT = 260
const LEFT_PANEL_MIN = 220
const LEFT_PANEL_MAX = 420
const RIGHT_PANEL_STORAGE_KEY = 'clovai-agent-workflow-right-panel-width'
const RIGHT_PANEL_COLLAPSED_KEY = 'clovai-agent-workflow-right-panel-collapsed'
const RIGHT_PANEL_DEFAULT = 340
const RIGHT_PANEL_MIN = 280
const RIGHT_PANEL_MAX = 560

function loadPanelHeight(): number {
  try {
    const stored = localStorage.getItem(BOTTOM_PANEL_STORAGE_KEY)
    if (stored) {
      const parsed = Number.parseInt(stored, 10)
      if (!Number.isNaN(parsed) && parsed >= BOTTOM_PANEL_MIN) return parsed
    }
  } catch {
    // ignore
  }
  return BOTTOM_PANEL_DEFAULT
}

function loadRightPanelWidth(): number {
  try {
    const stored = localStorage.getItem(RIGHT_PANEL_STORAGE_KEY)
    if (stored) {
      const parsed = Number.parseInt(stored, 10)
      if (!Number.isNaN(parsed) && parsed >= RIGHT_PANEL_MIN) return parsed
    }
  } catch {
    // ignore
  }
  return RIGHT_PANEL_DEFAULT
}

function loadRightPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(RIGHT_PANEL_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function loadLeftPanelWidth(): number {
  try {
    const stored = localStorage.getItem(LEFT_PANEL_STORAGE_KEY)
    if (stored) {
      const parsed = Number.parseInt(stored, 10)
      if (!Number.isNaN(parsed) && parsed >= LEFT_PANEL_MIN) return parsed
    }
  } catch {
    // ignore
  }
  return LEFT_PANEL_DEFAULT
}

function loadLeftPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(LEFT_PANEL_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function loadBottomPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(BOTTOM_PANEL_COLLAPSED_KEY) === 'true'
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

function loadDocument(): DiagramDocument {
  return loadWorkflowDocument()
}

function simulateTrace(diagram: Diagram): ExecutionTraceStep[] {
  const now = Date.now()
  return diagram.nodes.slice(0, 6).map((node, index) => {
    const edge = diagram.edges.find((candidate) => candidate.from === node.id)
    const waiting = edge?.connector?.humanApproval
    return {
      id: `trace-${node.id}`,
      agentName: node.label,
      status:
        index === diagram.nodes.length - 1 && waiting
          ? 'waiting-approval'
          : index === 0
            ? 'completed'
            : 'running',
      message: waiting
        ? `Waiting for ${edge?.connector?.approvalRole ?? 'reviewer'} approval`
        : `Processed step ${index + 1} successfully`,
      timestamp: new Date(now + index * 1200).toISOString(),
    }
  })
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

  const [doc, setDoc] = useState<DiagramDocument>(() => loadDocument())
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
  const [selection, setSelection] = useState<Selection>(null)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [validationIssues, setValidationIssues] = useState<WorkflowValidationIssue[]>([])
  const [isValidated, setIsValidated] = useState(false)
  const [trace, setTrace] = useState<ExecutionTraceStep[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [testInput, setTestInput] = useState('{\n  "query": "Summarize the quarterly report"\n}')
  const [workflowName, setWorkflowName] = useState(() => doc.pages[0]?.name ?? 'Untitled workflow')
  const [agentPickOpen, setAgentPickOpen] = useState(false)
  const [convertSubWorkflowOpen, setConvertSubWorkflowOpen] = useState(false)
  const [insertWorkflowOpen, setInsertWorkflowOpen] = useState(false)
  const [insertDialogTab, setInsertDialogTab] = useState<InsertDialogTab>('workflow')
  const [rightPanelTab, setRightPanelTab] = useState<'details' | 'collaborators'>('details')

  const { height: bottomPanelHeight, setHeight: setBottomPanelHeight, onResizePointerDown } =
    useVerticalResize({
      initialHeight: loadPanelHeight(),
      minHeight: BOTTOM_PANEL_MIN,
    })

  const {
    width: leftPanelWidth,
    setWidth: setLeftPanelWidth,
    onResizePointerDown: onLeftPanelResize,
  } = useHorizontalResize({
    initialWidth: loadLeftPanelWidth(),
    minWidth: LEFT_PANEL_MIN,
    maxWidth: LEFT_PANEL_MAX,
    invert: false,
  })

  const {
    width: rightPanelWidth,
    setWidth: setRightPanelWidth,
    onResizePointerDown: onRightPanelResize,
  } = useHorizontalResize({
    initialWidth: loadRightPanelWidth(),
    minWidth: RIGHT_PANEL_MIN,
    maxWidth: RIGHT_PANEL_MAX,
    invert: true,
  })

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(loadLeftPanelCollapsed)
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(loadBottomPanelCollapsed)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(loadRightPanelCollapsed)
  const leftPanelWidthRef = useRef(leftPanelWidth)
  const bottomPanelHeightRef = useRef(bottomPanelHeight)
  const rightPanelWidthRef = useRef(rightPanelWidth)
  leftPanelWidthRef.current = leftPanelWidth
  bottomPanelHeightRef.current = bottomPanelHeight
  rightPanelWidthRef.current = rightPanelWidth

  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const diagramRef = useRef<Diagram>({ nodes: [], edges: [] })

  const activePage = doc.pages.find((page) => page.id === doc.activePageId) ?? doc.pages[0]
  const diagram = useMemo(
    () => enrichDiagram(activePage.diagram, paletteById),
    [activePage.diagram, paletteById],
  )
  diagramRef.current = diagram

  const workflowMeta = doc.workflow ?? defaultWorkflowMeta()
  const inferredType = useMemo(() => inferWorkflowType(diagram), [diagram])

  useEffect(() => {
    if (tool) document.title = `${tool.title} — Clovai`
  }, [tool])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.diagram(TOOL_ID), JSON.stringify(doc))
  }, [doc])

  useEffect(() => {
    if (!bottomPanelCollapsed) {
      localStorage.setItem(BOTTOM_PANEL_STORAGE_KEY, String(bottomPanelHeight))
    }
  }, [bottomPanelHeight, bottomPanelCollapsed])

  useEffect(() => {
    localStorage.setItem(BOTTOM_PANEL_COLLAPSED_KEY, String(bottomPanelCollapsed))
  }, [bottomPanelCollapsed])

  useEffect(() => {
    if (!leftPanelCollapsed) {
      localStorage.setItem(LEFT_PANEL_STORAGE_KEY, String(leftPanelWidth))
    }
  }, [leftPanelWidth, leftPanelCollapsed])

  useEffect(() => {
    localStorage.setItem(LEFT_PANEL_COLLAPSED_KEY, String(leftPanelCollapsed))
  }, [leftPanelCollapsed])

  useEffect(() => {
    if (!rightPanelCollapsed) {
      localStorage.setItem(RIGHT_PANEL_STORAGE_KEY, String(rightPanelWidth))
    }
  }, [rightPanelWidth, rightPanelCollapsed])

  useEffect(() => {
    localStorage.setItem(RIGHT_PANEL_COLLAPSED_KEY, String(rightPanelCollapsed))
  }, [rightPanelCollapsed])

  const toggleLeftPanel = useCallback(() => {
    setLeftPanelCollapsed((previous) => {
      if (previous) {
        setLeftPanelWidth(leftPanelWidthRef.current)
      } else {
        leftPanelWidthRef.current = leftPanelWidth
      }
      return !previous
    })
  }, [leftPanelWidth, setLeftPanelWidth])

  const toggleBottomPanel = useCallback(() => {
    setBottomPanelCollapsed((previous) => {
      if (previous) {
        setBottomPanelHeight(bottomPanelHeightRef.current)
      } else {
        bottomPanelHeightRef.current = bottomPanelHeight
      }
      return !previous
    })
  }, [bottomPanelHeight, setBottomPanelHeight])

  const toggleRightPanel = useCallback(() => {
    setRightPanelCollapsed((previous) => {
      if (previous) {
        setRightPanelWidth(rightPanelWidthRef.current)
      } else {
        rightPanelWidthRef.current = rightPanelWidth
      }
      return !previous
    })
  }, [rightPanelWidth, setRightPanelWidth])

  useEffect(() => {
    setWorkflowName(activePage.name)
  }, [activePage.id, activePage.name])

  useEffect(() => {
    if (selection?.kind === 'node' || selection?.kind === 'edge') {
      setRightPanelTab('details')
    }
  }, [selection])

  const handleSelectionChange = useCallback((next: Selection) => {
    setSelection(next)
  }, [])

  const applyCenteredViewport = useCallback(
    (targetDiagram: Diagram) => {
      const rect = canvasAreaRef.current?.getBoundingClientRect()
      if (!rect?.width || !rect?.height) return
      setViewport(computeCenteredViewport(targetDiagram, paletteById, rect.width, rect.height))
    },
    [paletteById],
  )

  useLayoutEffect(() => {
    applyCenteredViewport(diagramRef.current)
    const frame = requestAnimationFrame(() => applyCenteredViewport(diagramRef.current))
    return () => cancelAnimationFrame(frame)
  }, [TOOL_ID, activePage.id, applyCenteredViewport])

  const handleChange = useCallback(
    (updater: (previous: Diagram) => Diagram) => {
      setIsValidated(false)
      setDoc((previous) => ({
        ...previous,
        pages: previous.pages.map((page) => {
          if (page.id !== previous.activePageId) return page
          const before = page.diagram
          const enriched = enrichDiagram(updater(before), paletteById)
          const diagram = shouldSyncToolLayout(before, enriched)
            ? syncMappedToolLayout(enriched)
            : enriched
          return { ...page, diagram }
        }),
      }))
    },
    [paletteById],
  )

  const handleViewportChange = useCallback((updater: (previous: Viewport) => Viewport) => {
    setViewport(updater)
  }, [])

  const selectPage = useCallback((pageId: string) => {
    setDoc((previous) => ({ ...previous, activePageId: pageId }))
    setSelection(null)
  }, [])

  const addPage = useCallback(() => {
    setDoc((previous) => {
      const page = createPage(`Workflow ${previous.pages.length + 1}`)
      return { pages: [...previous.pages, page], activePageId: page.id, workflow: previous.workflow }
    })
    setSelection(null)
  }, [])

  const handleCreateWorkflowTab = useCallback(() => {
    addPage()
    toast.success('New workflow tab created. Build it here, then attach it with Insert → Workflow.')
  }, [addPage])

  const openInsertDialog = useCallback((tab: InsertDialogTab) => {
    setInsertDialogTab(tab)
    setInsertWorkflowOpen(true)
  }, [])

  const renamePage = useCallback((pageId: string, name: string) => {
    setDoc((previous) => ({
      ...previous,
      pages: previous.pages.map((page) => (page.id === pageId ? { ...page, name } : page)),
    }))
    if (pageId === doc.activePageId) setWorkflowName(name)
  }, [doc.activePageId])

  const deletePage = useCallback((pageId: string) => {
    setDoc((previous) => {
      if (previous.pages.length <= 1) return previous
      const pages = previous.pages.filter((page) => page.id !== pageId)
      return {
        ...previous,
        pages,
        activePageId:
          previous.activePageId === pageId ? pages[pages.length - 1].id : previous.activePageId,
      }
    })
    setSelection(null)
  }, [])

  const addToolForAgent = useCallback(
    (agentId: string, paletteId: string = TOOL_PALETTE_ID) => {
      const item = paletteById.get(paletteId)
      if (!item) return
      const nodeId = createNodeId()
      handleChange((previous) => {
        const base: DiagramNode = {
          id: nodeId,
          paletteId,
          label: item.label,
          x: 0,
          y: 0,
        }
        const node = attachToolToAgent(previous, enrichAgentNode(base, item), agentId)
        return { ...previous, nodes: [...previous.nodes, node] }
      })
      setSelection({ kind: 'node', id: nodeId })
    },
    [paletteById, handleChange],
  )

  const addBlock = useCallback(
    (paletteId: string) => {
      const item = paletteById.get(paletteId)
      if (!item) return

      if (paletteId === TOOL_PALETTE_ID) {
        const agents = listAgentNodes(diagram)
        if (agents.length === 0) {
          toast.error('Add an agent before adding tools')
          return
        }
        if (agents.length === 1) {
          addToolForAgent(agents[0].id, paletteId)
          return
        }
        setAgentPickOpen(true)
        return
      }

      const rect = canvasAreaRef.current?.getBoundingClientRect()
      const visibleWidth = rect?.width ?? window.innerWidth
      const visibleHeight = rect?.height ?? window.innerHeight
      const centerX = (visibleWidth / 2 - viewport.x) / viewport.scale
      const centerY = (visibleHeight / 2 - viewport.y) / viewport.scale
      const offset = (diagram.nodes.length % 5) * 20

      const base: DiagramNode = {
        id: createNodeId(),
        paletteId,
        label: item.label,
        x: centerX - AGENT_NODE_WIDTH / 2 + offset,
        y: centerY - AGENT_NODE_HEIGHT / 2 + offset,
        width: AGENT_NODE_WIDTH,
        height: AGENT_NODE_HEIGHT,
      }
      const node = enrichAgentNode(base, item)
      handleChange((previous) => ({ ...previous, nodes: [...previous.nodes, node] }))
      setSelection({ kind: 'node', id: node.id })
    },
    [paletteById, viewport, diagram, handleChange, addToolForAgent],
  )

  const zoomBy = useCallback((factor: number) => {
    setViewport((previous) => {
      const rect = canvasAreaRef.current?.getBoundingClientRect()
      return zoomViewportAt(
        previous,
        factor,
        rect ? rect.width / 2 : 0,
        rect ? rect.height / 2 : 0,
      )
    })
  }, [])

  const runAutoLayout = useCallback(() => {
    handleChange((previous) => ({ ...previous, nodes: autoLayoutNodes(previous.nodes) }))
    requestAnimationFrame(() => applyCenteredViewport(diagramRef.current))
    toast.success('Auto-layout applied')
  }, [handleChange, applyCenteredViewport])

  const handleSave = useCallback(() => {
    setDoc((previous) => ({
      ...previous,
      workflow: {
        ...(previous.workflow ?? defaultWorkflowMeta()),
        version: (previous.workflow?.version ?? 1) + 1,
        status: 'draft',
      },
    }))
    toast.success('Draft saved')
  }, [])

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
  }, [diagram, paletteById, inferredType])

  const handleTest = useCallback(() => {
    const stamp = new Date().toISOString()
    setTrace(simulateTrace(diagram))
    setLogs([
      `[${stamp}] Starting workflow ${workflowMeta.workflowId}`,
      `[${stamp}] Input: ${testInput.replace(/\s+/g, ' ').slice(0, 80)}…`,
      ...diagram.nodes.map(
        (node, index) =>
          `[${new Date(Date.now() + index * 500).toISOString()}] Agent "${node.label}" executed`,
      ),
    ])
    toast.success('Test run completed — see execution trace')
  }, [diagram, testInput, workflowMeta.workflowId])

  const handleDeploy = useCallback(() => {
    if (!isValidated) {
      toast.error('Validate the workflow before deploying')
      return
    }
    const deployment: WorkflowDeployment = {
      workflowId: workflowMeta.workflowId,
      endpointUrl: `https://api.clovai.app/v1/workflows/${workflowMeta.workflowId}/run`,
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
    setLogs((previous) => [
      ...previous,
      `[${deployment.deployedAt}] Deployed v${deployment.version} → ${deployment.endpointUrl}`,
    ])
    toast.success('Workflow deployed')
  }, [isValidated, workflowMeta, testInput])

  const handleExecute = useCallback(() => {
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
    saveExecutionSnapshot({
      pageId: page.id,
      pageName: page.name,
      diagram: diagramSnapshot,
      input: testInput,
    })

    navigate('/tools/agent-workflow/execute', {
      state: {
        pageId: page.id,
        pageName: page.name,
        diagram: diagramSnapshot,
        input: testInput,
        autoStart: true,
      },
    })
  }, [doc, diagram, navigate, testInput])

  const handleWorkflowNameChange = useCallback(
    (name: string) => {
      setWorkflowName(name)
      renamePage(activePage.id, name)
    },
    [activePage.id, renamePage],
  )

  const transformDroppedNode = useCallback((node: DiagramNode, item: PaletteItem) => {
    const isTool = node.paletteId === TOOL_PALETTE_ID
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
      if (node.paletteId !== TOOL_PALETTE_ID) return node
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

  const getCanvasInsertAnchor = useCallback((): { x: number; y: number } => {
    const rect = canvasAreaRef.current?.getBoundingClientRect()
    if (!rect?.width || !rect?.height) return diagramContentCenter(diagram)
    return {
      x: (rect.width / 2 - viewport.x) / viewport.scale,
      y: (rect.height / 2 - viewport.y) / viewport.scale,
    }
  }, [diagram, viewport])

  const selectedAgentIds = useMemo(
    () =>
      selectedNodeIds(selection).filter((id) => {
        const node = diagram.nodes.find((candidate) => candidate.id === id)
        return node && isAgentNode(node) && !isSubWorkflowNode(node)
      }),
    [selection, diagram.nodes],
  )

  const canConvertToSubWorkflow = selectedAgentIds.length >= 2

  const convertSubWorkflowDefaultName = useMemo(() => {
    if (selectedAgentIds.length === 0) return `Sub-workflow ${doc.pages.length + 1}`
    const labels = selectedAgentIds
      .map((id) => diagram.nodes.find((node) => node.id === id)?.label)
      .filter(Boolean)
      .slice(0, 2)
    return labels.length > 0 ? labels.join(' + ') : `Sub-workflow ${doc.pages.length + 1}`
  }, [selectedAgentIds, diagram.nodes, doc.pages.length])

  const handleConvertToSubWorkflow = useCallback(() => {
    if (!canConvertToSubWorkflow) {
      toast.error('Select at least two agents to convert.')
      return
    }
    setConvertSubWorkflowOpen(true)
  }, [canConvertToSubWorkflow])

  const confirmConvertToSubWorkflow = useCallback(
    (name: string) => {
      const result = convertAgentsToSubWorkflow(doc, doc.activePageId, selectedAgentIds, name)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setIsValidated(false)
      setDoc(result.doc)
      setSelection({ kind: 'node', id: result.subWorkflowNodeId })
      toast.success('Converted selection into a sub-workflow agent.')
    },
    [doc, selectedAgentIds],
  )

  const handleInsertFromPage = useCallback(
    (pageId: string, mode: InsertWorkflowMode) => {
      const sourcePage = doc.pages.find((page) => page.id === pageId)
      if (!sourcePage) {
        toast.error('Workflow page not found.')
        return
      }

      const anchor = getCanvasInsertAnchor()

      if (mode === 'mount') {
        const result = mountPageAsSubWorkflow(doc, doc.activePageId, pageId, anchor)
        if ('error' in result) {
          toast.error(result.error)
          return
        }
        setIsValidated(false)
        setDoc(result.doc)
        setSelection({ kind: 'node', id: result.subWorkflowNodeId })
        toast.success(`Mounted "${sourcePage.name}" as a sub-workflow agent.`)
        return
      }

      const offset = offsetToPlaceDiagram(diagram, sourcePage.diagram, anchor)
      handleChange((previous) => insertDiagramAt(previous, sourcePage.diagram, offset))
      toast.success(`Inserted nodes from "${sourcePage.name}".`)
    },
    [doc, diagram, getCanvasInsertAnchor, handleChange],
  )

  const handleImportWorkflowDocument = useCallback(
    (imported: DiagramDocument, mode: InsertWorkflowMode) => {
      if (imported.pages.length === 0) {
        toast.error('No workflow pages found in the file.')
        return
      }

      const anchor = getCanvasInsertAnchor()

      if (mode === 'mount') {
        const merged = mergeImportedDocument(doc, imported)
        if (!merged.firstPageId) {
          toast.error('Could not import workflow.')
          return
        }
        const result = mountPageAsSubWorkflow(merged.doc, doc.activePageId, merged.firstPageId, anchor)
        if ('error' in result) {
          toast.error(result.error)
          return
        }
        setIsValidated(false)
        setDoc(result.doc)
        setSelection({ kind: 'node', id: result.subWorkflowNodeId })
        toast.success('Imported and mounted workflow as a sub-workflow agent.')
        return
      }

      const sourcePage =
        imported.pages.find((page) => page.id === imported.activePageId) ?? imported.pages[0]
      const offset = offsetToPlaceDiagram(diagram, sourcePage.diagram, anchor)
      handleChange((previous) => insertDiagramAt(previous, sourcePage.diagram, offset))
      toast.success(`Inserted nodes from "${sourcePage.name}".`)
    },
    [doc, diagram, getCanvasInsertAnchor, handleChange],
  )

  const handleMountWorkflow = useCallback(
    (pageId: string) => handleInsertFromPage(pageId, 'mount'),
    [handleInsertFromPage],
  )

  const agentNodes = useMemo(() => listAgentNodes(diagram), [diagram])

  const errorCount = validationIssues.filter((issue) => issue.severity === 'error').length

  if (!tool) return <Navigate to="/404" replace />

  return (
    <div className="workspace-surface flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AgentWorkflowHeader
        workflowName={workflowName}
        onWorkflowNameChange={handleWorkflowNameChange}
        version={workflowMeta.version}
        status={workflowMeta.status}
        validationErrorCount={errorCount}
        onSave={handleSave}
        onValidate={handleValidate}
        onTest={handleTest}
        onDeploy={handleDeploy}
        onExecute={handleExecute}
        isValidated={isValidated}
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
            onImport={() => openInsertDialog('import')}
            onExportJson={() => toast.info('Export coming soon')}
            onExportSvg={() => toast.info('Export coming soon')}
            onExportPng={() => toast.info('Export coming soon')}
            onExportPdf={() => toast.info('Export coming soon')}
            onViewCode={() => toast.info('Code export coming soon')}
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
            onConvertToSubWorkflow={handleConvertToSubWorkflow}
            canConvertToSubWorkflow={canConvertToSubWorkflow}
            onInsertWorkflow={() => openInsertDialog('workflow')}
            onInsertImport={() => openInsertDialog('import')}
            onCreateWorkflowTab={handleCreateWorkflowTab}
            onZoomIn={() => zoomBy(1.2)}
            onZoomOut={() => zoomBy(1 / 1.2)}
            onResetView={() => applyCenteredViewport(diagram)}
            onFitToContent={() => applyCenteredViewport(diagram)}
            onSnapToGridChange={setSnapToGrid}
            onShowGridChange={setShowGrid}
            onShare={() => setShareOpen(true)}
            toolId={TOOL_ID}
            showWorkspaceMembers={false}
            onManageAccess={() => setShareOpen(true)}
          />

          <div className="flex min-h-0 flex-1">
            <AgentLibrarySidebar
              onAddAgent={addBlock}
              doc={doc}
              activePageId={doc.activePageId}
              onMountWorkflow={handleMountWorkflow}
              onCreateWorkflowTab={handleCreateWorkflowTab}
              width={leftPanelWidth}
              collapsed={leftPanelCollapsed}
              onResizePointerDown={onLeftPanelResize}
              onToggleCollapse={toggleLeftPanel}
            />

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div ref={canvasAreaRef} className="relative min-h-0 flex-1 bg-canvas">
            {diagram.nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="max-w-sm rounded-xl border border-dashed border-violet-500/30 bg-card/80 px-6 py-5 text-center shadow-sm backdrop-blur-sm">
                  <p className="text-sm font-medium text-foreground">Build your agent workflow</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add an agent, then map tools under it. Connect agents to define execution order
                    and approval gates.
                  </p>
                </div>
              </div>
            )}


            <div className="absolute bottom-3 left-3 z-20 flex gap-1.5">
              <Button variant="secondary" size="sm" className="h-8 shadow-md" onClick={runAutoLayout}>
                <LayoutGrid className="h-3.5 w-3.5" />
                Auto-layout
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 shadow-md"
                onClick={() => applyCenteredViewport(diagram)}
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Fit
              </Button>
            </div>

            <DesignerCanvas
              diagram={diagram}
              onChange={handleChange}
              paletteById={paletteById}
              viewport={viewport}
              onViewportChange={handleViewportChange}
              selection={selection}
              onSelectionChange={handleSelectionChange}
              snapToGrid={snapToGrid}
              showGrid={showGrid}
              onZoomIn={() => zoomBy(1.2)}
              onZoomOut={() => zoomBy(1 / 1.2)}
              agentMode
              transformDroppedNode={transformDroppedNode}
              finalizeDroppedNode={finalizeDroppedNode}
            />
          </div>

          <PagesBar
            pages={doc.pages}
            activePageId={doc.activePageId}
            onSelect={selectPage}
            onAdd={addPage}
            onRename={renamePage}
            onDelete={deletePage}
          />

          <BottomInspectorPanel
            validationIssues={validationIssues}
            trace={trace}
            logs={logs}
            testInput={testInput}
            onTestInputChange={setTestInput}
            height={bottomPanelHeight}
            collapsed={bottomPanelCollapsed}
            onResizePointerDown={onResizePointerDown}
            onToggleCollapse={toggleBottomPanel}
          />
            </div>
          </div>
        </div>

        <AgentPropertiesShell
          diagram={diagram}
          doc={doc}
          selection={selection}
          onChange={handleChange}
          width={rightPanelWidth}
          collapsed={rightPanelCollapsed}
          onResizePointerDown={onRightPanelResize}
          onToggleCollapse={toggleRightPanel}
          toolId={TOOL_ID}
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onManageAccess={() => setShareOpen(true)}
          onOpenSubWorkflow={selectPage}
          onConvertToSubWorkflow={handleConvertToSubWorkflow}
          canConvertToSubWorkflow={canConvertToSubWorkflow}
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
        open={convertSubWorkflowOpen}
        onOpenChange={setConvertSubWorkflowOpen}
        agentCount={selectedAgentIds.length}
        defaultName={convertSubWorkflowDefaultName}
        onConfirm={confirmConvertToSubWorkflow}
      />

      <InsertWorkflowDialog
        open={insertWorkflowOpen}
        onOpenChange={setInsertWorkflowOpen}
        doc={doc}
        activePageId={doc.activePageId}
        defaultTab={insertDialogTab}
        onInsertFromPage={handleInsertFromPage}
        onImportDocument={handleImportWorkflowDocument}
        onCreateWorkflowTab={handleCreateWorkflowTab}
      />
    </div>
  )
}
