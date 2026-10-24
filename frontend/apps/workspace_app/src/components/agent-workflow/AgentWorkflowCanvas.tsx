import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ArrowDown,
  ArrowRight,
  Sparkles,
  Trash2,
  LayoutGrid,
  Maximize2,
  Plus,
  RotateCcw,
  Undo2,
  ZoomIn,
  ZoomOut,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DesignerCanvas } from '@/components/designer/DesignerCanvas'
import { computeCenteredViewport, zoomViewportAt } from '@/components/designer/viewport-utils'
import { listAgentNodes } from '@/components/agent-workflow/tool-agent-mapping'
import { isFlowBoundaryNode, isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import { START_GAP, startNodeSize } from '@/components/agent-workflow/workflow-start-node'
import { MODEL_PROVIDER_DND_MIME, type ModelProviderId } from '@/components/agent-workflow/model-providers'
import {
  FOCUS_CARD_WIDTH,
  FocusCardShell,
  type CanvasFocus,
  type NodeRunStatus,
} from '@/components/agent-workflow/canvas-focus'
import {
  resolveFlowDirection,
  type Diagram,
  type DiagramNode,
  type FlowDirection,
  type Viewport,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { Selection } from '@/components/designer/selection-utils'
import { canvasInsertAnchor } from '@/components/agent-workflow/sub-workflow-ops'
import type { AgentAttachAction } from '@/components/agent-workflow/AgentNodeCard'
import { DevProfiler } from '@/utils/render-profiler'
import { cn } from '@/utils/cn'

/** Workflows open at 90%; large ones zoom out further to fit. */
const DEFAULT_ZOOM = 0.9
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: DEFAULT_ZOOM }

const FLOW_DIRECTION_OPTIONS = [
  { value: 'horizontal', label: 'Horizontal', title: 'Flow left to right', icon: ArrowRight },
  { value: 'vertical', label: 'Vertical', title: 'Flow top to bottom', icon: ArrowDown },
] as const satisfies ReadonlyArray<{ value: FlowDirection; label: string; title: string; icon: unknown }>

export interface AgentWorkflowCanvasHandle {
  getInsertAnchor: () => { x: number; y: number }
  zoomBy: (factor: number) => void
  fitView: () => void
}

interface AgentWorkflowCanvasProps {
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  onChange: (updater: (previous: Diagram) => Diagram) => void
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  snapToGrid: boolean
  showGrid: boolean
  activePageId: string
  onAutoLayout: () => void
  onFlowDirectionChange?: (direction: FlowDirection) => void
  transformDroppedNode: (node: DiagramNode, item: PaletteItem) => DiagramNode
  finalizeDroppedNode: (
    node: DiagramNode,
    currentDiagram: Diagram,
    world: { x: number; y: number },
  ) => DiagramNode | null
  onOpenExecution?: () => void
  executionPanelOpen?: boolean
  onBackToDesign?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onNodeAttachAction?: (agentId: string, action: AgentAttachAction) => void
  /** Insert Human Review (HITL) on a connector. */
  onInsertHitlOnEdge?: (edgeId: string) => void
  /** The "+" on a connector was clicked, at screen position (x, y). */
  onInsertNodeOnEdge?: (edgeId: string, x: number, y: number) => void
  /** The "+" on a node's output port was clicked, at screen position (x, y). */
  onAddNodeAfter?: (nodeId: string, x: number, y: number) => void
  /** Empty-canvas template picker. */
  emptyState?: ReactNode
  /** Removes every node and connector, after the user confirms (the canvas's trash button). */
  onClearCanvas?: () => void
  /** Opens the library to add agents and tools (the canvas's top-right + button). */
  onOpenLibrary?: () => void
  /** Shown on an empty canvas once the template picker is dismissed. */
  /** Import a workflow from a JSON file (offered on an empty canvas). */
  onBrowseTemplates?: () => void
  onAskAi?: () => void
  /** The focused card: the canvas glides to its target, dims the rest and shows the card. */
  focus?: CanvasFocus | null
  /** A node or connector was clicked (not dragged). */
  onNodeOpen?: (nodeId: string) => void
  onEdgeOpen?: (edgeId: string) => void
  /** Run state per node id, drawn as a ring around the node. */
  runStatusByNode?: Record<string, NodeRunStatus>
  /** Floats at the top centre of the canvas, such as the multi-selection actions. */
  selectionBar?: ReactNode
  /** A node was right-clicked, at screen position (x, y). */
  onNodeContextMenu?: (nodeId: string, x: number, y: number) => void
  /** A model client from the library was dropped onto a node. */
  onDropModelProvider?: (nodeId: string, providerId: ModelProviderId) => void
  hideEmptyState?: boolean
}
export const AgentWorkflowCanvas = memo(
  forwardRef<AgentWorkflowCanvasHandle, AgentWorkflowCanvasProps>(function AgentWorkflowCanvas(
    {
      diagram,
      paletteById,
      onChange,
      selection,
      onSelectionChange,
      snapToGrid,
      showGrid,
      activePageId,
      onAutoLayout,
      onFlowDirectionChange,
      transformDroppedNode,
      onNodeAttachAction,
      onInsertHitlOnEdge,
      onAddNodeAfter,
      onInsertNodeOnEdge,
      finalizeDroppedNode,
      onOpenExecution,
      executionPanelOpen = false,
      onBackToDesign,
      onUndo,
      onRedo,
      emptyState,
      onClearCanvas,
      onOpenLibrary,
      onBrowseTemplates,
      onAskAi,
      focus = null,
      onNodeOpen,
      onEdgeOpen,
      runStatusByNode,
      selectionBar,
      onNodeContextMenu,
      onDropModelProvider,
      hideEmptyState = false,
    },
    ref,
  ) {
    const canvasAreaRef = useRef<HTMLDivElement>(null)
    const diagramRef = useRef(diagram)
    diagramRef.current = diagram

    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
    const [confirmClearOpen, setConfirmClearOpen] = useState(false)
    // A new workflow holds just Start (and maybe End); it is "empty" until something else is added.
    const isEmptyWorkflow = diagram.nodes.every(isFlowBoundaryNode)
    const startNodeId = diagram.nodes.find(isStartFlowNode)?.id
    const viewportRef = useRef(viewport)
    viewportRef.current = viewport
    const glideFrameRef = useRef(0)
    const [areaSize, setAreaSize] = useState({ width: 0, height: 0 })

    const applyCenteredViewport = useCallback(
      (targetDiagram: Diagram) => {
        const rect = canvasAreaRef.current?.getBoundingClientRect()
        if (!rect?.width || !rect?.height) return
        const centered = computeCenteredViewport(
          targetDiagram,
          paletteById,
          rect.width,
          rect.height,
          DEFAULT_ZOOM,
        )
        // An empty workflow shows Start with the "Add first agent" tile after it: centre the
        // pair, not Start alone, by shifting half the tile and its gap back along the flow.
        const start = targetDiagram.nodes.every(isFlowBoundaryNode)
          ? targetDiagram.nodes.find(isStartFlowNode)
          : undefined
        if (start) {
          const vertical = resolveFlowDirection(targetDiagram.direction) === 'vertical'
          const { width, height } = startNodeSize(start)
          const { scale } = centered
          // Start's centre sits half the pair's extra span (gap + tile) before the canvas centre.
          const shift = ((START_GAP + (vertical ? height : width)) / 2) * scale
          const centerX = rect.width / 2 - (vertical ? 0 : shift)
          const centerY = rect.height / 2 - (vertical ? shift : 0)
          setViewport({
            scale,
            x: centerX - (start.x + width / 2) * scale,
            y: centerY - (start.y + height / 2) * scale,
          })
          return
        }
        setViewport(centered)
      },
      [paletteById],
    )

    useLayoutEffect(() => {
      applyCenteredViewport(diagramRef.current)
      const frame = requestAnimationFrame(() => applyCenteredViewport(diagramRef.current))
      return () => cancelAnimationFrame(frame)
    }, [activePageId, applyCenteredViewport])

    // Start is added to a new page just after it opens; centre Start and its tile once it is there.
    useLayoutEffect(() => {
      if (isEmptyWorkflow && startNodeId) applyCenteredViewport(diagramRef.current)
    }, [isEmptyWorkflow, startNodeId, applyCenteredViewport])

    const getInsertAnchor = useCallback(
      () => canvasInsertAnchor(diagramRef.current, canvasAreaRef, viewport),
      [viewport],
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

    const fitView = useCallback(() => {
      applyCenteredViewport(diagramRef.current)
    }, [applyCenteredViewport])

    useImperativeHandle(ref, () => ({ getInsertAnchor, zoomBy, fitView }), [
      getInsertAnchor,
      zoomBy,
      fitView,
    ])

    const handleViewportChange = useCallback((updater: (previous: Viewport) => Viewport) => {
      setViewport(updater)
    }, [])

    // Track the canvas size so the focus card fits it.
    useLayoutEffect(() => {
      const element = canvasAreaRef.current
      if (!element) return
      const update = () => setAreaSize({ width: element.clientWidth, height: element.clientHeight })
      update()
      const observer = new ResizeObserver(update)
      observer.observe(element)
      return () => observer.disconnect()
    }, [])

    /** Pan the canvas by (dx, dy) screen pixels, eased, or at once when motion is reduced. */
    const glideBy = useCallback((dx: number, dy: number) => {
      cancelAnimationFrame(glideFrameRef.current)
      const from = viewportRef.current
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (reduce) {
        setViewport({ ...from, x: from.x + dx, y: from.y + dy })
        return
      }
      const started = performance.now()
      const duration = 280
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setViewport({ ...from, x: from.x + dx * eased, y: from.y + dy * eased })
        if (t < 1) glideFrameRef.current = requestAnimationFrame(step)
      }
      glideFrameRef.current = requestAnimationFrame(step)
    }, [])

    useEffect(() => () => cancelAnimationFrame(glideFrameRef.current), [])

    const EDGE_GAP = 16
    // Node and connector cards live in the workspace: sized in canvas units and scaled with the
    // zoom like any node. Workflow settings (not tied to a node) stays at screen size.
    const inWorkspace = Boolean(focus && focus.target.kind !== 'center')
    const cardScale = inWorkspace ? viewport.scale : 1
    // In the workspace the card never exceeds what fits on screen at the current zoom; its
    // content scrolls inside it.
    const fitWidth = (areaSize.width - EDGE_GAP * 2) / cardScale
    const fitHeight = (areaSize.height - EDGE_GAP * 2) / cardScale
    const cardWidth = inWorkspace
      ? Math.max(240, Math.min(focus?.width ?? FOCUS_CARD_WIDTH, fitWidth))
      : Math.max(280, Math.min(focus?.width ?? FOCUS_CARD_WIDTH, areaSize.width - EDGE_GAP * 2))
    const cardMaxHeight = inWorkspace
      ? Math.max(200, Math.min(focus?.layout === 'fill' ? 560 : 600, fitHeight))
      : Math.max(200, areaSize.height - EDGE_GAP * 2)

    // Where the focused node (or connector midpoint) is on screen, re-measured as the canvas
    // pans and zooms so the expanded card stays pinned to it.
    const focusKey = focus?.key ?? null
    const focusTarget = focus?.target
    const [anchor, setAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
    const measureTarget = useCallback(() => {
      const area = canvasAreaRef.current
      if (!area || !focusTarget || focusTarget.kind === 'center') return null
      const selector =
        focusTarget.kind === 'node'
          ? `[data-node-id="${CSS.escape(focusTarget.id)}"]`
          : `[data-edge-id="${CSS.escape(focusTarget.id)}"]`
      const element = area.querySelector(selector)
      if (!element) return null
      const areaRect = area.getBoundingClientRect()
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left - areaRect.left,
        top: rect.top - areaRect.top,
        width: rect.width,
        height: rect.height,
      }
    }, [focusTarget])

    useLayoutEffect(() => {
      setAnchor(focusKey ? measureTarget() : null)
    }, [focusKey, measureTarget, viewport, diagram, areaSize])

    // The card grows out of the node. The scale transition only runs while it grows, so the
    // card follows zooming instantly afterwards.
    const [expanded, setExpanded] = useState(false)
    const [growing, setGrowing] = useState(false)
    useLayoutEffect(() => {
      setExpanded(false)
      setGrowing(Boolean(focusKey))
      if (!focusKey) return
      const frame = requestAnimationFrame(() => setExpanded(true))
      const done = window.setTimeout(() => setGrowing(false), 260)
      return () => {
        cancelAnimationFrame(frame)
        window.clearTimeout(done)
      }
    }, [focusKey])

    // The card's laid-out size in its own units (canvas units in the workspace), unaffected by
    // its scale.
    const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null)
    const cardObserverRef = useRef<ResizeObserver | null>(null)
    const cardRef = useCallback((element: HTMLDivElement | null) => {
      cardObserverRef.current?.disconnect()
      cardObserverRef.current = null
      if (!element) {
        setCardSize(null)
        return
      }
      const update = () => setCardSize({ width: element.offsetWidth, height: element.offsetHeight })
      update()
      const observer = new ResizeObserver(update)
      observer.observe(element)
      cardObserverRef.current = observer
    }, [])

    // The expanded node is the node at a larger size on the same flow line: left to right, it
    // keeps its left edge, grows right and equally up and down; top to bottom, it keeps its top
    // edge, grows down and equally left and right. Its connection points stay at the centre of
    // each side, level with its neighbours.
    const flowVertical = resolveFlowDirection(diagram.direction) === 'vertical'
    const cardHeight = cardSize?.height ?? (focus?.layout === 'fill' ? cardMaxHeight : Math.min(360, cardMaxHeight))
    const hiddenNodeId = focus?.target.kind === 'node' ? focus.target.id : undefined

    /**
     * Layout position of a card of `height` (own units) for a node at `node` (screen rect),
     * with the transform origin that keeps it on the node's flow line once scaled.
     */
    const nodeCardPlacement = useCallback(
      (node: { left: number; top: number; width: number; height: number }, height: number) =>
        flowVertical
          ? { left: node.left + node.width / 2 - cardWidth / 2, top: node.top, origin: 'top center' }
          : { left: node.left, top: node.top + node.height / 2 - height / 2, origin: 'left center' },
      [flowVertical, cardWidth],
    )

    const cardPosition = (() => {
      if (!focus) return null
      if (focus.target.kind === 'center' || !anchor) {
        return {
          left: Math.max(EDGE_GAP, (areaSize.width - cardWidth * cardScale) / 2),
          top: 20,
          origin: 'top left',
          startScale: 0.92,
        }
      }
      if (focus.target.kind === 'edge') {
        return {
          left: anchor.left + anchor.width / 2 - cardWidth / 2,
          top: anchor.top + anchor.height / 2 + 12,
          origin: 'top center',
          startScale: 0.92,
        }
      }
      return {
        ...nodeCardPlacement(anchor, cardHeight),
        startScale: Math.min(1, anchor.width / (cardWidth * cardScale)),
      }
    })()

    // Once the card has its real size, glide only as far as needed for it to fit on screen.
    const glidedForRef = useRef<string | null>(null)
    useEffect(() => {
      if (!focusKey) {
        glidedForRef.current = null
        return
      }
      if (glidedForRef.current === focusKey || !cardSize || !inWorkspace) return
      const rect = measureTarget()
      if (!rect) return
      glidedForRef.current = focusKey
      // The card's on-screen rectangle once scaled about its origin.
      const width = cardSize.width * cardScale
      const height = cardSize.height * cardScale
      const screen =
        focusTarget?.kind === 'edge'
          ? { left: rect.left + rect.width / 2 - width / 2, top: rect.top + rect.height / 2 + 12 }
          : flowVertical
            ? { left: rect.left + rect.width / 2 - width / 2, top: rect.top }
            : { left: rect.left, top: rect.top + rect.height / 2 - height / 2 }
      const fit = (start: number, size: number, available: number) =>
        start < EDGE_GAP
          ? EDGE_GAP - start
          : start + size > available - EDGE_GAP
            ? Math.max(EDGE_GAP - start, available - EDGE_GAP - size - start)
            : 0
      const dx = fit(screen.left, width, areaSize.width)
      const dy = fit(screen.top, height, areaSize.height)
      if (dx || dy) glideBy(dx, dy)
      // Only once per focus; panning while it is open must not pull the canvas back.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusKey, cardSize])

    // The expanded node in canvas units, relative to the node's top-left, so its connectors
    // meet the card's sides and the nodes after it move by exactly the space it grew.
    const expandedNode = useMemo(() => {
      if (!hiddenNodeId || !cardSize || !anchor) return undefined
      const nodeWidth = anchor.width / viewport.scale
      const nodeHeight = anchor.height / viewport.scale
      return {
        id: hiddenNodeId,
        offsetX: flowVertical ? (nodeWidth - cardSize.width) / 2 : 0,
        offsetY: flowVertical ? 0 : (nodeHeight - cardSize.height) / 2,
        width: cardSize.width,
        height: cardSize.height,
      }
      // The anchor's size is the node's size on screen; its position changes as the canvas pans.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hiddenNodeId, cardSize, viewport.scale, anchor?.width, anchor?.height, flowVertical])

    // Where Start is on screen while the workflow is empty, for the "Add first agent" tile.
    const [startAnchor, setStartAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
    useLayoutEffect(() => {
      const area = canvasAreaRef.current
      const element =
        isEmptyWorkflow && startNodeId && area
          ? area.querySelector(`[data-node-id="${CSS.escape(startNodeId)}"]`)
          : null
      if (!area || !element) {
        setStartAnchor(null)
        return
      }
      const areaRect = area.getBoundingClientRect()
      const rect = element.getBoundingClientRect()
      setStartAnchor({ left: rect.left - areaRect.left, top: rect.top - areaRect.top, width: rect.width, height: rect.height })
    }, [isEmptyWorkflow, startNodeId, viewport, areaSize])

    // Esc closes the focused card.
    const closeFocus = focus?.onClose
    useEffect(() => {
      if (!closeFocus) return
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeFocus()
      }
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }, [closeFocus])

    // Block trackpad pinch / browser page-zoom over the whole canvas chrome.
    // DesignerCanvas owns two-finger pan; this only swallows ctrl/meta wheel (pinch).
    useEffect(() => {
      const element = canvasAreaRef.current
      if (!element) return

      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
        }
      }

      const blockGesture = (event: Event) => {
        event.preventDefault()
      }

      element.addEventListener('wheel', onWheel, { passive: false, capture: true })
      element.addEventListener('gesturestart', blockGesture as EventListener, {
        passive: false,
      } as AddEventListenerOptions)
      element.addEventListener('gesturechange', blockGesture as EventListener, {
        passive: false,
      } as AddEventListenerOptions)

      return () => {
        element.removeEventListener('wheel', onWheel, true)
        element.removeEventListener('gesturestart', blockGesture as EventListener)
        element.removeEventListener('gesturechange', blockGesture as EventListener)
      }
    }, [])

    const hasAgents = listAgentNodes(diagram).length > 0
    // Workflows run from the Start node (every main workflow has one).
    const runFromStart = hasAgents && !executionPanelOpen ? onOpenExecution : undefined
    const flowDirection = resolveFlowDirection(diagram.direction)

    return (
      <DevProfiler id="AgentWorkflowCanvas">
        <div
          ref={canvasAreaRef}
          className="relative min-h-0 flex-1 touch-none overflow-hidden overscroll-none bg-canvas"
          // A model client dragged from the library onto an agent sets its model client.
          onDragOverCapture={(event) => {
            if (!onDropModelProvider || !event.dataTransfer.types.includes(MODEL_PROVIDER_DND_MIME)) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'link'
          }}
          onDropCapture={(event) => {
            if (!onDropModelProvider || !event.dataTransfer.types.includes(MODEL_PROVIDER_DND_MIME)) return
            event.preventDefault()
            event.stopPropagation()
            const providerId = event.dataTransfer.getData(MODEL_PROVIDER_DND_MIME) as ModelProviderId
            const nodeElement = document
              .elementsFromPoint(event.clientX, event.clientY)
              .map((element) => element.closest('[data-node-id]'))
              .find(Boolean)
            const nodeId = nodeElement?.getAttribute('data-node-id')
            const node = nodeId ? diagram.nodes.find((candidate) => candidate.id === nodeId) : undefined
            if (node && listAgentNodes(diagram).some((agent) => agent.id === node.id)) {
              onDropModelProvider(node.id, providerId)
            }
          }}
        >
          {isEmptyWorkflow && !hideEmptyState && (
            <div
              className="pointer-events-none absolute inset-0 z-30 flex items-stretch justify-center overflow-y-auto overscroll-contain bg-black/35 p-0 backdrop-blur-md sm:items-center sm:p-4 sm:backdrop-blur-xl"
              style={{ touchAction: 'pan-y' }}
            >
              <div className="pointer-events-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-foreground/25 bg-card shadow-[0_35px_80px_-30px_rgba(0,0,0,0.45)] sm:my-auto sm:h-auto sm:max-h-[min(85%,40rem)] sm:rounded-[1.5rem] sm:border sm:bg-card/90 sm:backdrop-blur-xl">
                {emptyState ?? (
                  <div className="p-4 sm:px-5 sm:py-5">
                    <p className="text-sm font-medium text-foreground">Build your agent workflow</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add agents from the Library tab, or use{' '}
                      <span className="font-medium text-foreground dark:text-foreground">Generate</span>{' '}
                      in the header to draft a full workflow from a prompt.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {isEmptyWorkflow && hideEmptyState && onOpenLibrary && (
            <EmptyCanvasStart
              anchor={startAnchor}
              scale={viewport.scale}
              vertical={resolveFlowDirection(diagram.direction) === 'vertical'}
              onAddFirstStep={onOpenLibrary}
              onBrowseTemplates={onBrowseTemplates}
              onAskAi={onAskAi}
            />
          )}

          {/* Bottom row: view controls on the left, the run button centred (pushed right when the
              canvas is too narrow for both, never overlapping). */}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex items-end gap-3">
            <div className="flex min-w-0 flex-1 basis-0 justify-start">
              {(diagram.nodes.length > 0 || hideEmptyState) && (
                <div className="pointer-events-auto flex items-end gap-2">
                  {/* The flow direction is chosen while setting up a new workflow; once it has
                      nodes the layout is set, so the switch goes away. */}
                  {onFlowDirectionChange && isEmptyWorkflow && (
                    <div
                      role="radiogroup"
                      aria-label="Flow direction"
                      className="ml-1 flex h-9 items-center gap-0.5 rounded-md border border-border bg-[hsl(var(--canvas))] p-0.5 dark:border-white/[0.18]"
                    >
                      {FLOW_DIRECTION_OPTIONS.map((option) => {
                        const active = flowDirection === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.title}
                            title={option.title}
                            onClick={() => onFlowDirectionChange(option.value)}
                            className={cn(
                              'flex h-full w-8 items-center justify-center rounded-[5px] transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              active
                                ? 'bg-accent text-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <option.icon className="h-4 w-4" />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Runs start from the Start node; this only offers the way back after a run (mobile). */}
            {hasAgents && executionPanelOpen && onBackToDesign && (
              <div className="pointer-events-auto flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 gap-2 border-border bg-[hsl(var(--canvas))] px-4 text-sm dark:border-white/[0.18]"
                  onClick={onBackToDesign}
                >
                  <RotateCcw className="h-4 w-4" />
                  Back to design
                </Button>
              </div>
            )}
            {/* Zoom: bottom-right, stacked. */}
            <div className="flex flex-1 basis-0 justify-end">
              {(diagram.nodes.length > 0 || hideEmptyState) && (
                <div className="pointer-events-auto flex flex-col items-center gap-2">
                  <CanvasControl label="Zoom in" onClick={() => zoomBy(1.2)}>
                    <ZoomIn />
                  </CanvasControl>
                  <CanvasControl label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
                    <ZoomOut />
                  </CanvasControl>
                  <CanvasControl label="Fit to view" onClick={fitView}>
                    <Maximize2 />
                  </CanvasControl>
                </div>
              )}
            </div>
          </div>

          {/* Top-right: canvas actions (undo, tidy up, clear). */}
          <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-col items-center gap-2">
            {(diagram.nodes.length > 0 || hideEmptyState) && (
              <div className="pointer-events-auto flex flex-col items-center gap-2">
                {onUndo && (
                  <CanvasControl label="Undo" onClick={onUndo}>
                    <Undo2 />
                  </CanvasControl>
                )}
                <CanvasControl label="Tidy up (auto-layout)" onClick={onAutoLayout}>
                  <LayoutGrid />
                </CanvasControl>
                {onClearCanvas && !isEmptyWorkflow && (
                  <CanvasControl label="Clear canvas" onClick={() => setConfirmClearOpen(true)}>
                    <Trash2 />
                  </CanvasControl>
                )}
              </div>
            )}
          </div>

          <DesignerCanvas
            diagram={diagram}
            onChange={onChange}
            paletteById={paletteById}
            viewport={viewport}
            onViewportChange={handleViewportChange}
            selection={selection}
            onSelectionChange={onSelectionChange}
            snapToGrid={snapToGrid}
            showGrid={showGrid}
            onZoomIn={() => zoomBy(1.2)}
            onZoomOut={() => zoomBy(1 / 1.2)}
            onFitToScreen={fitView}
            agentMode
            transformDroppedNode={transformDroppedNode}
            finalizeDroppedNode={finalizeDroppedNode}
            selectionDisabled={executionPanelOpen}
            onUndo={onUndo}
            onRedo={onRedo}
            onNodeAttachAction={onNodeAttachAction}
            onInsertHitlOnEdge={onInsertHitlOnEdge}
            onAddNodeAfter={onAddNodeAfter}
            onInsertNodeOnEdge={onInsertNodeOnEdge}
            onRunWorkflow={runFromStart}
            onNodeOpen={onNodeOpen}
            onEdgeOpen={onEdgeOpen}
            runStatusByNode={runStatusByNode}
            hiddenNodeId={hiddenNodeId}
            expandedNode={expandedNode}
            onNodeContextMenu={onNodeContextMenu}
            onBackgroundClick={focus && focus.target.kind !== 'center' ? focus.onClose : undefined}
          />

          {selectionBar && !focus ? (
            <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">{selectionBar}</div>
          ) : null}

          {focus && cardPosition && areaSize.width > 0 ? (
            <FocusCardShell
              key={focus.key}
              focus={focus}
              elementRef={cardRef}
              className={cn('absolute z-40', growing && 'transition-[transform,opacity] duration-200 ease-out')}
              style={{
                left: cardPosition.left,
                top: cardPosition.top,
                width: cardWidth,
                transformOrigin: cardPosition.origin,
                transform: `scale(${cardScale * (expanded ? 1 : cardPosition.startScale)})`,
                opacity: expanded ? 1 : 0.6,
                ...(focus.layout === 'fill' ? { height: cardMaxHeight } : { maxHeight: cardMaxHeight }),
              }}
            />
          ) : null}

          {onClearCanvas && (
            <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Clear the canvas?</DialogTitle>
                  <DialogDescription>
                    This removes every node and connection on this page. You can undo it right after.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setConfirmClearOpen(false)
                      onClearCanvas()
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear canvas
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </DevProfiler>
    )
  }),
)

/** An outlined square button floating on the canvas, like n8n's canvas controls. */
function CanvasControl({
  label,
  onClick,
  size = 'md',
  children,
}: {
  label: string
  onClick: () => void
  size?: 'md' | 'lg'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex items-center justify-center rounded-md border border-border bg-[hsl(var(--canvas))] text-foreground/80 transition-colors dark:border-white/[0.18]',
        'hover:border-foreground/30 hover:bg-accent hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        '[&_svg]:h-4 [&_svg]:w-4',
        size === 'lg' ? 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5' : 'h-9 w-9',
      )}
    >
      {children}
    </button>
  )
}

/**
 * The empty workflow's next step: a dashed "+" tile right after Start (where the first agent
 * will go), joined to it by a dashed line, with JSON import and AI as alternatives. Without
 * Start on screen it sits in the middle of the canvas.
 */
function EmptyCanvasStart({
  anchor,
  scale,
  vertical,
  onAddFirstStep,
  onBrowseTemplates,
  onAskAi,
}: {
  anchor: { left: number; top: number; width: number; height: number } | null
  scale: number
  vertical: boolean
  onAddFirstStep: () => void
  /** Import a workflow from a JSON file (offered on an empty canvas). */
  onBrowseTemplates?: () => void
  onAskAi?: () => void
}) {
  const alternatives = (onBrowseTemplates || onAskAi) && (
    <div className="mt-3 flex items-center gap-2">
      {onBrowseTemplates && (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onBrowseTemplates}>
          <Upload className="h-3.5 w-3.5" />
          Import JSON
        </Button>
      )}
      {onAskAi && (
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onAskAi}>
          <Sparkles className="h-3.5 w-3.5" />
          Ask AI
        </Button>
      )}
    </div>
  )
  const tileButton = (width: number, height = width) => (
    <button
      type="button"
      onClick={onAddFirstStep}
      style={{ width, height }}
      className={cn(
        'group flex shrink-0 items-center justify-center rounded-xl border-2 border-dashed',
        'border-foreground/30 bg-background/40 text-foreground/60 transition-colors',
        'hover:border-primary hover:bg-primary/5 hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      aria-label="Add first agent"
      title="Add first agent"
    >
      <Plus className="h-1/2 w-1/2 transition-transform group-hover:scale-110" strokeWidth={1.5} />
    </button>
  )

  if (!anchor) {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="pointer-events-auto flex flex-col items-center text-center">
          {tileButton(96)}
          <p className="mt-4 text-sm font-semibold text-foreground">Add first agent</p>
          {alternatives}
        </div>
      </div>
    )
  }

  // Right after Start along the flow (where the first agent lands), the same size as Start.
  const gap = START_GAP * scale
  const tileLeft = vertical ? anchor.left : anchor.left + anchor.width + gap
  const tileTop = vertical ? anchor.top + anchor.height + gap : anchor.top
  const line = vertical
    ? { x1: anchor.left + anchor.width / 2, y1: anchor.top + anchor.height, x2: anchor.left + anchor.width / 2, y2: tileTop }
    : { x1: anchor.left + anchor.width, y1: anchor.top + anchor.height / 2, x2: tileLeft, y2: anchor.top + anchor.height / 2 }

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" aria-hidden>
        <line
          {...line}
          className="stroke-foreground/30"
          strokeWidth={1.5}
          strokeDasharray="5 5"
        />
      </svg>
      <div
        className="absolute z-10 flex flex-col items-center"
        style={vertical ? { left: tileLeft, top: tileTop } : { left: tileLeft, top: tileTop }}
      >
        {tileButton(anchor.width, anchor.height)}
        <div className="absolute left-1/2 top-full flex -translate-x-1/2 flex-col items-center whitespace-nowrap pt-3 text-center">
          <p className="text-xs font-semibold text-foreground">Add first agent</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">It connects to Start automatically</p>
          {alternatives}
        </div>
      </div>
    </>
  )
}
