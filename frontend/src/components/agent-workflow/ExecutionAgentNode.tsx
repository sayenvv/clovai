import { memo } from 'react'
import { Wrench } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import {
  isExternalAgentPalette,
  resolveAgentType,
  resolveExternalAgent,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { AgentNodeAvatar } from '@/components/agent-workflow/external-agent-ui'
import type { DiagramNode } from '@/components/designer/diagram-types'

const TYPE_LABELS: Record<string, string> = {
  llm: 'LLM Agent',
  specialist: 'Specialist',
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
}: ExecutionAgentNodeProps) {
  const agent = node.agent
  const externalAgent = resolveExternalAgent(node.paletteId)
  const isExternal = isExternalAgentPalette(node.paletteId)
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
        'relative flex w-[260px] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow] duration-300',
        isRunning && 'border-red-600 ring-2 ring-red-500/35 shadow-lg shadow-red-500/20',
        isWaiting && 'border-amber-500/50 ring-1 ring-amber-500/25',
        isCompleted && !isRunning && 'border-emerald-500/40 ring-1 ring-emerald-500/15',
        isPending && !isCompleted && !isRunning && !isExternal && 'border-border/80',
        isPending && !isCompleted && !isRunning && isExternal && 'border-amber-500/25',
      )}
    >
      <span className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-muted" />
      <span className="absolute right-0 top-1/2 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-muted" />

      <div
        className={cn(
          'flex items-start gap-2.5 border-b border-border/60 px-3 py-2.5',
          isExternal
            ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/5'
            : 'bg-gradient-to-r from-red-500/10 to-blue-500/5',
        )}
      >
        <AgentNodeAvatar
          paletteId={node.paletteId}
          size="md"
          executionState={executionState}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {stepIndex}/{totalSteps}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'h-4 border-0 px-1.5 text-[9px] font-medium uppercase tracking-wide',
                isRunning && 'bg-red-500/15 text-red-700 dark:text-red-300',
                isCompleted && !isRunning && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                isWaiting && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                isPending && 'bg-muted text-muted-foreground',
              )}
            >
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-1 truncate font-mono text-sm font-semibold tracking-tight text-foreground">
            {node.label}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {typeLabel}
          </p>
        </div>
      </div>

      <div className="flex min-h-[72px] flex-1 flex-col gap-2 px-3 py-2">
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {agent?.description || 'Agent step in the workflow execution graph.'}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Wrench className="h-3 w-3" />
            {toolCount} tool{toolCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
})
