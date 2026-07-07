import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
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
  bestPortSidesForConnection,
  buildEdgePath,
  nodeRouteObstacle,
  portPoint,
  type Diagram,
  type DiagramEdge,
  type PortSide,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { WorkflowRunState } from '@/types/agent-workflow'
import { zoomViewportAt } from '@/components/designer/viewport-utils'
import type { Viewport } from '@/components/designer/diagram-types'

interface ExecutionFlowCanvasProps {
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  runState: WorkflowRunState
  workflowName: string
  workflowDescription?: string
  onDiagramChange?: (updater: (diagram: Diagram) => Diagram) => void
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
}: ExecutionFlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<CanvasSession | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const [dragPositions, setDragPositions] = useState<Map<string, { x: number; y: number }> | null>(
    null,
  )
  const [isPanning, setIsPanning] = useState(false)
  const [isDraggingNode, setIsDraggingNode] = useState(false)

  const scale = viewport.scale

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
    containerRef.current?.setPointerCapture(event.pointerId)
    sessionRef.current = {
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    }
    setIsPanning(true)
    document.body.style.userSelect = 'none'
  }, [viewport.x, viewport.y])

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
      const rect = element.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08
      setViewport((previous) => zoomViewportAt(previous, factor, cursorX, cursorY))
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
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

  const layoutResetKey = useMemo(
    () => orderedAgents.map((node) => node.id).join(','),
    [orderedAgents],
  )

  useLayoutEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setViewport((previous) => ({
      scale: previous.scale,
      ...centerViewport(bounds, rect.width, rect.height, previous.scale),
    }))
  }, [layoutResetKey, bounds.width, bounds.height])

  const renderedEdges = useMemo(() => {
    return displayEdges.flatMap((edge) => {
      const fromNode = diagram.nodes.find((node) => node.id === edge.from)
      const toNode = diagram.nodes.find((node) => node.id === edge.to)
      if (!fromNode || !toNode) return []

      const fromPos = nodePosition(fromNode)
      const toPos = nodePosition(toNode)
      const fromWithPos = { ...fromNode, x: fromPos.x, y: fromPos.y }
      const toWithPos = { ...toNode, x: toPos.x, y: toPos.y }

      const sides =
        edge.fromSide && edge.toSide
          ? { fromSide: edge.fromSide as PortSide, toSide: edge.toSide as PortSide }
          : bestPortSidesForConnection(fromWithPos, AGENT_SHAPE, toWithPos, AGENT_SHAPE, {
              obstacles: routeObstacles,
              fromNodeId: edge.from,
              toNodeId: edge.to,
            })

      const fromPoint = portPoint(fromWithPos, AGENT_SHAPE, sides.fromSide)
      const toPoint = portPoint(toWithPos, AGENT_SHAPE, sides.toSide)
      const routing = edge.routing ?? 'orthogonal'
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
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--canvas))]">
      <div
        ref={containerRef}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
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
          />
        </div>

        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
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
                    strokeDasharray={style.dash}
                    strokeOpacity={style.opacity}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={`url(#exec-arrow-${style.marker})`}
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
                  humanApproval={planStep?.humanApproval}
                  approvalRole={planStep?.approvalRole}
                  isRunning={isRunning}
                  isCompleted={isCompleted}
                  isWaiting={isWaiting}
                  isPending={isPending}
                  output={runState.stepOutputs[node.id]}
                />
              </div>
            )
          })}
        </div>
      </div>

      {runState.status === 'idle' && agentNodes.length > 0 && !isDraggingNode && !isPanning && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2">
          <p className="rounded-lg border border-border bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
            Drag canvas to pan · Scroll to zoom · Drag nodes to rearrange
          </p>
          <p className="rounded-lg border border-border bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
            Press Execute to run this workflow
          </p>
        </div>
      )}
    </div>
  )
})
