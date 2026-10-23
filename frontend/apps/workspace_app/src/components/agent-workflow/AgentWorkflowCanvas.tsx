import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ArrowDown,
  ArrowRight,
  FlaskConical,
  LayoutTemplate,
  Sparkles,
  Trash2,
  LayoutGrid,
  Maximize2,
  Plus,
  RotateCcw,
  Undo2,
  ZoomIn,
  ZoomOut,
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
import { isStartFlowNode } from '@/components/agent-workflow/workflow-flow-nodes'
import {
  resolveFlowDirection,
  type Diagram,
  type DiagramNode,
  type FlowDirection,
  type Viewport,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { Selection } from '@/components/designer/selection-utils'
import { canvasInsertAnchor } from '@/components/agent-workflow/hooks/use-sub-workflow-actions'
import type { AgentAttachAction } from '@/components/agent-workflow/AgentNodeCard'
import { DevProfiler } from '@/utils/render-profiler'
import { cn } from '@/utils/cn'

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

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
  /** Empty-canvas template picker. */
  emptyState?: ReactNode
  /** Removes every node and connector, after the user confirms (the canvas's trash button). */
  onClearCanvas?: () => void
  /** Opens the library to add agents and tools (the canvas's top-right + button). */
  onOpenLibrary?: () => void
  /** Shown on an empty canvas once the template picker is dismissed. */
  onBrowseTemplates?: () => void
  onAskAi?: () => void
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
      hideEmptyState = false,
    },
    ref,
  ) {
    const canvasAreaRef = useRef<HTMLDivElement>(null)
    const diagramRef = useRef(diagram)
    diagramRef.current = diagram

    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
    const [confirmClearOpen, setConfirmClearOpen] = useState(false)

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
    }, [activePageId, applyCenteredViewport])

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
    const hasStartNode = diagram.nodes.some(isStartFlowNode)
    // The Start node's play button runs the workflow; without a Start node the bottom bar offers it.
    const runFromStart = hasAgents && !executionPanelOpen ? onOpenExecution : undefined
    const flowDirection = resolveFlowDirection(diagram.direction)

    return (
      <DevProfiler id="AgentWorkflowCanvas">
        <div ref={canvasAreaRef} className="relative min-h-0 flex-1 touch-none overscroll-none bg-canvas">
          {diagram.nodes.length === 0 && !hideEmptyState && (
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

          {diagram.nodes.length === 0 && hideEmptyState && onOpenLibrary && (
            <EmptyCanvasStart
              onAddFirstStep={onOpenLibrary}
              onBrowseTemplates={onBrowseTemplates}
              onAskAi={onAskAi}
            />
          )}

          {/* Bottom row: view controls on the left, the run button centred (pushed right when the
              canvas is too narrow for both, never overlapping). */}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex items-center gap-3">
            <div className="flex min-w-0 flex-1 basis-0 justify-start">
              {(diagram.nodes.length > 0 || hideEmptyState) && (
                <div className="pointer-events-auto flex items-center gap-2">
                  <CanvasControl label="Fit to view" onClick={fitView}>
                    <Maximize2 />
                  </CanvasControl>
                  <CanvasControl label="Zoom in" onClick={() => zoomBy(1.2)}>
                    <ZoomIn />
                  </CanvasControl>
                  <CanvasControl label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
                    <ZoomOut />
                  </CanvasControl>
                  {onUndo && (
                    <CanvasControl label="Undo" onClick={onUndo}>
                      <Undo2 />
                    </CanvasControl>
                  )}
                  <CanvasControl label="Tidy up (auto-layout)" onClick={onAutoLayout}>
                    <LayoutGrid />
                  </CanvasControl>
                  {onClearCanvas && diagram.nodes.length > 0 && (
                    <CanvasControl label="Clear canvas" onClick={() => setConfirmClearOpen(true)}>
                      <Trash2 />
                    </CanvasControl>
                  )}
                  {onFlowDirectionChange && (
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
            {hasAgents && (onOpenExecution || onBackToDesign) && (
              <div className="pointer-events-auto flex shrink-0 items-center gap-2">
                {executionPanelOpen && onBackToDesign ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 border-border bg-[hsl(var(--canvas))] px-4 text-sm dark:border-white/[0.18]"
                    onClick={onBackToDesign}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Back to design
                  </Button>
                ) : onOpenExecution && !hasStartNode ? (
                  <Button
                    type="button"
                    className="h-10 gap-2 bg-emerald-600 px-5 text-sm text-white hover:bg-emerald-700"
                    onClick={onOpenExecution}
                  >
                    <FlaskConical className="h-4 w-4" />
                    Execute workflow
                  </Button>
                ) : null}
              </div>
            )}
            <div className="flex-1 basis-0" aria-hidden />
          </div>

          {onOpenLibrary && (
            <div className="absolute right-4 top-4 z-20">
              <CanvasControl label="Add agents and tools" onClick={onOpenLibrary} size="lg">
                <Plus />
              </CanvasControl>
            </div>
          )}

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
            onRunWorkflow={runFromStart}
          />

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

/** The empty canvas's starting point: a large "+ Add first step" tile, then templates or AI. */
function EmptyCanvasStart({
  onAddFirstStep,
  onBrowseTemplates,
  onAskAi,
}: {
  onAddFirstStep: () => void
  onBrowseTemplates?: () => void
  onAskAi?: () => void
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="pointer-events-auto flex flex-col items-center text-center">
        <button
          type="button"
          onClick={onAddFirstStep}
          className={cn(
            'group flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed',
            'border-foreground/25 text-foreground/60 transition-colors',
            'hover:border-primary hover:bg-primary/5 hover:text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label="Add first step"
        >
          <Plus className="h-9 w-9 transition-transform group-hover:scale-110" strokeWidth={1.5} />
        </button>
        <p className="mt-4 text-sm font-semibold text-foreground">Add first step</p>
        <p className="mt-1 max-w-[18rem] text-xs text-muted-foreground">
          Add a Start node and an agent, then connect them to build your workflow.
        </p>
        {(onBrowseTemplates || onAskAi) && (
          <div className="mt-4 flex items-center gap-2">
            {onBrowseTemplates && (
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={onBrowseTemplates}>
                <LayoutTemplate className="h-3.5 w-3.5" />
                Browse templates
              </Button>
            )}
            {onAskAi && (
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={onAskAi}>
                <Sparkles className="h-3.5 w-3.5" />
                Ask AI
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
