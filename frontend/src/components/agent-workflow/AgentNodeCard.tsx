import { memo, type MouseEvent, type PointerEvent } from 'react'
import { Bot, Boxes, Database, Plug, Plus, ShieldCheck, Sparkles, Terminal, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  childKindForPalette,
  isExternalAgentPalette,
  resolveExternalAgent,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { AgentNodeAvatar } from '@/components/agent-workflow/external-agent-ui'
import { isExecutorNode, isToolNode } from '@/components/agent-workflow/tool-agent-mapping'
import type { DiagramNode } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'

/** Dock / config actions from the agent card. */
export type AgentAttachAction =
  | 'model'
  | 'tool'
  | 'skill'
  | 'integration'
  | 'memory'
  | 'mcp'
  | 'knowledge'
  | 'config'

export interface MappedChildCounts {
  tool: number
  skill: number
  memory: number
  integration: number
  mcp: number
}

export type AgentDockSlot = {
  id: 'model' | 'memory' | 'tool' | 'knowledge'
  label: string
  action: AgentAttachAction
  required?: boolean
  /** Horizontal center as a fraction of node width (0–1) for map-line anchors. */
  x: number
}

/**
 * Bottom capability docks — diamonds on the edge, dangling `+` when empty.
 * Keep `x` in sync with DesignerCanvas mapping lines.
 */
export const AGENT_DOCK_SLOTS: AgentDockSlot[] = [
  { id: 'model', label: 'Chat Model', action: 'model', required: true, x: 0.14 },
  { id: 'memory', label: 'Memory', action: 'memory', x: 0.38 },
  { id: 'tool', label: 'Tool', action: 'tool', x: 0.62 },
  { id: 'knowledge', label: 'Knowledge', action: 'knowledge', x: 0.86 },
]

/** Space reserved visually under the card for labels / plus. */
export const AGENT_DOCK_HANG = 44

const TYPE_LABELS: Record<string, string> = {
  llm: 'AI Agent',
  specialist: 'Specialist',
  tool: 'Tool',
  planner: 'Planner',
  human: 'Human review',
  router: 'Router',
  trigger: 'Trigger',
  memory: 'Memory',
  output: 'Output',
  control: 'Control',
  executor: 'Executor',
}

function stopCanvas(event: MouseEvent | PointerEvent) {
  event.stopPropagation()
  event.preventDefault()
}

type ChildKind = 'tool' | 'mcp' | 'skill' | 'integration' | 'memory' | 'executor'

function resolveChildKind(node: DiagramNode, executorNode: boolean): ChildKind {
  if (executorNode) return 'executor'
  return childKindForPalette(node.paletteId) ?? 'tool'
}

/** One accent + icon per capability kind, so tool/mcp/skill/integration/memory/executor read apart at a glance. */
const CHILD_KIND_STYLES: Record<ChildKind, { label: string; icon: LucideIcon; rail: string; iconBg: string; iconRing: string }> = {
  tool: {
    label: 'Tool',
    icon: Wrench,
    rail: 'bg-sky-500/70',
    iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    iconRing: 'ring-sky-500/20',
  },
  mcp: {
    label: 'MCP',
    icon: Plug,
    rail: 'bg-emerald-500/70',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    iconRing: 'ring-emerald-500/20',
  },
  skill: {
    label: 'Skill',
    icon: Sparkles,
    rail: 'bg-violet-500/70',
    iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    iconRing: 'ring-violet-500/20',
  },
  integration: {
    label: 'Integration',
    icon: Boxes,
    rail: 'bg-amber-500/70',
    iconBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    iconRing: 'ring-amber-500/20',
  },
  memory: {
    label: 'Memory',
    icon: Database,
    rail: 'bg-indigo-500/70',
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
    iconRing: 'ring-indigo-500/20',
  },
  executor: {
    label: 'Executor',
    icon: Terminal,
    rail: 'bg-orange-500/70',
    iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
    iconRing: 'ring-orange-500/20',
  },
}

interface AgentNodeCardProps {
  node: DiagramNode
  item: PaletteItem
  isSelected: boolean
  isDark: boolean
  className?: string
  mappedUnderLabel?: string
  mappedChildren?: MappedChildCounts
  onAttachAction?: (agentId: string, action: AgentAttachAction) => void
}

export const AgentNodeCard = memo(function AgentNodeCard({
  node,
  item,
  isSelected,
  className,
  mappedUnderLabel,
  mappedChildren = { tool: 0, skill: 0, memory: 0, integration: 0, mcp: 0 },
  onAttachAction,
}: AgentNodeCardProps) {
  const agent = node.agent
  const toolNode = isToolNode(node)
  const executorNode = isExecutorNode(node)
  const externalAgent = resolveExternalAgent(node.paletteId)
  const title =
    node.label?.trim() ||
    (externalAgent ? externalAgent.label : TYPE_LABELS[agent?.agentType ?? 'llm'] ?? item.label)

  if (toolNode || executorNode) {
    const kind = resolveChildKind(node, executorNode)
    const kindStyle = CHILD_KIND_STYLES[kind]
    const KindIcon = kindStyle.icon

    return (
      <div
        className={cn(
          'relative flex h-full w-full items-center gap-2.5 overflow-hidden rounded-lg',
          'border border-border bg-card pl-3 pr-2.5 shadow-sm',
          'transition-[border-color,box-shadow,background-color] duration-150',
          'hover:border-foreground/20 hover:shadow',
          isSelected && 'border-primary/70 shadow-md ring-2 ring-primary/20',
          className,
        )}
        title={mappedUnderLabel ? `${title} · under ${mappedUnderLabel}` : title}
      >
        <span className={cn('absolute inset-y-0 left-0 w-[3px]', kindStyle.rail)} aria-hidden />

        <div
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset',
            kindStyle.iconBg,
            kindStyle.iconRing,
          )}
        >
          <KindIcon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-tight tracking-[-0.01em] text-card-foreground">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
            {kindStyle.label}
          </p>
        </div>
      </div>
    )
  }

  const configured = Boolean(agent?.model?.trim())
  const tools = mappedChildren.tool + mappedChildren.mcp
  const memory = mappedChildren.memory
  const knowledge = mappedChildren.skill + mappedChildren.integration

  const slotConnected = (id: AgentDockSlot['id']) => {
    if (id === 'model') return configured
    if (id === 'tool') return tools > 0
    if (id === 'memory') return memory > 0
    return knowledge > 0
  }

  const slotCount = (id: AgentDockSlot['id']) => {
    if (id === 'model') return configured ? 1 : 0
    if (id === 'tool') return tools
    if (id === 'memory') return memory
    return knowledge
  }

  /** Empty ports always show +; multi docks keep + when selected so more can be added. */
  const showPlus = (slot: AgentDockSlot, connected: boolean) => {
    if (!onAttachAction) return false
    if (!connected) return true
    return (slot.id === 'tool' || slot.id === 'knowledge') && isSelected
  }

  return (
    <div className={cn('agent-wf-node group relative h-full w-full overflow-visible', className)}>
      {/* Card — icon + title only */}
      <div
        className={cn(
          'relative flex h-full w-full items-center gap-2.5 overflow-hidden rounded-xl',
          'border border-border bg-card pl-3 pr-3 shadow-sm',
          'transition-[border-color,box-shadow,background-color] duration-150',
          'hover:border-foreground/20 hover:shadow-md',
          isSelected && 'border-primary/70 shadow-md ring-2 ring-primary/20',
        )}
      >
        {/* Status rail — brand accent when a model is set, muted while unconfigured. */}
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-[3px] transition-colors duration-150',
            configured ? 'bg-primary/70' : 'bg-border',
          )}
          aria-hidden
        />

        <div className="flex shrink-0 items-center justify-center" aria-hidden>
          {isExternalAgentPalette(node.paletteId) ? (
            <AgentNodeAvatar paletteId={node.paletteId} size="md" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-inset ring-border/70">
              <Bot className="size-[18px] stroke-[1.75]" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-card-foreground">
              {title}
            </div>
            {agent?.humanInTheLoop ? (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
                title="Human in the loop enabled"
              >
                <ShieldCheck className="size-2.5" />
                HITL
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Docks */}
      <div className="pointer-events-none absolute inset-x-0 top-full z-20">
        {AGENT_DOCK_SLOTS.map((slot) => {
          const connected = slotConnected(slot.id)
          const count = slotCount(slot.id)
          const plus = showPlus(slot, connected)

          return (
            <div
              key={slot.id}
              className="pointer-events-none absolute top-0 -translate-x-1/2"
              style={{ left: `${slot.x * 100}%` }}
            >
              {/* Continuous connector — spans from the diamond straight through to
                  the + control (or just past the label when there's no +), so the
                  dock always reads as one unbroken line instead of floating pieces. */}
              <span
                className={cn(
                  'pointer-events-none absolute left-1/2 top-[5px] z-0 w-px -translate-x-1/2 transition-colors duration-150',
                  connected ? 'bg-primary/40' : 'bg-border',
                )}
                style={{ height: plus ? 37 : 10 }}
                aria-hidden
              />

              <button
                type="button"
                disabled={!onAttachAction}
                className={cn(
                  'pointer-events-auto absolute top-0 left-1/2 z-10 flex size-3.5 -translate-x-1/2 -translate-y-1/2',
                  'items-center justify-center',
                  'focus-visible:outline-none',
                  !onAttachAction && 'cursor-default',
                )}
                title={
                  connected
                    ? count > 1
                      ? `${slot.label} · ${count}`
                      : slot.label
                    : `Add ${slot.label.toLowerCase()}`
                }
                aria-label={`${slot.label}${count > 0 ? ` (${count})` : ''}`}
                onPointerDown={stopCanvas}
                onClick={(event) => {
                  stopCanvas(event)
                  onAttachAction?.(node.id, slot.action)
                }}
              >
                <span
                  className={cn(
                    'block size-2 rotate-45 rounded-[1px] border transition-colors duration-150',
                    connected
                      ? 'border-primary bg-primary'
                      : 'border-border bg-card group-hover:border-muted-foreground',
                    !connected && slot.required && 'border-amber-500/70',
                  )}
                  aria-hidden
                />
              </button>

              <span
                className={cn(
                  'pointer-events-none absolute top-[8px] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-[hsl(var(--canvas))] px-1',
                  'text-[9px] font-medium leading-none tracking-wide transition-colors duration-150',
                  connected ? 'text-foreground/70' : 'text-muted-foreground/70',
                )}
              >
                {slot.label}
                {slot.required ? (
                  <span className={connected ? 'text-muted-foreground/60' : 'text-amber-600 dark:text-amber-400'}>
                    *
                  </span>
                ) : null}
              </span>

              {plus ? (
                <button
                  type="button"
                  className={cn(
                    'pointer-events-auto absolute top-[32px] left-1/2 z-10 flex size-5 -translate-x-1/2 items-center justify-center rounded-md',
                    'border border-dashed border-border bg-[hsl(var(--canvas))] text-muted-foreground shadow-sm',
                    'transition-[border-color,color,background-color] duration-150',
                    'hover:border-solid hover:border-primary/60 hover:bg-primary/10 hover:text-primary',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  )}
                  title={`Add ${slot.label.toLowerCase()}`}
                  aria-label={`Add ${slot.label}`}
                  onPointerDown={stopCanvas}
                  onClick={(event) => {
                    stopCanvas(event)
                    onAttachAction?.(node.id, slot.action)
                  }}
                >
                  <Plus className="size-3" strokeWidth={2} />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
})
