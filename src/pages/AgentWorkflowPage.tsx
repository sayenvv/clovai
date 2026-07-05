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
import {
  createNodeId,
  type Diagram,
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
  TOOL_NODE_HEIGHT,
  TOOL_NODE_WIDTH,
  TOOL_PALETTE_ID,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { SelectAgentDialog } from '@/components/agent-workflow/SelectAgentDialog'
import {
  ConvertSubWorkflowDialog,
  InsertWorkflowDialog,
} from '@/components/agent-workflow/InsertWorkflowDialog'
import {
  attachToolToAgent,
  isAgentNode,
  listAgentNodes,
  pickAgentForToolPlacement,
  removeToolsMappedToAgent,
} from '@/components/agent-workflow/tool-agent-mapping'
import { autoLayoutNodes, inferWorkflowType, validateWorkflow } from '@/components/agent-workflow/validate-workflow'
import {
  AGENT_WORKFLOW_TOOL_ID,
  mergeDiagramIntoDocument,
  saveExecutionSnapshot,
  saveWorkflowDocument,
} from '@/components/agent-workflow/workflow-storage'
import { useWorkflowEditorPanels } from '@/components/agent-workflow/hooks/use-workflow-editor-panels'
import { useWorkflowDocument } from '@/components/agent-workflow/hooks/use-workflow-document'
import {
  canvasInsertAnchor,
  useSubWorkflowActions,
} from '@/components/agent-workflow/hooks/use-sub-workflow-actions'

const TOOL_ID = AGENT_WORKFLOW_TOOL_ID
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

function defaultWorkflowMeta(): AgentWorkflowMeta {
  return {
    workflowId: createWorkflowId(),
    version: 1,
    status: 'draft',
    executionType: 'sequential',
  }
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
  const [agentPickOpen, setAgentPickOpen] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'details' | 'collaborators'>('details')

  const { left, right, bottom } = useWorkflowEditorPanels()

  const invalidateValidation = useCallback(() => setIsValidated(false), [])

  const {
    doc,
    setDoc,
    activePage,
    diagram,
    workflowName,
    handleChange,
    selectPage,
    addPage,
    createWorkflowTab,
    renamePage,
    deletePage,
  } = useWorkflowDocument(paletteById, invalidateValidation)

  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const diagramRef = useRef<Diagram>({ nodes: [], edges: [] })
  diagramRef.current = diagram

  const getCanvasInsertAnchor = useCallback(
    () => canvasInsertAnchor(diagram, canvasAreaRef, viewport),
    [diagram, viewport],
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
    if (tool) document.title = `${tool.title} — Clovai`
  }, [tool])

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

  const handleViewportChange = useCallback((updater: (previous: Viewport) => Viewport) => {
    setViewport(updater)
  }, [])

  const handleSelectPage = useCallback(
    (pageId: string) => {
      selectPage(pageId)
      setSelection(null)
    },
    [selectPage],
  )

  const handleAddPage = useCallback(() => {
    addPage()
    setSelection(null)
  }, [addPage])

  const handleDeletePage = useCallback(
    (pageId: string) => {
      deletePage(pageId)
      setSelection(null)
    },
    [deletePage],
  )

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
  }, [setDoc])

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
  }, [isValidated, workflowMeta, testInput, setDoc])

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
            onImport={() => subWorkflow.openInsert('import')}
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
            onConvertToSubWorkflow={subWorkflow.requestConvert}
            canConvertToSubWorkflow={subWorkflow.canConvert}
            onInsertWorkflow={() => subWorkflow.openInsert('workflow')}
            onInsertImport={() => subWorkflow.openInsert('import')}
            onCreateWorkflowTab={createWorkflowTab}
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
              onMountWorkflow={subWorkflow.mountWorkflow}
              onCreateWorkflowTab={createWorkflowTab}
              width={left.size}
              collapsed={left.collapsed}
              onResizePointerDown={left.onResizePointerDown}
              onToggleCollapse={left.toggle}
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
                onSelect={handleSelectPage}
                onAdd={handleAddPage}
                onRename={renamePage}
                onDelete={handleDeletePage}
              />

              <BottomInspectorPanel
                validationIssues={validationIssues}
                trace={trace}
                logs={logs}
                testInput={testInput}
                onTestInputChange={setTestInput}
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
          toolId={TOOL_ID}
          activeTab={rightPanelTab}
          onTabChange={setRightPanelTab}
          onManageAccess={() => setShareOpen(true)}
          onOpenSubWorkflow={handleSelectPage}
          onConvertToSubWorkflow={subWorkflow.requestConvert}
          canConvertToSubWorkflow={subWorkflow.canConvert}
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
        onCreateWorkflowTab={createWorkflowTab}
      />
    </div>
  )
}
