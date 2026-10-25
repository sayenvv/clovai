import { memo } from 'react'
import { Wrench } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import {
  AGENT_NODE_HEIGHT,
  resolveAgentType,
  resolveExternalAgent,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { AgentNodeAvatar } from '@/components/agent-workflow/external-agent-ui'
import { NODE_SURFACE } from '@/components/agent-workflow/node-surface'
import { resolveFlowDirection, type DiagramNode, type FlowDirection } from '@/components/designer/diagram-types'

const TYPE_LABELS: Record<string, string> = {
  agent: 'Agent',
  llm: 'Agent',
  specialist: 'Agent',
  tool: 'Tool Agent',
  planner: 'Planner',
  human: 'Human Review',
  router: 'Router',
  trigger: 'Trigger',
  memory: 'Memory',
  output: 'Output',
  control: 'Control',
  executor: 'Executor',
}

interface ExecutionAgentNodeProps {
  node: DiagramNode
  stepIndex: number
  totalSteps: number
  toolCount: number
  isRunning: boolean
  isCompleted: boolean
  isWaiting: boolean
  isPending: boolean
  /** Vertical flow: compact card sized to the routing box, ports top / bottom. */
  direction?: FlowDirection
}

export const ExecutionAgentNode = memo(function ExecutionAgentNode({
  node,
  stepIndex,
  totalSteps,
  toolCount,
  isRunning,
  isCompleted,
  isWaiting,
  isPending,
  direction,
}: ExecutionAgentNodeProps) {
  const vertical = resolveFlowDirection(direction) === 'vertical'
  const agent = node.agent
  const externalAgent = resolveExternalAgent(node.paletteId)
  const typeLabel = externalAgent
    ? `${externalAgent.provider} · ${TYPE_LABELS[agent?.agentType ?? resolveAgentType(node.paletteId)] ?? 'Agent'}`
    : (TYPE_LABELS[agent?.agentType ?? resolveAgentType(node.paletteId)] ?? 'Agent')
  const statusLabel = isRunning
    ? 'Running'
    : isWaiting
      ? 'Paused'
      : isCompleted
        ? 'Completed'
        : 'Ready'

  const executionState = isRunning
    ? 'running'
    : isWaiting
      ? 'waiting'
      : isCompleted
        ? 'completed'
        : 'idle'

  return (
    <div
      className={cn(
        'relative flex w-full flex-col overflow-hidden rounded-xl text-card-foreground',
        NODE_SURFACE,
        vertical && 'h-full',
        isRunning && 'border-foreground/60 ring-[3px] ring-foreground/15 dark:border-white/50 dark:ring-white/15',
        isWaiting && 'border-amber-500/60 ring-[3px] ring-amber-500/15 dark:border-amber-500/60',
        isCompleted && !isRunning && 'border-emerald-500/50 dark:border-emerald-500/40',
      )}
    >
      {/* State rail — the node's status readable at any zoom level; it sweeps while running. */}
      <span
        className={cn(
          'absolute inset-x-0 top-0 h-[2px] overflow-hidden transition-colors duration-300',
          isWaiting ? 'bg-amber-500' : isCompleted && !isRunning ? 'bg-emerald-500' : 'bg-transparent',
        )}
        aria-hidden
      >
        {isRunning ? <span className="absolute inset-y-0 w-1/3 animate-[node-sweep_1.4s_ease-in-out_infinite] bg-foreground" /> : null}
      </span>

      {/* Port dots sit at the routing box midpoint so they meet the drawn edges. */}
      {vertical ? (
        <>
          <span className="absolute left-1/2 top-0 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background" />
          <span className="absolute bottom-0 left-1/2 z-10 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full border border-border bg-background" />
        </>
      ) : (
        <>
          <span
            className="absolute left-0 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background"
            style={{ top: AGENT_NODE_HEIGHT / 2 }}
          />
          <span
            className="absolute right-0 z-10 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background"
            style={{ top: AGENT_NODE_HEIGHT / 2 }}
          />
        </>
      )}

      <div
        className={cn(
          'flex items-start gap-2.5 px-3 pb-2.5 pt-3',
          vertical ? 'flex-1 items-center' : 'border-b border-border/60',
        )}
      >
        <AgentNodeAvatar
          paletteId={node.paletteId}
          size="md"
          executionState={executionState}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-border/60 bg-background px-1.5 py-px font-mono text-[10px] tabular-nums text-muted-foreground">
              {stepIndex}/{totalSteps}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'h-4 border-0 px-1.5 text-[9px] font-semibold uppercase tracking-wide',
                isRunning && 'bg-foreground/10 text-foreground',
                isCompleted && !isRunning && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
                isWaiting && 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
                isPending && 'bg-muted text-muted-foreground',
              )}
            >
              {statusLabel}
            </Badge>
            {vertical ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <Wrench className="h-3 w-3" />
                {toolCount}
              </span>
            ) : null}
            {agent?.humanInTheLoop ? (
              <Badge
                variant="outline"
                className="h-4 border-amber-500/30 bg-amber-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
              >
                HITL
              </Badge>
            ) : null}
          </div>
          <p
            className="mt-1.5 truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-card-foreground"
            title={node.label}
          >
            {node.label}
          </p>
          <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {typeLabel}
          </p>
        </div>
      </div>

      {!vertical && (
        <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
            {agent?.description || 'Agent step in the workflow execution graph.'}
          </p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Wrench className="h-3 w-3" />
              {toolCount} tool{toolCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
