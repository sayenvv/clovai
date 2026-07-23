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
import { LayoutGrid, Maximize2, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DesignerCanvas } from '@/components/designer/DesignerCanvas'
import { computeCenteredViewport, zoomViewportAt } from '@/components/designer/viewport-utils'
import { listAgentNodes } from '@/components/agent-workflow/tool-agent-mapping'
import type { Diagram, DiagramNode, Viewport } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { Selection } from '@/components/designer/selection-utils'
import { canvasInsertAnchor } from '@/components/agent-workflow/hooks/use-sub-workflow-actions'
import type { AgentAttachAction } from '@/components/agent-workflow/AgentNodeCard'
import { DevProfiler } from '@/utils/render-profiler'

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

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
      hideEmptyState = false,
    },
    ref,
  ) {
    const canvasAreaRef = useRef<HTMLDivElement>(null)
    const diagramRef = useRef(diagram)
    diagramRef.current = diagram

    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)

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

    return (
      <DevProfiler id="AgentWorkflowCanvas">
        <div ref={canvasAreaRef} className="relative min-h-0 flex-1 touch-none overscroll-none bg-canvas">
          {diagram.nodes.length === 0 && !hideEmptyState && (
            <div
              className="pointer-events-none absolute inset-0 z-30 flex items-stretch justify-center overflow-y-auto overscroll-contain bg-black/35 p-0 backdrop-blur-md sm:items-center sm:p-4 sm:backdrop-blur-xl"
              style={{ touchAction: 'pan-y' }}
            >
              <div className="pointer-events-auto flex h-full w-full max-w-4xl flex-col overflow-hidden border-red-500/25 bg-card shadow-[0_35px_80px_-30px_rgba(139,19,20,0.65)] sm:my-auto sm:h-auto sm:max-h-[min(85%,40rem)] sm:rounded-[1.5rem] sm:border sm:bg-card/90 sm:backdrop-blur-xl">
                {emptyState ?? (
                  <div className="p-4 sm:px-5 sm:py-5">
                    <p className="text-sm font-medium text-foreground">Build your agent workflow</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add agents from the Library tab, or use{' '}
                      <span className="font-medium text-red-600 dark:text-red-300">Generate</span>{' '}
                      in the header to draft a full workflow from a prompt.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(diagram.nodes.length > 0 || hideEmptyState) && (
            <div className="absolute bottom-3 left-3 z-20 flex gap-1.5">
              <Button variant="secondary" size="sm" className="h-8 shadow-md" onClick={onAutoLayout}>
                <LayoutGrid className="h-3.5 w-3.5" />
                Auto-layout
              </Button>
              <Button variant="secondary" size="sm" className="h-8 shadow-md" onClick={fitView}>
                <Maximize2 className="h-3.5 w-3.5" />
                Fit
              </Button>
            </div>
          )}

          {hasAgents && executionPanelOpen && onBackToDesign && (
            <div className="absolute right-3 top-3 z-20">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 gap-1.5 px-4 text-xs shadow-md"
                onClick={onBackToDesign}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Back to design
              </Button>
            </div>
          )}

          {hasAgents && !executionPanelOpen && onOpenExecution && (
            <div className="absolute right-3 top-3 z-20">
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 bg-emerald-600 px-4 text-xs text-white shadow-md hover:bg-emerald-700"
                onClick={onOpenExecution}
              >
                <Play className="h-3.5 w-3.5" />
                Execute
              </Button>
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
          />
        </div>
      </DevProfiler>
    )
  }),
)
