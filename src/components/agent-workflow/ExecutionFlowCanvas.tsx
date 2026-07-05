import { memo, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
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

interface ExecutionFlowCanvasProps {
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  runState: WorkflowRunState
  workflowName: string
  workflowDescription?: string
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

function agentBounds(node: Diagram['nodes'][number]) {
  const size = agentNodeSize(node)
  return {
    x: node.x,
    y: node.y,
    width: size.width,
    height: size.height,
  }
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
}: ExecutionFlowCanvasProps) {
  const [scale, setScale] = useState(1)

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
      const box = agentBounds(node)
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
  }, [agentNodes])

  const renderedEdges = useMemo(() => {
    return displayEdges.flatMap((edge) => {
      const fromNode = diagram.nodes.find((node) => node.id === edge.from)
      const toNode = diagram.nodes.find((node) => node.id === edge.to)
      if (!fromNode || !toNode) return []

      const sides =
        edge.fromSide && edge.toSide
          ? { fromSide: edge.fromSide as PortSide, toSide: edge.toSide as PortSide }
          : bestPortSidesForConnection(fromNode, AGENT_SHAPE, toNode, AGENT_SHAPE, {
              obstacles: routeObstacles,
              fromNodeId: edge.from,
              toNodeId: edge.to,
            })

      const fromPoint = portPoint(fromNode, AGENT_SHAPE, sides.fromSide)
      const toPoint = portPoint(toNode, AGENT_SHAPE, sides.toSide)
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
  }, [diagram.nodes, displayEdges, routeObstacles, runState])

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--canvas))]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, hsl(var(--canvas-grid)) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-md">
        <p className="text-sm font-semibold text-foreground">{workflowName}</p>
        {workflowDescription && (
          <p className="mt-0.5 text-xs text-muted-foreground">{workflowDescription}</p>
        )}
      </div>

      <div className="absolute bottom-4 left-4 z-10">
        <CanvasZoomControls
          scale={scale}
          onZoomIn={() => setScale((previous) => Math.min(1.6, previous + 0.1))}
          onZoomOut={() => setScale((previous) => Math.max(0.5, previous - 0.1))}
        />
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-auto p-10">
        <div
          className="relative origin-center transition-transform duration-200"
          style={{
            width: bounds.width,
            height: bounds.height,
            minWidth: bounds.width,
            transform: `scale(${scale})`,
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
            const box = agentBounds(node)
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
                className="absolute z-10"
                style={{
                  left: box.x - bounds.minX,
                  top: box.y - bounds.minY,
                  width: AGENT_NODE_WIDTH,
                  minHeight: AGENT_NODE_HEIGHT,
                }}
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

      {runState.status === 'idle' && agentNodes.length > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-16">
          <p className="rounded-lg border border-border bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
            Press Execute to run this workflow
          </p>
        </div>
      )}
    </div>
  )
})
