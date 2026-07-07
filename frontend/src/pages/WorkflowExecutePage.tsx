import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { APP_NAME } from '@/constants'
import { useAppConfig } from '@/hooks/use-app-config'
import { resolveDesignerPalette } from '@/utils/resolve-designer-palette'
import { enrichDiagram } from '@/components/agent-workflow/agent-workflow-defaults'
import { getExecutablePlan } from '@/components/agent-workflow/build-execution-plan'
import { ExecutionFlowCanvas } from '@/components/agent-workflow/ExecutionFlowCanvas'
import { ExecutionInspectorShell } from '@/components/agent-workflow/ExecutionInspectorShell'
import { ExecutionPageHeader } from '@/components/agent-workflow/ExecutionPageHeader'
import { ExecutionTimelineShell } from '@/components/agent-workflow/ExecutionTimelineShell'
import { persistWorkflowBuildSpec } from '@/components/agent-workflow/workflow-build-storage'
import { bootstrapExecuteState } from '@/components/agent-workflow/resolve-execution-context'
import { useWorkflowRunner } from '@/components/agent-workflow/use-workflow-runner'
import {
  AGENT_WORKFLOW_TOOL_ID,
  clearExecutionSnapshot,
  loadExecutionSnapshot,
  loadWorkflowDocument,
  mergeDiagramIntoDocument,
  saveWorkflowDocument,
} from '@/components/agent-workflow/workflow-storage'
import { useHorizontalResize } from '@/hooks/use-horizontal-resize'
import type { PaletteItem } from '@/types/config'

import type { Diagram } from '@/components/designer/diagram-types'

interface ExecuteLocationState {
  pageId?: string
  pageName?: string
  diagram?: Diagram
  input?: string
  autoStart?: boolean
}

const DEFAULT_INPUT = '{\n  "query": "Summarize the quarterly report"\n}'

const CENTER_PANEL_STORAGE_KEY = 'clovai-agent-workflow-exec-center-width'
const CENTER_PANEL_COLLAPSED_KEY = 'clovai-agent-workflow-exec-center-collapsed'
const CENTER_PANEL_DEFAULT = 320
const CENTER_PANEL_MIN = 280
const CENTER_PANEL_MAX = 440

const RIGHT_PANEL_STORAGE_KEY = 'clovai-agent-workflow-exec-right-width'
const RIGHT_PANEL_DEFAULT = 380
const RIGHT_PANEL_MIN = 300
const RIGHT_PANEL_MAX = 560

function loadWidth(key: string, fallback: number, min: number): number {
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = Number.parseInt(stored, 10)
      if (!Number.isNaN(parsed) && parsed >= min) return parsed
    }
  } catch {
    // ignore
  }
  return fallback
}

function loadCollapsed(key: string, defaultValue = false): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultValue
    return stored === 'true'
  } catch {
    return defaultValue
  }
}

export default function WorkflowExecutePage() {
  const { megaMenu } = useAppConfig()
  const location = useLocation()
  const navState = (location.state ?? {}) as ExecuteLocationState

  const tool = useMemo(
    () => megaMenu.tools.find((candidate) => candidate.route === `/tools/${AGENT_WORKFLOW_TOOL_ID}`),
    [megaMenu.tools],
  )
  const { palette } = useMemo(() => resolveDesignerPalette(tool, AGENT_WORKFLOW_TOOL_ID), [tool])
  const paletteById = useMemo(() => {
    const map = new Map<string, PaletteItem>()
    palette.forEach((item) => map.set(item.id, item))
    return map
  }, [palette])

  const handoff = useMemo(
    () => ({
      pageId: navState.pageId,
      pageName: navState.pageName,
      diagram: navState.diagram,
      input: navState.input,
    }),
    [navState.pageId, navState.pageName, navState.diagram, navState.input],
  )

  const [bootstrap] = useState(() => bootstrapExecuteState(handoff))
  const [doc, setDoc] = useState(() => bootstrap.doc)
  const [selectedPageId, setSelectedPageId] = useState(() => bootstrap.pageId)
  const [input, setInput] = useState(() => bootstrap.input ?? DEFAULT_INPUT)

  const {
    width: centerPanelWidth,
    setWidth: setCenterPanelWidth,
    onResizePointerDown: onCenterPanelResize,
  } = useHorizontalResize({
    initialWidth: loadWidth(CENTER_PANEL_STORAGE_KEY, CENTER_PANEL_DEFAULT, CENTER_PANEL_MIN),
    minWidth: CENTER_PANEL_MIN,
    maxWidth: CENTER_PANEL_MAX,
    invert: false,
  })

  const {
    width: rightPanelWidth,
    setWidth: setRightPanelWidth,
    onResizePointerDown: onRightPanelResize,
  } = useHorizontalResize({
    initialWidth: loadWidth(RIGHT_PANEL_STORAGE_KEY, RIGHT_PANEL_DEFAULT, RIGHT_PANEL_MIN),
    minWidth: RIGHT_PANEL_MIN,
    maxWidth: RIGHT_PANEL_MAX,
    invert: true,
  })

  const [centerPanelCollapsed, setCenterPanelCollapsed] = useState(() =>
    loadCollapsed(CENTER_PANEL_COLLAPSED_KEY),
  )
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true)

  const centerPanelWidthRef = useRef(centerPanelWidth)
  const rightPanelWidthRef = useRef(rightPanelWidth)
  centerPanelWidthRef.current = centerPanelWidth
  rightPanelWidthRef.current = rightPanelWidth

  const { state: runState, start, submitApproval, cancel, reset } = useWorkflowRunner()

  const autoStartRef = useRef(false)

  const selectedPage = doc.pages.find((page) => page.id === selectedPageId) ?? doc.pages[0]

  const diagram = useMemo(
    () => enrichDiagram(selectedPage?.diagram ?? { nodes: [], edges: [] }, paletteById),
    [selectedPage?.diagram, paletteById],
  )
  const diagramRef = useRef(diagram)
  diagramRef.current = diagram

  const plan = useMemo(() => getExecutablePlan(diagram), [diagram])
  const agentCount = plan.length
  const stepCount = agentCount
  const workflowName = selectedPage?.name ?? 'Untitled workflow'
  const workflowDescription = useMemo(() => {
    const approvalEdges = diagram.edges.filter((edge) => edge.connector?.humanApproval).length
    return `${stepCount}-step workflow${approvalEdges ? ` with ${approvalEdges} human approval gate(s)` : ''}.`
  }, [diagram, stepCount])

  const isRunning = runState.status === 'running' || runState.status === 'waiting-approval'

  // Hydrate document before paint when coming from the editor.
  useLayoutEffect(() => {
    const boot = bootstrapExecuteState(handoff)
    setDoc(boot.doc)
    setSelectedPageId(boot.pageId)
    if (boot.input) setInput(boot.input)
  }, [location.key, handoff.pageId, handoff.pageName, handoff.diagram, handoff.input])

  // Refresh from storage when returning without a router handoff.
  useEffect(() => {
    if (handoff.diagram && handoff.pageId) return

    const snapshot = loadExecutionSnapshot()
    if (snapshot?.diagram && snapshot.pageId) {
      const fresh = loadWorkflowDocument()
      setDoc(
        mergeDiagramIntoDocument(
          fresh,
          snapshot.pageId,
          snapshot.diagram,
          snapshot.pageName,
        ),
      )
      setSelectedPageId(snapshot.pageId)
      if (snapshot.input) setInput(snapshot.input)
      return
    }

    const fresh = loadWorkflowDocument()
    setDoc(fresh)
    setSelectedPageId((current) => {
      if (handoff.pageId && fresh.pages.some((page) => page.id === handoff.pageId)) {
        return handoff.pageId
      }
      if (fresh.pages.some((page) => page.id === current)) return current
      return fresh.activePageId ?? fresh.pages[0]?.id ?? ''
    })
  }, [location.key, handoff.pageId, handoff.diagram])

  // Inspector (Events & traces) starts collapsed on each visit to the execute page.
  useEffect(() => {
    setRightPanelCollapsed(true)
  }, [location.key])

  // Allow auto-start again when navigating from the editor with a fresh snapshot.
  useEffect(() => {
    autoStartRef.current = false
  }, [location.key])

  useEffect(() => {
    if (tool) document.title = `Execute — ${tool.title} — ${APP_NAME}`
  }, [tool])

  useEffect(() => {
    if (!centerPanelCollapsed) {
      localStorage.setItem(CENTER_PANEL_STORAGE_KEY, String(centerPanelWidth))
    }
  }, [centerPanelWidth, centerPanelCollapsed])

  useEffect(() => {
    localStorage.setItem(CENTER_PANEL_COLLAPSED_KEY, String(centerPanelCollapsed))
  }, [centerPanelCollapsed])

  useEffect(() => {
    if (!rightPanelCollapsed) {
      localStorage.setItem(RIGHT_PANEL_STORAGE_KEY, String(rightPanelWidth))
    }
  }, [rightPanelWidth, rightPanelCollapsed])

  const runExecution = useCallback(() => {
    const executionPlan = getExecutablePlan(diagramRef.current)
    if (executionPlan.length === 0) {
      toast.error('No agents in this workflow. Add at least one Agent block in the editor.')
      return false
    }
    clearExecutionSnapshot()
    reset()
    const page = doc.pages.find((candidate) => candidate.id === selectedPageId)
    if (!page) {
      toast.error('Select a workflow before executing.')
      return false
    }
    void persistWorkflowBuildSpec({
      doc,
      pageId: selectedPageId,
      diagram: diagramRef.current,
      paletteById,
      syncToDisk: true,
      requireApi: true,
    })
      .then((saved) => start(executionPlan, input, {
        workspaceId: saved.workspaceId,
        pageId: saved.pageId,
      }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to save workflow before execution.'
        toast.error(message)
      })
    return true
  }, [doc, input, paletteById, reset, selectedPageId, start])

  const handleExecute = useCallback(() => {
    runExecution()
  }, [runExecution])

  const handleWorkflowChange = useCallback(
    (pageId: string) => {
      setSelectedPageId(pageId)
      reset()
      autoStartRef.current = false
    },
    [reset],
  )

  const handleDiagramLayoutChange = useCallback(
    (updater: (diagram: Diagram) => Diagram) => {
      setDoc((previous) => {
        const next = {
          ...previous,
          pages: previous.pages.map((page) =>
            page.id !== selectedPageId ? page : { ...page, diagram: updater(page.diagram) },
          ),
        }
        saveWorkflowDocument(next)
        const page = next.pages.find((candidate) => candidate.id === selectedPageId)
        if (page) {
          void persistWorkflowBuildSpec({
            doc: next,
            pageId: selectedPageId,
            diagram: page.diagram,
            paletteById,
          })
        }
        return next
      })
    },
    [selectedPageId, paletteById],
  )

  const toggleCenterPanel = useCallback(() => {
    setCenterPanelCollapsed((previous) => {
      if (previous) setCenterPanelWidth(centerPanelWidthRef.current)
      else centerPanelWidthRef.current = centerPanelWidth
      return !previous
    })
  }, [centerPanelWidth, setCenterPanelWidth])

  const toggleRightPanel = useCallback(() => {
    setRightPanelCollapsed((previous) => {
      if (previous) setRightPanelWidth(rightPanelWidthRef.current)
      else rightPanelWidthRef.current = rightPanelWidth
      return !previous
    })
  }, [rightPanelWidth, setRightPanelWidth])

  useEffect(() => {
    if (!navState.autoStart || autoStartRef.current) return
    if (stepCount === 0) return

    autoStartRef.current = true
    if (navState.input) setInput(navState.input)
    runExecution()
  }, [navState.autoStart, navState.input, stepCount, runExecution])

  return (
    <div className="workspace-surface flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <ExecutionPageHeader
        workflows={doc.pages.map((page) => ({ id: page.id, name: page.name }))}
        selectedWorkflowId={selectedPageId}
        onWorkflowChange={handleWorkflowChange}
        stepCount={stepCount}
        runStatus={runState.status}
        isRunning={isRunning}
        onExecute={handleExecute}
        onStop={cancel}
        workflowSelectDisabled={isRunning}
      />

      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 min-w-0 flex-1">
          <ExecutionFlowCanvas
            diagram={diagram}
            paletteById={paletteById}
            runState={runState}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            onDiagramChange={handleDiagramLayoutChange}
          />
        </main>

        <ExecutionTimelineShell
          workflowName={workflowName}
          stepCount={stepCount}
          pendingSteps={plan}
          runState={runState}
          input={input}
          onInputChange={setInput}
          onRunAgain={handleExecute}
          onSubmitApproval={submitApproval}
          isRunning={isRunning}
          width={centerPanelWidth}
          collapsed={centerPanelCollapsed}
          onResizePointerDown={onCenterPanelResize}
          onToggleCollapse={toggleCenterPanel}
        />

        <ExecutionInspectorShell
          diagram={diagram}
          runState={runState}
          width={rightPanelWidth}
          collapsed={rightPanelCollapsed}
          onResizePointerDown={onRightPanelResize}
          onToggleCollapse={toggleRightPanel}
        />
      </div>
    </div>
  )
}
