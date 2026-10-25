import { memo, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import {
  BookOpen,
  Bot,
  Boxes,
  GitFork,
  ListOrdered,
  MessagesSquare,
  Split,
  Network,
  Users,
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
  orchestratorPattern,
  PATTERN_META,
  type OrchestrationPattern,
} from '@/components/agent-workflow/orchestration-patterns'
import {
  ModelProviderLogo,
  resolveModelProvider,
  type ModelProvider,
} from '@/components/agent-workflow/model-providers'
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
  agent: 'Agent',
  llm: 'Agent',
  specialist: 'Agent',
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
const CHILD_KIND_STYLES: Record<ChildKind, { label: string; icon: LucideIcon; tile: string; pill: string }> = {
  tool: {
    pill: 'border-sky-500/35',
    label: 'Tool',
    icon: Wrench,
    tile: 'bg-sky-500/10 text-sky-600 ring-sky-500/25 dark:text-sky-300',
  },
  mcp: {
    pill: 'border-emerald-500/35',
    label: 'MCP',
    icon: Plug,
    tile: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300',
  },
  skill: {
    pill: 'border-violet-500/35',
    label: 'Skill',
    icon: Sparkles,
    tile: 'bg-violet-500/10 text-violet-600 ring-violet-500/25 dark:text-violet-300',
  },
  integration: {
    pill: 'border-amber-500/35',
    label: 'Integration',
    icon: Boxes,
    tile: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  },
  memory: {
    pill: 'border-indigo-500/35',
    label: 'Memory',
    icon: Database,
    tile: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/25 dark:text-indigo-300',
  },
  executor: {
    pill: 'border-orange-500/35',
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

/** Where an agent sits in an orchestration: the orchestrator itself, or one of its team. */
export type NodeOrchestration =
  | { role: 'orchestrator'; pattern: string; teamSize: number; team: string[] }
  | { role: 'participant'; teamLabel: string }

function OrchestrationBadge({ orchestration }: { orchestration: NodeOrchestration }) {
  if (orchestration.role === 'orchestrator') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-background"
        title={`${orchestration.pattern} orchestrator · ${orchestration.teamSize} agent${orchestration.teamSize === 1 ? '' : 's'} connected below`}
      >
        <Network className="size-2.5" />
        {orchestration.pattern} · {orchestration.teamSize}
      </span>
    )
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/60 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
      title={orchestration.teamLabel}
    >
      <Users className="size-2.5" />
      Team
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

/**
 * The agent's model slot, on the left of the card: the model client's logo once one is chosen
 * (with a small agent badge), otherwise a dashed "+" to add one. Clicking it opens the model
 * clients for this agent.
 */
function ModelSlot({
  nodeId,
  provider,
  onAttachAction,
}: {
  nodeId: string
  provider: ModelProvider | undefined
  onAttachAction?: (agentId: string, action: AgentAttachAction) => void
}) {
  const label = provider ? `Model client: ${provider.label} (change)` : 'Add a model client'
  const tile = provider ? (
    <span className="relative flex size-9 items-center justify-center">
      <ModelProviderLogo provider={provider} className="size-9" />
      <span
        className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-card text-foreground/70 ring-1 ring-border"
        aria-hidden
      >
        <Bot className="size-2.5" />
      </span>
    </span>
  ) : (
    <span
      className={cn(
        'flex size-9 items-center justify-center rounded-[10px] border-[1.5px] border-dashed transition-colors',
        'border-amber-500/60 text-amber-600 dark:text-amber-400',
        onAttachAction && 'group-hover/model:border-amber-500 group-hover/model:bg-amber-500/10',
      )}
    >
      <Plus className="size-4" />
    </span>
  )
  if (!onAttachAction) {
    return (
      <span className="flex shrink-0" title={label} aria-label={label}>
        {tile}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="group/model flex shrink-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={label}
      aria-label={label}
      onPointerDown={stopCanvas}
      onClick={(event) => {
        stopCanvas(event)
        onAttachAction(nodeId, 'model')
      }}
    >
      {tile}
    </button>
  )
}

/** "Specialist · gpt-4.1", or the type and a "Needs model" warning. */
/** The agent's model as a chip (green dot when set, amber prompt when not), then its type. */
function AgentSubtitle({ type, model }: { type: string; model?: string }) {
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
      {model ? (
        <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted px-1.5 py-[3px] font-mono text-[10px] leading-none text-foreground/75 ring-1 ring-inset ring-border/60">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          <span className="truncate">{model}</span>
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center rounded-md bg-amber-500/10 px-1.5 py-[3px] text-[10px] font-medium leading-none text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
          Choose a model
        </span>
      )}
      <span className="shrink-0 truncate text-[10.5px] leading-none text-muted-foreground">{type}</span>
    </div>
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
  badge,
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
  badge?: ReactNode
  capabilities?: VerticalCapability[]
  onAttachAction?: (agentId: string, action: AgentAttachAction) => void
  className?: string
}) {
  return (
    <div className={cn('agent-wf-node group relative h-full w-full', className)}>
      <div className={cardClasses(isSelected, 'flex h-full w-full flex-col rounded-[14px]')}>
        <span
          aria-hidden
          className={cn(
            'absolute left-0 top-3 h-[calc(100%-1.5rem-36px)] w-[3px] rounded-r-full transition-colors duration-150',
            isSelected ? 'bg-foreground' : 'bg-foreground/25 group-hover:bg-foreground/45',
          )}
        />
        <div className="flex min-h-0 flex-1 items-center gap-3 pl-4 pr-3.5">
          {icon}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-card-foreground">
                {title}
              </div>
              {badge}
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

/** Accent per orchestration pattern: frame gradient, icon tile and label tint. */
const PATTERN_ACCENTS: Record<
  OrchestrationPattern,
  { header: string; frame: string; tile: string; text: string; icon: LucideIcon }
> = {
  sequential: {
    header: 'bg-gradient-to-r from-emerald-500/[0.12] to-teal-500/[0.04]',
    frame: 'from-emerald-500 via-teal-500 to-cyan-500',
    tile: 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: ListOrdered,
  },
  concurrent: {
    header: 'bg-gradient-to-r from-indigo-500/[0.12] to-blue-500/[0.04]',
    frame: 'from-indigo-500 via-blue-500 to-sky-500',
    tile: 'bg-gradient-to-br from-indigo-500 to-blue-500 text-white',
    text: 'text-indigo-600 dark:text-indigo-300',
    icon: GitFork,
  },
  magentic: {
    header: 'bg-gradient-to-r from-violet-500/[0.12] to-indigo-500/[0.04]',
    frame: 'from-violet-500 via-fuchsia-500 to-indigo-500',
    tile: 'bg-gradient-to-br from-violet-500 to-indigo-500 text-white',
    text: 'text-violet-600 dark:text-violet-300',
    icon: Network,
  },
  'group-chat': {
    header: 'bg-gradient-to-r from-sky-500/[0.12] to-teal-500/[0.04]',
    frame: 'from-sky-500 via-cyan-500 to-teal-500',
    tile: 'bg-gradient-to-br from-sky-500 to-teal-500 text-white',
    text: 'text-sky-600 dark:text-sky-300',
    icon: MessagesSquare,
  },
  handoff: {
    header: 'bg-gradient-to-r from-amber-500/[0.14] to-rose-500/[0.04]',
    frame: 'from-amber-500 via-orange-500 to-rose-500',
    tile: 'bg-gradient-to-br from-amber-500 to-rose-500 text-white',
    text: 'text-amber-700 dark:text-amber-300',
    icon: Split,
  },
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return ((words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)) || 'AI').toUpperCase()
}

/**
 * A workflow (an orchestrator and its team). Drawn as a stacked deck, so it reads as a group
 * rather than a single agent: a tinted header naming the pattern, the orchestrator's name and
 * model, and its team as overlapping avatars.
 */
function OrchestratorCard({
  title,
  pattern,
  team,
  isSelected,
  leading,
  className,
}: {
  title: string
  pattern: OrchestrationPattern
  team: string[]
  isSelected: boolean
  /** The model slot (the orchestrator still runs on a model). */
  leading: ReactNode
  className?: string
}) {
  const accent = PATTERN_ACCENTS[pattern]
  const PatternIcon = accent.icon
  const shown = team.slice(0, 4)
  const more = team.length - shown.length
  return (
    <div className={cn('agent-wf-node group relative h-full w-full', className)}>
      {/* The deck: two cards fanned out behind, marking this as a group. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-4 -bottom-2 top-2 rounded-2xl border border-[hsl(var(--node-border))] bg-[hsl(var(--node))] opacity-60"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-2 -bottom-1 top-1 rounded-2xl border border-[hsl(var(--node-border))] bg-[hsl(var(--node))] opacity-80"
      />
      <div
        className={cn(
          'relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-[hsl(var(--node))] transition-shadow duration-200',
          isSelected
            ? 'border-[hsl(var(--node-selected-border))] shadow-[0_0_0_4px_hsl(var(--foreground)/0.06),0_12px_28px_-14px_rgba(0,0,0,0.4)]'
            : 'border-[hsl(var(--node-border))] shadow-[0_8px_22px_-14px_rgba(0,0,0,0.35)] group-hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.45)]',
        )}
      >
        <div className={cn('flex h-8 shrink-0 items-center gap-2 px-3', accent.header)}>
          <span className={cn('flex size-5 items-center justify-center rounded-md shadow-sm', accent.tile)}>
            <PatternIcon className="size-3" />
          </span>
          <span className={cn('text-[10px] font-bold uppercase tracking-[0.1em]', accent.text)}>
            {PATTERN_META[pattern].label} workflow
          </span>
          <span className="ml-auto rounded-full bg-background/70 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground ring-1 ring-border/70">
            {team.length} agent{team.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 items-center gap-2.5 px-3">
          {leading}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold leading-tight tracking-[-0.01em] text-card-foreground">{title}</p>
            {team.length > 0 ? (
              <div className="mt-1.5 flex items-center gap-1.5" title={team.join(', ')}>
                <span className="flex -space-x-1.5">
                  {shown.map((name) => (
                    <span
                      key={name}
                      className="flex size-[22px] items-center justify-center rounded-full bg-muted text-[8.5px] font-semibold text-foreground/80 ring-2 ring-[hsl(var(--node))]"
                    >
                      {initials(name)}
                    </span>
                  ))}
                  {more > 0 ? (
                    <span className="flex size-[22px] items-center justify-center rounded-full bg-foreground text-[8.5px] font-semibold text-background ring-2 ring-[hsl(var(--node))]">
                      +{more}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{team.join(', ')}</span>
              </div>
            ) : (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">Connect agents to build the team</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Human review: an approval gate, dashed amber frame with a shield. */
function ReviewCard({ title, isSelected, className }: { title: string; isSelected: boolean; className?: string }) {
  return (
    <div className={cn('agent-wf-node group relative h-full w-full', className)}>
      <div
        className={cn(
          'flex h-full w-full items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed px-3 transition-colors duration-150',
          'border-amber-500/60 bg-amber-50/80 dark:bg-amber-500/[0.07]',
          isSelected ? 'border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.15)]' : 'hover:border-amber-500/80',
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm shadow-amber-500/30">
          <ShieldCheck className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-amber-950 dark:text-amber-100">{title}</p>
          <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-amber-700 dark:text-amber-300">
            Approval gate
          </p>
        </div>
      </div>
    </div>
  )
}

/** An executor: a terminal-style dark card in both themes. */
function ExecutorCard({ title, isSelected, className }: { title: string; isSelected: boolean; className?: string }) {
  return (
    <div className={cn('agent-wf-node group relative h-full w-full', className)}>
      <div
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-[12px] border bg-zinc-950 text-zinc-100 transition-shadow duration-150',
          isSelected
            ? 'border-zinc-500 shadow-[0_0_0_4px_rgba(113,113,122,0.25)]'
            : 'border-zinc-800 shadow-[0_6px_16px_-10px_rgba(0,0,0,0.6)]',
        )}
      >
        <div className="flex h-4 shrink-0 items-center gap-1 bg-zinc-900 px-2" aria-hidden>
          <span className="size-1.5 rounded-full bg-red-400/80" />
          <span className="size-1.5 rounded-full bg-amber-400/80" />
          <span className="size-1.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="flex min-h-0 flex-1 items-center gap-2 px-2.5">
          <Terminal className="size-4 shrink-0 text-emerald-400" />
          <span className="min-w-0 truncate font-mono text-[12px] font-medium">{title}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-emerald-400/80">›_</span>
        </div>
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
      className={cn(
        'flex h-full w-full items-center border bg-[hsl(var(--node))] transition-[border-color,box-shadow] duration-150',
        'gap-2 rounded-full pl-1 pr-3',
        kindStyle.pill,
        isSelected
          ? 'shadow-[0_0_0_3px_hsl(var(--foreground)/0.08)]'
          : 'shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_10px_-4px_rgba(16,24,40,0.15)]',
        className,
      )}
      title={`${kindStyle.label} · ${tooltip}`}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
          compact ? 'size-6' : 'size-7',
          kindStyle.tile,
        )}
        aria-hidden
      >
        <KindIcon className="size-3.5" />
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
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium leading-none tracking-[-0.01em] text-card-foreground">
          {title}
        </p>
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
  /** The node's place in the workflow's orchestration, if any. */
  orchestration?: NodeOrchestration
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
  orchestration,
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

    if (executorNode) return <ExecutorCard title={title} isSelected={isSelected} className={className} />
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
  const provider = resolveModelProvider(agent)
  // Built-in agents show their model client on the left; external agents keep their avatar.
  const leadingIcon = externalAgent ? (
    <AgentIcon paletteId={node.paletteId} status={status} />
  ) : (
    <ModelSlot nodeId={node.id} provider={provider} onAttachAction={onAttachAction} />
  )
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

  // Workflows and approval gates have their own designs, in either flow direction.
  const pattern = orchestratorPattern(node)
  if (pattern) {
    return (
      <OrchestratorCard
        title={title}
        pattern={pattern}
        team={orchestration?.role === 'orchestrator' ? orchestration.team : []}
        isSelected={isSelected}
        leading={leadingIcon}
        className={className}
      />
    )
  }
  if (agent?.agentType === 'human') {
    return <ReviewCard title={title} isSelected={isSelected} className={className} />
  }

  if (vertical) {
    return (
      <VerticalFlowCard
        nodeId={node.id}
        title={title}
        subtitle={<AgentSubtitle type={typeLabel} model={model} />}
        isSelected={isSelected}
        hitl={agent?.humanInTheLoop}
        badge={orchestration ? <OrchestrationBadge orchestration={orchestration} /> : null}
        capabilities={AGENT_DOCK_SLOTS.map((slot) => ({
          slot,
          connected: slotConnected(slot.id),
          count: slotCount(slot.id),
        }))}
        onAttachAction={onAttachAction}
        className={className}
        icon={leadingIcon}
      />
    )
  }

  /** Tools and knowledge take any number, so their pills keep offering "+" once filled. */
  const takesMore = (slot: AgentDockSlot) => slot.id === 'tool' || slot.id === 'knowledge'

  return (
    <div className={cn('agent-wf-node group relative h-full w-full overflow-visible', className)}>
      <div className={cardClasses(isSelected, 'flex h-full w-full items-center gap-3 rounded-[14px] pl-4 pr-3')}>
        {/* The agent rail: marks the card as an agent, apart from workflow decks and tool pills. */}
        <span
          aria-hidden
          className={cn(
            'absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full transition-colors duration-150',
            isSelected ? 'bg-foreground' : 'bg-foreground/25 group-hover:bg-foreground/45',
          )}
        />
        {leadingIcon}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate text-[13px] font-semibold leading-tight tracking-[-0.01em] text-card-foreground">
              {title}
            </div>
            {orchestration ? <OrchestrationBadge orchestration={orchestration} /> : null}
            {agent?.humanInTheLoop ? <HitlBadge /> : null}
          </div>
          <AgentSubtitle type={typeLabel} model={model} />
        </div>
      </div>

      {/* Capability pills hanging under the card: filled when attached, dashed when empty. */}
      <div className="pointer-events-none absolute inset-x-0 top-full z-20">
        {AGENT_DOCK_SLOTS.map((slot) => {
          const connected = slotConnected(slot.id)
          const count = slotCount(slot.id)
          const missing = !connected && slot.required
          const Icon = CAPABILITY_ICONS[slot.id]
          const offerMore = Boolean(onAttachAction) && connected && takesMore(slot)
          return (
            <div
              key={slot.id}
              className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${slot.x * 100}%` }}
            >
              <span
                aria-hidden
                className={cn('h-[7px] w-px', connected ? 'bg-foreground/40' : missing ? 'bg-amber-500/60' : 'bg-border')}
              />
              <button
                type="button"
                disabled={!onAttachAction}
                title={
                  connected
                    ? `${slot.label}${count > 1 ? ` · ${count}` : ''}${offerMore ? ' · click to add more' : ''}`
                    : `Add ${slot.label.toLowerCase()}`
                }
                aria-label={`${connected ? '' : 'Add '}${slot.label}${count > 0 ? ` (${count})` : ''}`}
                onPointerDown={stopCanvas}
                onClick={(event) => {
                  stopCanvas(event)
                  onAttachAction?.(node.id, slot.action)
                }}
                className={cn(
                  'pointer-events-auto relative flex size-5 items-center justify-center rounded-full',
                  'transition-[background-color,border-color,color,opacity] duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  connected
                    ? 'bg-foreground text-background shadow-sm'
                    : missing
                      ? 'border border-dashed border-amber-500/80 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                      : cn(
                          'border border-dashed border-muted-foreground/40 bg-[hsl(var(--node))] text-muted-foreground',
                          'hover:border-foreground/50 hover:text-foreground',
                        ),
                  !onAttachAction && 'cursor-default',
                )}
              >
                {connected ? (
                  <Icon className="size-2.5" />
                ) : (
                  <Plus className="size-2.5" strokeWidth={2.5} />
                )}
                {count > 1 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-background px-0.5 text-[8px] font-bold tabular-nums text-foreground ring-1 ring-border">
                    {count}
                  </span>
                ) : null}
              </button>
              <span
                className={cn(
                  'mt-1 whitespace-nowrap text-[8.5px] font-medium leading-none',
                  connected ? 'text-foreground/70' : missing ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground/70',
                )}
              >
                {CAPABILITY_SHORT_LABELS[slot.id]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
