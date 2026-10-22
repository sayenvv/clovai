import { memo, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import {
  BookOpen,
  Bot,
  Boxes,
  Cpu,
  Database,
  Plug,
  Plus,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  childKindForPalette,
  isExternalAgentPalette,
  resolveExternalAgent,
  VERTICAL_CAPABILITY_BAR_HEIGHT,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { AgentNodeAvatar } from '@/components/agent-workflow/external-agent-ui'
import {
  NODE_ICON_TILE,
  NODE_SURFACE,
  NODE_SURFACE_HOVER,
  NODE_SURFACE_SELECTED,
  nodeStatusDot,
} from '@/components/agent-workflow/node-surface'
import { isExecutorNode, isToolNode } from '@/components/agent-workflow/tool-agent-mapping'
import {
  resolveFlowDirection,
  type DiagramNode,
  type FlowDirection,
} from '@/components/designer/diagram-types'
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
 * Bottom capability docks — handles on the edge, a `+` below when empty.
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

/** One tint + icon per capability kind, so tool/mcp/skill/integration/memory/executor read apart at a glance. */
const CHILD_KIND_STYLES: Record<ChildKind, { label: string; icon: LucideIcon; tile: string }> = {
  tool: {
    label: 'Tool',
    icon: Wrench,
    tile: 'bg-sky-500/10 text-sky-600 ring-sky-500/25 dark:text-sky-300',
  },
  mcp: {
    label: 'MCP',
    icon: Plug,
    tile: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300',
  },
  skill: {
    label: 'Skill',
    icon: Sparkles,
    tile: 'bg-violet-500/10 text-violet-600 ring-violet-500/25 dark:text-violet-300',
  },
  integration: {
    label: 'Integration',
    icon: Boxes,
    tile: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  },
  memory: {
    label: 'Memory',
    icon: Database,
    tile: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/25 dark:text-indigo-300',
  },
  executor: {
    label: 'Executor',
    icon: Terminal,
    tile: 'bg-orange-500/10 text-orange-600 ring-orange-500/25 dark:text-orange-300',
  },
}

const CAPABILITY_ICONS: Record<AgentDockSlot['id'], LucideIcon> = {
  model: Cpu,
  memory: Database,
  tool: Wrench,
  knowledge: BookOpen,
}

const CAPABILITY_SHORT_LABELS: Record<AgentDockSlot['id'], string> = {
  model: 'Model',
  memory: 'Memory',
  tool: 'Tools',
  knowledge: 'Knowledge',
}

type NodeStatus = 'ready' | 'attention'

function cardClasses(isSelected: boolean, extra?: string) {
  return cn('relative overflow-hidden', NODE_SURFACE, NODE_SURFACE_HOVER, isSelected && NODE_SURFACE_SELECTED, extra)
}

function HitlBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
      title="Human in the loop enabled"
    >
      <ShieldCheck className="size-2.5" />
      HITL
    </span>
  )
}

/** The agent's icon: a provider avatar for external agents, otherwise a neutral tile; with a status dot. */
function AgentIcon({ paletteId, status }: { paletteId: string; status: NodeStatus }) {
  return (
    <span className="relative flex shrink-0" aria-hidden>
      {isExternalAgentPalette(paletteId) ? (
        <AgentNodeAvatar paletteId={paletteId} size="md" />
      ) : (
        <span className={cn(NODE_ICON_TILE, 'size-9')}>
          <Bot className="size-[18px] stroke-[1.75]" />
        </span>
      )}
      <span className={nodeStatusDot(status)} title={status === 'ready' ? 'Model set' : 'Needs a model'} />
    </span>
  )
}

/** "Specialist · gpt-4.1", or the type and a "Needs model" warning. */
function AgentSubtitle({ type, model }: { type: string; model?: string }) {
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
      <span className="shrink-0">{type}</span>
      <span className="text-muted-foreground/40" aria-hidden>
        ·
      </span>
      {model ? (
        <span className="truncate font-mono text-[10.5px] text-foreground/70">{model}</span>
      ) : (
        <span className="truncate font-medium text-amber-700 dark:text-amber-400">Needs model</span>
      )}
    </p>
  )
}

interface VerticalCapability {
  slot: AgentDockSlot
  connected: boolean
  count: number
}

/**
 * Vertical-flow card: the flow enters through the top and leaves from the bottom,
 * and capabilities sit in a bar inside the card instead of hanging docks.
 */
function VerticalFlowCard({
  nodeId,
  title,
  subtitle,
  icon,
  isSelected,
  hitl,
  capabilities,
  onAttachAction,
  className,
}: {
  nodeId: string
  title: string
  subtitle: ReactNode
  icon: ReactNode
  isSelected: boolean
  hitl?: boolean
  capabilities?: VerticalCapability[]
  onAttachAction?: (agentId: string, action: AgentAttachAction) => void
  className?: string
}) {
  return (
    <div className={cn('agent-wf-node group relative h-full w-full', className)}>
      <div className={cardClasses(isSelected, 'flex h-full w-full flex-col rounded-xl')}>
        <div className="flex min-h-0 flex-1 items-center gap-3 px-3.5">
          {icon}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-card-foreground">
                {title}
              </div>
              {hitl ? <HitlBadge /> : null}
            </div>
            {subtitle}
          </div>
        </div>

        {capabilities ? (
          <div
            className="grid shrink-0 grid-cols-4 gap-1 border-t border-border/70 bg-muted/30 p-1"
            style={{ height: VERTICAL_CAPABILITY_BAR_HEIGHT }}
          >
            {capabilities.map(({ slot, connected, count }) => {
              const Icon = CAPABILITY_ICONS[slot.id]
              const label = CAPABILITY_SHORT_LABELS[slot.id]
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!onAttachAction}
                  className={cn(
                    'flex min-w-0 items-center justify-center gap-1 rounded-md px-1',
                    'text-[10px] font-medium leading-none transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    connected
                      ? 'bg-card text-foreground shadow-sm ring-1 ring-inset ring-border'
                      : slot.required
                        ? 'text-amber-700 hover:bg-card dark:text-amber-400'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground',
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
                    onAttachAction?.(nodeId, slot.action)
                  }}
                >
                  <Icon className="size-3 shrink-0" />
                  <span className="truncate">{label}</span>
                  {count > 1 ? <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span> : null}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** A capability (tool, MCP, skill, memory, …) or executor: tinted icon tile, name, kind. */
function ChildCard({
  title,
  kind,
  isSelected,
  tooltip,
  compact,
  className,
}: {
  title: string
  kind: ChildKind
  isSelected: boolean
  tooltip: string
  /** One-line strip for the vertical layout's tool column. */
  compact?: boolean
  className?: string
}) {
  const kindStyle = CHILD_KIND_STYLES[kind]
  const KindIcon = kindStyle.icon
  return (
    <div
      className={cardClasses(
        isSelected,
        cn('flex h-full w-full items-center', compact ? 'gap-2 rounded-lg px-2' : 'gap-2.5 rounded-xl px-3', className),
      )}
      title={tooltip}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center ring-1 ring-inset',
          compact ? 'size-6 rounded-md' : 'size-8 rounded-[9px]',
          kindStyle.tile,
        )}
        aria-hidden
      >
        <KindIcon className={compact ? 'size-3.5' : 'size-4'} />
      </span>
      {compact ? (
        <>
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium leading-none tracking-[-0.01em] text-card-foreground">
            {title}
          </p>
          <span className="shrink-0 text-[9px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
            {kindStyle.label}
          </span>
        </>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold leading-tight tracking-[-0.01em] text-card-foreground">
            {title}
          </p>
          <p className="mt-1 truncate text-[9.5px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
            {kindStyle.label}
          </p>
        </div>
      )}
    </div>
  )
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
  /** Vertical flow renders the taller card with a built-in capability bar. */
  direction?: FlowDirection
}

export const AgentNodeCard = memo(function AgentNodeCard({
  node,
  item,
  isSelected,
  className,
  mappedUnderLabel,
  mappedChildren = { tool: 0, skill: 0, memory: 0, integration: 0, mcp: 0 },
  onAttachAction,
  direction,
}: AgentNodeCardProps) {
  const agent = node.agent
  const toolNode = isToolNode(node)
  const executorNode = isExecutorNode(node)
  const externalAgent = resolveExternalAgent(node.paletteId)
  const title =
    node.label?.trim() ||
    (externalAgent ? externalAgent.label : TYPE_LABELS[agent?.agentType ?? 'llm'] ?? item.label)

  const vertical = resolveFlowDirection(direction) === 'vertical'

  if (toolNode || executorNode) {
    const kind = resolveChildKind(node, executorNode)
    const kindStyle = CHILD_KIND_STYLES[kind]
    const KindIcon = kindStyle.icon
    const tooltip = mappedUnderLabel ? `${title} · under ${mappedUnderLabel}` : title

    if (vertical && toolNode) {
      return <ChildCard title={title} kind={kind} isSelected={isSelected} tooltip={tooltip} compact className={className} />
    }

    if (vertical) {
      return (
        <VerticalFlowCard
          nodeId={node.id}
          title={title}
          subtitle={
            <p className="mt-1 truncate text-[11px] leading-tight text-muted-foreground">
              {agent?.description?.trim() || kindStyle.label}
            </p>
          }
          isSelected={isSelected}
          className={className}
          icon={
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset', kindStyle.tile)}>
              <KindIcon className="size-[18px] stroke-[1.75]" />
            </span>
          }
        />
      )
    }

    return <ChildCard title={title} kind={kind} isSelected={isSelected} tooltip={tooltip} className={className} />
  }

  const model = agent?.model?.trim()
  const configured = Boolean(model)
  const status: NodeStatus = configured ? 'ready' : 'attention'
  const typeLabel = externalAgent?.provider ?? TYPE_LABELS[agent?.agentType ?? 'llm'] ?? 'Agent'
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

  if (vertical) {
    return (
      <VerticalFlowCard
        nodeId={node.id}
        title={title}
        subtitle={<AgentSubtitle type={typeLabel} model={model} />}
        isSelected={isSelected}
        hitl={agent?.humanInTheLoop}
        capabilities={AGENT_DOCK_SLOTS.map((slot) => ({
          slot,
          connected: slotConnected(slot.id),
          count: slotCount(slot.id),
        }))}
        onAttachAction={onAttachAction}
        className={className}
        icon={<AgentIcon paletteId={node.paletteId} status={status} />}
      />
    )
  }

  /**
   * When a dock's `+` shows: always for the required model while it's missing; for the
   * others on hover or selection, so idle cards stay uncluttered. Multi docks keep `+`
   * while selected so more can be added.
   */
  const plusMode = (slot: AgentDockSlot, connected: boolean): 'always' | 'hover' | 'never' => {
    if (!onAttachAction) return 'never'
    if (!connected) return slot.required ? 'always' : 'hover'
    return (slot.id === 'tool' || slot.id === 'knowledge') && isSelected ? 'always' : 'never'
  }

  return (
    <div className={cn('agent-wf-node group relative h-full w-full overflow-visible', className)}>
      <div className={cardClasses(isSelected, 'flex h-full w-full items-center gap-3 rounded-xl px-3')}>
        <AgentIcon paletteId={node.paletteId} status={status} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-card-foreground">
              {title}
            </div>
            {agent?.humanInTheLoop ? <HitlBadge /> : null}
          </div>
          <AgentSubtitle type={typeLabel} model={model} />
        </div>
      </div>

      {/* Docks */}
      <div className="pointer-events-none absolute inset-x-0 top-full z-20">
        {AGENT_DOCK_SLOTS.map((slot) => {
          const connected = slotConnected(slot.id)
          const count = slotCount(slot.id)
          const plus = plusMode(slot, connected)
          const missing = !connected && slot.required

          return (
            <div
              key={slot.id}
              className="pointer-events-none absolute top-0 -translate-x-1/2"
              style={{ left: `${slot.x * 100}%` }}
            >
              {/* Stem from the handle to the label. */}
              <span
                className={cn(
                  'pointer-events-none absolute left-1/2 top-[4px] z-0 h-[10px] w-px -translate-x-1/2 transition-colors duration-150',
                  connected ? 'bg-foreground/35' : 'bg-border',
                )}
                aria-hidden
              />

              <button
                type="button"
                disabled={!onAttachAction}
                className={cn(
                  'pointer-events-auto absolute left-1/2 top-0 z-10 flex size-3.5 -translate-x-1/2 -translate-y-1/2',
                  'items-center justify-center focus-visible:outline-none',
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
                    'block size-[7px] rotate-45 rounded-[1.5px] border transition-colors duration-150',
                    connected
                      ? 'border-foreground bg-foreground'
                      : missing
                        ? 'border-amber-500 bg-card'
                        : 'border-muted-foreground/50 bg-card group-hover:border-muted-foreground',
                  )}
                  aria-hidden
                />
              </button>

              <span
                className={cn(
                  'pointer-events-none absolute left-1/2 top-[9px] z-10 -translate-x-1/2 whitespace-nowrap bg-[hsl(var(--canvas))] px-1',
                  'text-[8.5px] font-semibold uppercase leading-none tracking-[0.06em] transition-colors duration-150',
                  connected ? 'text-foreground/70' : missing ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground/70',
                )}
              >
                {CAPABILITY_SHORT_LABELS[slot.id]}
                {count > 1 ? <span className="ml-0.5 tabular-nums text-muted-foreground">{count}</span> : null}
              </span>

              {plus !== 'never' ? (
                <span
                  className={cn(
                    'transition-opacity duration-150',
                    plus === 'hover' && !isSelected && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
                  )}
                >
                  <span
                    className="pointer-events-none absolute left-1/2 top-[19px] h-[12px] w-px -translate-x-1/2 bg-border"
                    aria-hidden
                  />
                  <button
                    type="button"
                    className={cn(
                      'pointer-events-auto absolute left-1/2 top-[30px] z-10 flex size-[18px] -translate-x-1/2 items-center justify-center rounded-md',
                      'border bg-card shadow-sm transition-[border-color,color,background-color] duration-150',
                      missing
                        ? 'border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400'
                        : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
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
                    <Plus className="size-3" strokeWidth={2.25} />
                  </button>
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
})
