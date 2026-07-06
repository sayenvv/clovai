import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  UserCheck,
  Wrench,
} from 'lucide-react'
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
}

interface ExecutionAgentNodeProps {
  node: DiagramNode
  stepIndex: number
  totalSteps: number
  toolCount: number
  humanApproval?: boolean
  approvalRole?: string
  isRunning: boolean
  isCompleted: boolean
  isWaiting: boolean
  isPending: boolean
  output?: string
}

export const ExecutionAgentNode = memo(function ExecutionAgentNode({
  node,
  stepIndex,
  totalSteps,
  toolCount,
  humanApproval,
  approvalRole,
  isRunning,
  isCompleted,
  isWaiting,
  isPending,
  output,
}: ExecutionAgentNodeProps) {
  const agent = node.agent
  const externalAgent = resolveExternalAgent(node.paletteId)
  const isExternal = isExternalAgentPalette(node.paletteId)
  const typeLabel = externalAgent
    ? `${externalAgent.provider} · ${TYPE_LABELS[agent?.agentType ?? resolveAgentType(node.paletteId)] ?? 'Agent'}`
    : (TYPE_LABELS[agent?.agentType ?? resolveAgentType(node.paletteId)] ?? 'Agent')
  const showOutput = isCompleted && output

  const statusLabel = isRunning
    ? 'Running'
    : isWaiting
      ? 'Awaiting approval'
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
    <motion.div
      layout
      className={cn(
        'relative flex w-[260px] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm',
        isRunning && 'border-primary ring-2 ring-primary/25 shadow-md',
        isWaiting && 'border-amber-500/50 ring-1 ring-amber-500/25',
        isCompleted && !isRunning && 'border-emerald-500/40 ring-1 ring-emerald-500/15',
        isPending && !isCompleted && !isRunning && !isExternal && 'border-border/80',
        isPending && !isCompleted && !isRunning && isExternal && 'border-amber-500/25',
      )}
      animate={isRunning ? { scale: [1, 1.008, 1] } : undefined}
      transition={isRunning ? { duration: 1.8, repeat: Infinity } : undefined}
    >
      <span className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-muted" />
      <span className="absolute right-0 top-1/2 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-muted" />

      <div
        className={cn(
          'flex items-start gap-2.5 border-b border-border/60 px-3 py-2.5',
          isExternal
            ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/5'
            : 'bg-gradient-to-r from-violet-500/10 to-blue-500/5',
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
                isRunning && 'bg-primary/10 text-primary',
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
          {humanApproval && (
            <Badge
              variant="outline"
              className="h-5 gap-1 border-border bg-muted/50 px-1.5 text-[9px] font-normal text-muted-foreground"
            >
              <UserCheck className="h-3 w-3" />
              Human{approvalRole ? ` · ${approvalRole}` : ''}
            </Badge>
          )}
        </div>
      </div>

      {showOutput && (
        <div className="border-t border-border/60 px-3 py-2">
          <details open className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              <ChevronDown className="h-3 w-3 group-open:hidden" />
              <ChevronUp className="hidden h-3 w-3 group-open:block" />
              Output
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-border bg-muted/50 p-2.5 font-mono text-[10px] leading-relaxed text-foreground">
              {output}
            </pre>
          </details>
        </div>
      )}

      {isRunning && (
        <div className="h-1 overflow-hidden bg-muted">
          <motion.div
            className="h-full bg-brand-gradient"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            style={{ width: '50%' }}
          />
        </div>
      )}
    </motion.div>
  )
})
