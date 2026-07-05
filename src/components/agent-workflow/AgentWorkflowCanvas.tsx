import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { LayoutGrid, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DesignerCanvas } from '@/components/designer/DesignerCanvas'
import { computeCenteredViewport, zoomViewportAt } from '@/components/designer/viewport-utils'
import type { Diagram, DiagramNode, Viewport } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { Selection } from '@/components/designer/selection-utils'
import { canvasInsertAnchor } from '@/components/agent-workflow/hooks/use-sub-workflow-actions'
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
}

/** Canvas + viewport isolated so pan/zoom does not re-render sidebars or chrome. */
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
      finalizeDroppedNode,
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

    return (
      <DevProfiler id="AgentWorkflowCanvas">
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
            <Button variant="secondary" size="sm" className="h-8 shadow-md" onClick={onAutoLayout}>
              <LayoutGrid className="h-3.5 w-3.5" />
              Auto-layout
            </Button>
            <Button variant="secondary" size="sm" className="h-8 shadow-md" onClick={fitView}>
              <Maximize2 className="h-3.5 w-3.5" />
              Fit
            </Button>
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
            agentMode
            transformDroppedNode={transformDroppedNode}
            finalizeDroppedNode={finalizeDroppedNode}
          />
        </div>
      </DevProfiler>
    )
  }),
)
