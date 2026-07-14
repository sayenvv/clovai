import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { ExecutionAgentNode } from '@/components/agent-workflow/ExecutionAgentNode'
import { getExecutablePlan, getOrderedExecutionAgents } from '@/components/agent-workflow/build-execution-plan'
import {
  AGENT_NODE_HEIGHT,
  AGENT_NODE_WIDTH,
} from '@/components/agent-workflow/agent-workflow-defaults'
import {
  agentNodeSize,
  isAgentNode,
  listToolsForAgent,
} from '@/components/agent-workflow/tool-agent-mapping'
import { edgeNeedsApprovalStyle } from '@/components/agent-workflow/validate-workflow'
import { CanvasZoomControls } from '@/components/designer/CanvasZoomControls'
import {
  buildEdgePath,
  nodeRouteObstacle,
  portPoint,
  resolveEdgeRouting,
  type Diagram,
  type DiagramEdge,
  type PortSide,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { WorkflowRunState } from '@/types/agent-workflow'
import {
  fitViewportToBounds,
  fitViewportToNode,
  zoomViewportAt,
} from '@/components/designer/viewport-utils'
import type { Viewport } from '@/components/designer/diagram-types'

interface ExecutionFlowCanvasProps {
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  runState: WorkflowRunState
  workflowName: string
  workflowDescription?: string
  onDiagramChange?: (updater: (diagram: Diagram) => Diagram) => void
  onBackToDesign?: () => void
}

type NodeDragSession = {
  type: 'node'
  nodeId: string
  startClientX: number
  startClientY: number
  originX: number
  originY: number
}

type PanSession = {
  type: 'pan'
  startX: number
  startY: number
  originX: number
  originY: number
}

type CanvasSession = NodeDragSession | PanSession

const EXECUTION_FOLLOW_DURATION_S = 0.8
const EXECUTION_COMPLETE_FIT_DURATION_S = 1

function resolveFollowNodeId(runState: WorkflowRunState): string | null {
  if (runState.status === 'idle' || runState.status === 'cancelled') return null
  if (runState.activeNodeId) return runState.activeNodeId
  if (runState.status === 'waiting-approval') {
    return runState.trace.find((step) => step.status === 'waiting-approval')?.nodeId ?? null
  }
  return null
}

function centerViewport(
  bounds: { width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
): Pick<Viewport, 'x' | 'y'> {
  return {
    x: (canvasWidth - bounds.width * scale) / 2,
    y: (canvasHeight - bounds.height * scale) / 2,
  }
}

const AGENT_SHAPE = 'process' as const

/** Theme-aware SVG stroke colors — idle connectors are grey; active uses primary. */
const EDGE_COLORS = {
  active: 'hsl(var(--primary))',
  completed: 'hsl(142 71% 45%)',
  approval: 'hsl(var(--muted-foreground) / 0.7)',
  inferred: 'hsl(var(--muted-foreground) / 0.45)',
  idle: 'hsl(var(--muted-foreground) / 0.55)',
} as const

type DisplayEdge = DiagramEdge & { inferred?: boolean }

type EdgeRenderStyle = {
  stroke: string
  width: number
  dash?: string
  opacity: number
  marker: 'default' | 'active' | 'done'
}

function resolveDisplayEdges(diagram: Diagram): DisplayEdge[] {
  const agentIds = new Set(diagram.nodes.filter(isAgentNode).map((node) => node.id))
  const real = diagram.edges.filter((edge) => agentIds.has(edge.from) && agentIds.has(edge.to))
  if (real.length > 0) return real

  const plan = getExecutablePlan(diagram)
  return plan.slice(0, -1).map((step, index) => ({
    id: `inferred-${step.nodeId}-${plan[index + 1].nodeId}`,
    from: step.nodeId,
    to: plan[index + 1].nodeId,
    fromSide: 'right' as const,
    toSide: 'left' as const,
    inferred: true,
  }))
}

function edgeStyle(edge: DisplayEdge, runState: WorkflowRunState): EdgeRenderStyle {
  const isActive = runState.activeEdgeId === edge.id
  const isCompleted =
    runState.completedNodeIds.includes(edge.from) &&
    (runState.completedNodeIds.includes(edge.to) || runState.activeNodeId === edge.to)
  const approval = !edge.inferred && edgeNeedsApprovalStyle(edge)

  if (isActive) {
    return { stroke: EDGE_COLORS.active, width: 2.5, opacity: 1, marker: 'active' }
  }
  if (isCompleted) {
    return { stroke: EDGE_COLORS.completed, width: 2, opacity: 0.95, marker: 'done' }
  }
  if (approval) {
    return {
      stroke: EDGE_COLORS.approval,
      width: 1.75,
      dash: '6 4',
      opacity: 0.9,
      marker: 'default',
    }
  }
  if (edge.inferred) {
    return {
      stroke: EDGE_COLORS.inferred,
      width: 1.5,
      dash: '4 4',
      opacity: 0.55,
      marker: 'default',
    }
  }
  return { stroke: EDGE_COLORS.idle, width: 2, opacity: 0.75, marker: 'default' }
}

export const ExecutionFlowCanvas = memo(function ExecutionFlowCanvas({
  diagram,
  runState,
  workflowName,
  workflowDescription,
  onDiagramChange,
  onBackToDesign,
}: ExecutionFlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<CanvasSession | null>(null)
  const lastFollowKeyRef = useRef<string | null>(null)
  const completedFitRef = useRef(false)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [dragPositions, setDragPositions] = useState<Map<string, { x: number; y: number }> | null>(
    null,
  )
  const [isPanning, setIsPanning] = useState(false)
  const [isDraggingNode, setIsDraggingNode] = useState(false)
  const [cameraAnimating, setCameraAnimating] = useState(false)

  const scale = viewport.scale
  const isActive = runState.status === 'running' || runState.status === 'waiting-approval'
  const showBackToDesign = Boolean(onBackToDesign) && !isActive

  const commitNodePosition = useCallback(
    (nodeId: string, x: number, y: number) => {
      onDiagramChange?.((previous) => ({
        ...previous,
        nodes: previous.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
      }))
    },
    [onDiagramChange],
  )

  const handleBackgroundPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.button !== 0) return
    setCameraAnimating(false)
    sessionRef.current = null
    setIsPanning(false)
  }, [])

  const handleNodePointerDown = useCallback(
    (event: ReactPointerEvent, node: Diagram['nodes'][number]) => {
      if (event.button !== 0 || !onDiagramChange) return
      event.stopPropagation()
      containerRef.current?.setPointerCapture(event.pointerId)
      sessionRef.current = {
        type: 'node',
        nodeId: node.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: node.x,
        originY: node.y,
      }
      setIsDraggingNode(true)
      document.body.style.userSelect = 'none'
    },
    [onDiagramChange],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const session = sessionRef.current
      if (!session) return

      if (session.type === 'pan') {
        const dx = event.clientX - session.startX
        const dy = event.clientY - session.startY
        setViewport((previous) => ({
          ...previous,
          x: session.originX + dx,
          y: session.originY + dy,
        }))
        return
      }

      const dx = (event.clientX - session.startClientX) / scale
      const dy = (event.clientY - session.startClientY) / scale
      setDragPositions(
        new Map([[session.nodeId, { x: session.originX + dx, y: session.originY + dy }]]),
      )
    },
    [scale],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const session = sessionRef.current
      if (!session) return

      if (session.type === 'node') {
        const dx = (event.clientX - session.startClientX) / scale
        const dy = (event.clientY - session.startClientY) / scale
        commitNodePosition(session.nodeId, session.originX + dx, session.originY + dy)
        setIsDraggingNode(false)
      } else {
        setIsPanning(false)
      }

      sessionRef.current = null
      setDragPositions(null)
      document.body.style.userSelect = ''
    },
    [commitNodePosition, scale],
  )

  const zoomBy = useCallback((factor: number) => {
    setViewport((previous) => {
      const rect = containerRef.current?.getBoundingClientRect()
      return zoomViewportAt(
        previous,
        factor,
        rect ? rect.width / 2 : 0,
        rect ? rect.height / 2 : 0,
      )
    })
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setCameraAnimating(false)

      // Pinch / ctrl+scroll — do not zoom; use toolbar buttons.
      if (event.ctrlKey || event.metaKey) return

      const lineHeight = 16
      const pageHeight = element.clientHeight
      const multiplier =
        event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? pageHeight : 1
      const dx = event.deltaX * multiplier
      const dy = event.deltaY * multiplier
      if (dx === 0 && dy === 0) return

      setViewport((previous) => ({
        ...previous,
        x: previous.x - dx,
        y: previous.y - dy,
      }))
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

  const nodePosition = useCallback(
    (node: Diagram['nodes'][number]) => {
      const override = dragPositions?.get(node.id)
      return override ?? { x: node.x, y: node.y }
    },
    [dragPositions],
  )

  const executionPlan = useMemo(() => getExecutablePlan(diagram), [diagram])
  const planByNodeId = useMemo(() => {
    const map = new Map<string, (typeof executionPlan)[number]>()
    executionPlan.forEach((step) => map.set(step.nodeId, step))
    return map
  }, [executionPlan])

  const orderedAgents = useMemo(() => getOrderedExecutionAgents(diagram), [diagram])
  const totalSteps = orderedAgents.length
  const stepIndexByNodeId = useMemo(() => {
    const map = new Map<string, number>()
    orderedAgents.forEach((node, index) => map.set(node.id, index + 1))
    return map
  }, [orderedAgents])

  const agentNodes = orderedAgents

  const displayEdges = useMemo(() => resolveDisplayEdges(diagram), [diagram])

  const routeObstacles = useMemo(
    () => agentNodes.map((node) => nodeRouteObstacle(node, AGENT_SHAPE)),
    [agentNodes],
  )

  const bounds = useMemo(() => {
    if (agentNodes.length === 0) return { minX: 0, minY: 0, width: 800, height: 420 }
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const node of agentNodes) {
      const pos = nodePosition(node)
      const box = { x: pos.x, y: pos.y, ...agentNodeSize(node) }
      minX = Math.min(minX, box.x)
      minY = Math.min(minY, box.y)
      maxX = Math.max(maxX, box.x + box.width)
      maxY = Math.max(maxY, box.y + box.height)
    }
    const pad = 80
    return {
      minX: minX - pad,
      minY: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    }
  }, [agentNodes, nodePosition])

  const followNodeId = useMemo(() => resolveFollowNodeId(runState), [
    runState.activeNodeId,
    runState.status,
    runState.trace,
  ])

  const followKey = useMemo(() => {
    if (!followNodeId) return null
    return `${followNodeId}:${runState.currentStepIndex}:${runState.status}`
  }, [followNodeId, runState.currentStepIndex, runState.status])

  const focusNodeInViewport = useCallback(
    (nodeId: string) => {
      const container = containerRef.current
      const node = diagram.nodes.find((candidate) => candidate.id === nodeId)
      if (!container || !node) return

      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const pos = nodePosition(node)
      const size = agentNodeSize(node)
      setViewport(
        fitViewportToNode(
          pos.x,
          pos.y,
          size.width,
          size.height,
          bounds.minX,
          bounds.minY,
          rect.width,
          rect.height,
          { padding: 0.3, minZoom: 0.8, maxZoom: 1.5 },
        ),
      )
    },
    [bounds.minX, bounds.minY, diagram.nodes, nodePosition],
  )

  const focusWorkflowInViewport = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    setViewport(
      fitViewportToBounds(bounds, rect.width, rect.height, { padding: 0.2, maxZoom: 1.5 }),
    )
  }, [bounds.height, bounds.width])

  const isExecutionActive =
    runState.status === 'running' || runState.status === 'waiting-approval'

  useEffect(() => {
    if (!followKey || isPanning || isDraggingNode || !isExecutionActive) return
    if (lastFollowKeyRef.current === followKey) return
    lastFollowKeyRef.current = followKey
    if (followNodeId) {
      setCameraAnimating(true)
      focusNodeInViewport(followNodeId)
    }
  }, [focusNodeInViewport, followKey, followNodeId, isDraggingNode, isExecutionActive, isPanning])

  useEffect(() => {
    if (runState.status === 'idle') {
      lastFollowKeyRef.current = null
      completedFitRef.current = false
      return
    }

    if (
      (runState.status === 'completed' || runState.status === 'failed') &&
      !completedFitRef.current
    ) {
      completedFitRef.current = true
      setCameraAnimating(true)
      focusWorkflowInViewport()
    }
  }, [focusWorkflowInViewport, runState.status])

  const layoutResetKey = useMemo(
    () => orderedAgents.map((node) => node.id).join(','),
    [orderedAgents],
  )

  useLayoutEffect(() => {
    if (runState.status !== 'idle') return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setViewport((previous) => ({
      scale: previous.scale,
      ...centerViewport(bounds, rect.width, rect.height, previous.scale),
    }))
  }, [layoutResetKey, bounds.width, bounds.height, runState.status])

  const renderedEdges = useMemo(() => {
    return displayEdges.flatMap((edge) => {
      const fromNode = diagram.nodes.find((node) => node.id === edge.from)
      const toNode = diagram.nodes.find((node) => node.id === edge.to)
      if (!fromNode || !toNode) return []

      const fromPos = nodePosition(fromNode)
      const toPos = nodePosition(toNode)
      const fromWithPos = { ...fromNode, x: fromPos.x, y: fromPos.y }
      const toWithPos = { ...toNode, x: toPos.x, y: toPos.y }

      const sides = {
        fromSide: (edge.fromSide ?? 'right') as PortSide,
        toSide: (edge.toSide ?? 'left') as PortSide,
      }

      const fromPoint = portPoint(fromWithPos, AGENT_SHAPE, sides.fromSide)
      const toPoint = portPoint(toWithPos, AGENT_SHAPE, sides.toSide)
      const routing = resolveEdgeRouting(edge.routing)
      const path = buildEdgePath(
        fromPoint,
        sides.fromSide,
        toPoint,
        sides.toSide,
        routing,
        { obstacles: routeObstacles, fromNodeId: edge.from, toNodeId: edge.to },
      )

      const style = edgeStyle(edge, runState)
      return [{
        edge,
        path,
        style,
        isActive: runState.activeEdgeId === edge.id,
      }]
    })
  }, [diagram.nodes, displayEdges, routeObstacles, runState, nodePosition])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--canvas))]">
      {showBackToDesign && (
        <div className="pointer-events-none absolute right-3 top-3 z-30">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="pointer-events-auto h-9 gap-1.5 px-4 text-xs shadow-md"
            onClick={onBackToDesign}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Back to design
          </Button>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden',
          isDraggingNode ? 'cursor-grabbing' : 'cursor-default',
        )}
        style={{
          backgroundImage:
            'radial-gradient(circle, hsl(var(--canvas-grid)) 1px, transparent 1px)',
          backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="application"
        aria-label="Execution flow canvas"
      >
        <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-md">
          <p className="text-sm font-semibold text-foreground">{workflowName}</p>
          {workflowDescription && (
            <p className="mt-0.5 text-xs text-muted-foreground">{workflowDescription}</p>
          )}
        </div>

        <div
          className="pointer-events-auto absolute bottom-4 right-4 z-20"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CanvasZoomControls
            scale={scale}
            onZoomIn={() => zoomBy(1.2)}
            onZoomOut={() => zoomBy(1 / 1.2)}
            onFitToScreen={focusWorkflowInViewport}
          />
        </div>

        <motion.div
          className="absolute left-0 top-0"
          animate={{ x: viewport.x, y: viewport.y, scale: viewport.scale }}
          transition={
            isPanning || isDraggingNode || !cameraAnimating
              ? { duration: 0 }
              : {
                  duration:
                    runState.status === 'completed' || runState.status === 'failed'
                      ? EXECUTION_COMPLETE_FIT_DURATION_S
                      : EXECUTION_FOLLOW_DURATION_S,
                  ease: [0.25, 0.1, 0.25, 1],
                }
          }
          onAnimationComplete={() => setCameraAnimating(false)}
          style={{
            transformOrigin: '0 0',
            width: bounds.width,
            height: bounds.height,
          }}
        >
          <svg
            className="pointer-events-none absolute inset-0 z-0 overflow-visible"
            width={bounds.width}
            height={bounds.height}
          >
            <defs>
              <marker
                id="exec-arrow-default"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 Z" fill={EDGE_COLORS.idle} />
              </marker>
              <marker
                id="exec-arrow-active"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 Z" fill={EDGE_COLORS.active} />
              </marker>
              <marker
                id="exec-arrow-done"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 Z" fill={EDGE_COLORS.completed} />
              </marker>
            </defs>
            <g transform={`translate(${-bounds.minX}, ${-bounds.minY})`}>
              {renderedEdges.map(({ edge, path, style, isActive }) => (
                <g key={edge.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    strokeDasharray={isActive ? '5 5' : style.dash}
                    strokeOpacity={style.opacity}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={`url(#exec-arrow-${style.marker})`}
                    className={isActive ? 'execution-edge-active' : undefined}
                  />
                  {isActive && (
                    <motion.path
                      d={path}
                      fill="none"
                      stroke={EDGE_COLORS.active}
                      strokeWidth={4}
                      strokeOpacity={0.3}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </g>
              ))}
            </g>
          </svg>

          {agentNodes.map((node) => {
            const pos = nodePosition(node)
            const box = { x: pos.x, y: pos.y, ...agentNodeSize(node) }
            const stepIndex = stepIndexByNodeId.get(node.id) ?? 1
            const planStep = planByNodeId.get(node.id)
            const toolCount = planStep?.tools.length ?? listToolsForAgent(diagram, node.id).length
            const isRunning = runState.activeNodeId === node.id
            const isCompleted = runState.completedNodeIds.includes(node.id)
            const isWaiting =
              runState.status === 'waiting-approval' &&
              runState.trace.find((step) => step.nodeId === node.id)?.status ===
                'waiting-approval'
            const isPending =
              runState.status === 'idle' ||
              (!isRunning && !isCompleted && !isWaiting)

            return (
              <div
                key={node.id}
                className={cn(
                  'absolute z-10 select-none',
                  onDiagramChange && !isPanning && 'cursor-grab active:cursor-grabbing',
                )}
                style={{
                  left: box.x - bounds.minX,
                  top: box.y - bounds.minY,
                  width: AGENT_NODE_WIDTH,
                  minHeight: AGENT_NODE_HEIGHT,
                }}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
              >
                <ExecutionAgentNode
                  node={node}
                  stepIndex={stepIndex}
                  totalSteps={totalSteps}
                  toolCount={toolCount}
                  isRunning={isRunning}
                  isCompleted={isCompleted}
                  isWaiting={isWaiting}
                  isPending={isPending}
                />
              </div>
            )
          })}
        </motion.div>

        <style>{`
          .execution-edge-active {
            animation: execution-edge-dash 1s linear infinite;
          }
          @keyframes execution-edge-dash {
            0% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -10; }
          }
        `}</style>
      </div>

      {runState.status === 'idle' && agentNodes.length > 0 && !isDraggingNode && !isPanning && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2">
          <p className="rounded-lg border border-border bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
            Scroll to pan · use zoom controls to scale · drag nodes to rearrange
          </p>
          <p className="rounded-lg border border-border bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
            Press Execute to run this workflow
          </p>
        </div>
      )}
    </div>
  )
})
