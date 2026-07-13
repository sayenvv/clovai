import { memo } from 'react'
import { Wrench } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import {
  isExternalAgentPalette,
  resolveExternalAgent,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { isSubWorkflowNode } from '@/components/agent-workflow/sub-workflow-ops'
import { AgentNodeAvatar } from '@/components/agent-workflow/external-agent-ui'
import { isExecutorNode, isMcpToolNode, isToolNode } from '@/components/agent-workflow/tool-agent-mapping'
import type { DiagramNode } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { AgentStatus } from '@/types/agent-workflow'

const STATUS_STYLES: Record<AgentStatus, { dot: string; label: string }> = {
  active: { dot: 'bg-emerald-500', label: 'Active' },
  inactive: { dot: 'bg-slate-400', label: 'Inactive' },
  draft: { dot: 'bg-amber-400', label: 'Draft' },
}

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

interface AgentNodeCardProps {
  node: DiagramNode
  item: PaletteItem
  isSelected: boolean
  isDark: boolean
  className?: string
  mappedUnderLabel?: string
  /** Canvas tool nodes mapped under this agent (agent cards only). */
  mappedToolCount?: number
}

export const AgentNodeCard = memo(function AgentNodeCard({
  node,
  item,
  isSelected,
  className,
  mappedUnderLabel,
  mappedToolCount = 0,
}: AgentNodeCardProps) {
  const agent = node.agent
  const status = agent?.status ?? 'draft'
  const statusStyle = STATUS_STYLES[status]
  const toolNode = isToolNode(node)
  const mcpTool = isMcpToolNode(node)
  const executorNode = isExecutorNode(node)
  const toolCount = toolNode ? (agent?.tools.length ?? 0) : mappedToolCount
  const externalAgent = resolveExternalAgent(node.paletteId)
  const subWorkflow = isSubWorkflowNode(node)
  const typeLabel = toolNode
    ? mcpTool
      ? 'MCP Tool'
      : 'Tool'
    : executorNode
      ? 'Executor'
      : subWorkflow
      ? 'Sub-workflow'
      : externalAgent
        ? `${externalAgent.provider} · ${TYPE_LABELS[agent?.agentType ?? 'llm'] ?? item.label}`
        : (TYPE_LABELS[agent?.agentType ?? 'llm'] ?? item.label)
  const isExternal = isExternalAgentPalette(node.paletteId)

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow',
        toolNode
          ? mcpTool
            ? isSelected
              ? 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
              : 'border-emerald-500/30 hover:border-emerald-400/50 hover:shadow'
            : isSelected
              ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md'
              : 'border-blue-500/30 hover:border-blue-400/50 hover:shadow'
          : executorNode
            ? isSelected
              ? 'border-orange-500 ring-2 ring-orange-500/30 shadow-md'
              : 'border-orange-500/35 hover:border-orange-400/50 hover:shadow'
            : isExternal
            ? isSelected
              ? 'border-amber-500/50 ring-2 ring-amber-500/20 shadow-md'
              : 'border-amber-500/25 hover:border-amber-400/40 hover:shadow'
            : subWorkflow
              ? isSelected
                ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                : 'border-indigo-500/35 hover:border-indigo-400/50 hover:shadow'
              : isSelected
                ? 'border-red-500 ring-2 ring-red-500/30 shadow-md'
                : 'border-border/80 hover:border-red-400/50 hover:shadow',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 border-b border-border/60 px-3 py-2',
          toolNode
            ? mcpTool
              ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/5'
              : 'bg-gradient-to-r from-blue-500/10 to-cyan-500/5'
            : executorNode
              ? 'bg-gradient-to-r from-orange-500/10 to-amber-500/5'
              : isExternal
                ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/5'
                : subWorkflow
                  ? 'bg-gradient-to-r from-indigo-500/10 to-red-500/5'
                  : 'bg-gradient-to-r from-red-500/10 to-blue-500/5',
        )}
      >
        <AgentNodeAvatar paletteId={node.paletteId} toolNode={toolNode} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{node.label}</p>
          <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {typeLabel}
          </p>
        </div>
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', statusStyle.dot)}
          title={statusStyle.label}
        />
      </div>

      <div className="flex min-h-[52px] flex-1 flex-col gap-2 px-3 py-2.5">
        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">
          {toolNode && mappedUnderLabel
            ? `Mapped under ${mappedUnderLabel}`
            : mcpTool && agent?.mcpUrl
              ? agent.mcpUrl.replace(/^https?:\/\//, '').slice(0, 48)
              : executorNode
                ? agent?.description || 'Deterministic code step in the workflow.'
                : subWorkflow
                  ? agent?.description || 'Nested workflow mounted as a single agent.'
                  : agent?.description || 'Configure in the properties panel.'}
        </p>
        <div className="mt-auto flex shrink-0 items-center justify-between gap-2 pt-0.5">
          <Badge
            variant="outline"
            className={cn(
              'h-5 px-1.5 text-[10px] font-normal',
              toolNode
                ? mcpTool
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                  : 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300'
                : executorNode
                  ? 'border-orange-500/30 bg-orange-500/5 text-orange-700 dark:text-orange-300'
                  : 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300',
            )}
          >
            {toolNode ? (mcpTool ? 'MCP' : 'Tool') : executorNode ? 'Executor' : statusStyle.label}
          </Badge>
          {toolNode ? (
            <span className="text-[10px] text-muted-foreground">
              {toolCount} integration{toolCount === 1 ? '' : 's'}
            </span>
          ) : executorNode ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="rounded bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] text-orange-700 dark:text-orange-300">
                {(agent?.executorHandlerKind ?? 'class') === 'function'
                  ? 'Single-step'
                  : 'Multi-handler'}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Wrench className="h-3 w-3" />
              {toolCount} tool{toolCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
