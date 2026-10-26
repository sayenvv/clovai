import { AdminBadge } from '@/components/shared/AdminBadge'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  Blocks,
  Boxes,
  BrainCircuit,
  Check,
  Bot,
  CircleStop,
  Cpu,
  Database,
  Hammer,
  Import,
  LayoutGrid,
  List,
  GitFork,
  ListOrdered,
  MessagesSquare,
  Network,
  Split,
  Play,
  Plug,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/utils/cn'
import { DND_MIME } from '@/components/designer/diagram-types'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import {
  EXTERNAL_AGENT_BLOCKS,
  EXECUTOR_PALETTE_ID,
  MCP_TOOL_PALETTE_ID,
  SIDEBAR_BLOCKS,
  type SidebarBlock,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { WorkflowIcon } from '@/components/shared/WorkflowIcon'
import { ExternalAgentListItem } from '@/components/agent-workflow/external-agent-ui'
import { useModelConnections } from '@/components/agent-workflow/hooks/use-model-connections'
import { ModelOwnerBadge } from '@/components/agent-workflow/ModelConnectionDialog'
import { modelClientRef, type ModelConnection } from '@/services/model-connections-api'
import {
  AGENT_CAPABILITIES,
  type AgentCapability,
  type AgentCapabilityKind,
} from '@/components/agent-workflow/agent-capabilities'
import {
  AgentImportDialog,
  ExternalAgentImportSection,
} from '@/components/agent-workflow/external-agent-import-ui'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import { OPEN_LIBRARY_DEPLOYMENTS_EVENT } from '@/components/agent-workflow/deployments-sidebar-ui'
import { SettingsMenu, type CanvasViewSettings } from '@/components/agent-workflow/SettingsMenu'
import { MODEL_PROVIDER_DND_MIME, ModelLogo, type ModelProviderId } from '@/components/agent-workflow/model-providers'
import { HelpMenu } from '@/components/agent-workflow/HelpMenu'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import { useSession } from '@/hooks/use-session'
import type { AgentType } from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import type { LucideIcon } from 'lucide-react'

export type LibrarySection =
  | 'blocks'
  | 'workflows'
  | 'agents'
  | 'tools'
  | 'skills'
  | 'models'
  | 'store'
  | 'import'
  | 'deployments'

/** Library tabs that list catalog items, and the groups each one shows. */
const CATALOG_SECTIONS: Partial<Record<LibrarySection, LibraryCategory[]>> = {
  workflows: ['orchestration', 'flow'],
  agents: ['agents'],
  tools: ['tool', 'mcp', 'integration'],
  skills: ['skill', 'memory'],
  models: ['models'],
}

/** "Create your own" kinds offered on each catalog tab. */
const CUSTOM_KINDS_BY_SECTION: Partial<Record<LibrarySection, CustomBlockKind[]>> = {
  blocks: ['agent', 'tool', 'skill'],
  agents: ['agent'],
  tools: ['tool'],
  skills: ['skill'],
}

function isCatalogSection(section: LibrarySection | null): boolean {
  return section === 'blocks' || Boolean(section && CATALOG_SECTIONS[section])
}

interface AgentLibrarySidebarProps {
  onAddAgent: (paletteId: string) => void
  onOpenSettings?: () => void
  serverModelConfig?: WorkflowModelConfig
  llmConfigured?: boolean
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
  /** Fill parent (mobile drawer) — flyout open by default, no resize handle. */
  embedded?: boolean
  /** Active library section — used to highlight Deployments when the canvas board is open. */
  activeSection?: LibrarySection | null
  onSectionChange?: (section: LibrarySection | null) => void
  /** Grid and snapping toggles, shown in the rail's Settings menu. */
  canvasView?: CanvasViewSettings
  /** The Built-in blocks section's tab: blocks, or model clients (controlled when set). */
  blocksTab?: BlocksTab
  onBlocksTabChange?: (tab: BlocksTab) => void
  /** A model client was picked (clicked) in the Model clients tab. */
  onPickModelProvider?: (providerId: ModelProviderId) => void
  /** The agent a picked model client goes to, when known (shown in the tab). */
  modelTargetLabel?: string
  /** That agent's current model client, marked in the list. */
  activeModelProviderId?: string
  /** A ready-made tool, skill, integration, MCP server or memory was picked: attach it to an agent. */
  onAddCapability?: (capabilityId: string) => void
  /** "Create your own": add a blank agent, tool or skill and open it to define. */
  onCreateCustom?: (kind: CustomBlockKind) => void
}

export type CustomBlockKind = 'agent' | 'tool' | 'skill'

export type BlocksTab = 'blocks' | 'models'

const FLYOUT_MIN_WIDTH = 260

const SECTION_META: Record<LibrarySection, { title: string; subtitle: string }> = {
  blocks: {
    title: 'All blocks',
    subtitle: 'Drag or click to add to the canvas',
  },
  workflows: { title: 'Workflows', subtitle: 'Orchestration patterns, Start and End' },
  agents: { title: 'Agents', subtitle: 'Agents to add to the canvas' },
  tools: { title: 'Tools', subtitle: 'Tools, MCP servers and integrations for an agent' },
  skills: { title: 'Skills', subtitle: 'Skills and memory for an agent' },
  models: { title: 'Model clients', subtitle: 'The provider an agent runs on' },
  store: {
    title: 'Agent store',
    subtitle: 'Third-party agent integrations',
  },
  import: {
    title: 'Import agents',
    subtitle: 'Pull agents from external platforms',
  },
  deployments: {
    title: 'Deployments',
    subtitle: 'Published workflow instances for this account',
  },
}

const BLOCK_ICONS: Record<AgentType, LucideIcon> = {
  llm: Bot,
  tool: Wrench,
  specialist: Bot,
  planner: Bot,
  human: Bot,
  router: Bot,
  trigger: Bot,
  memory: Bot,
  output: Bot,
  control: Bot,
  executor: Terminal,
}

const BLOCK_STYLES: Record<string, { icon: string; ring: string }> = {
  agent: {
    icon: 'bg-foreground/10 text-foreground dark:text-foreground',
    ring: 'ring-foreground/20',
  },
  tool: {
    icon: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    ring: 'ring-sky-500/20',
  },
  mcp: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    ring: 'ring-emerald-500/20',
  },
  skill: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    ring: 'ring-violet-500/20',
  },
  integration: {
    icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/20',
  },
  executor: {
    icon: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
    ring: 'ring-orange-500/20',
  },
  start: {
    icon: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-500/25',
  },
  end: {
    icon: 'bg-muted text-foreground/70',
    ring: 'ring-border',
  },
}

const BLOCK_KIND_LABELS: Record<string, string> = {
  agent: 'Agent',
  tool: 'Tool',
  'mcp-tool': 'MCP',
  skill: 'Skill',
  integration: 'Integration',
  executor: 'Executor',
  start: 'Entry',
  end: 'Exit',
}

function resolveBlockVisual(block: SidebarBlock) {
  const styles = BLOCK_STYLES[block.id === 'mcp-tool' ? 'mcp' : block.id] ?? BLOCK_STYLES.agent
  const Icon =
    block.id === 'start'
      ? Play
      : block.id === 'end'
        ? CircleStop
        : block.id === 'switch'
          ? GitFork
        : block.paletteId === MCP_TOOL_PALETTE_ID
          ? Plug
          : block.paletteId === EXECUTOR_PALETTE_ID
            ? Terminal
            : block.id === 'tool'
              ? Wrench
              : (BLOCK_ICONS[block.agentType] ?? Bot)
  const kindLabel = BLOCK_KIND_LABELS[block.id] ?? block.label
  return { styles, Icon, kindLabel }
}

type LibraryView = 'list' | 'grid'

type LibraryCategory = 'all' | 'orchestration' | 'agents' | AgentCapabilityKind | 'models' | 'flow'

const LIBRARY_CATEGORIES: { id: LibraryCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'orchestration', label: 'Orchestration' },
  { id: 'agents', label: 'Agents' },
  { id: 'tool', label: 'Tools' },
  { id: 'skill', label: 'Skills' },
  { id: 'integration', label: 'Integrations' },
  { id: 'mcp', label: 'MCP' },
  { id: 'memory', label: 'Memory' },
  { id: 'models', label: 'Model clients' },
  { id: 'flow', label: 'Flow' },
]

/**
 * Orchestrators: placing one sets the workflow's pattern, and the agents connected below it
 * become its team (see orchestration-patterns.ts).
 */
export const LIBRARY_ORCHESTRATORS: { paletteId: string; label: string; description: string; badge: string; icon: LucideIcon }[] = [
  {
    paletteId: 'aw-sequential',
    label: 'Sequential workflow',
    description: 'Runs the agents below one after another',
    badge: 'Sequential',
    icon: ListOrdered,
  },
  {
    paletteId: 'aw-concurrent',
    label: 'Concurrent workflow',
    description: 'Runs the agents below at the same time and merges results',
    badge: 'Concurrent',
    icon: GitFork,
  },
  {
    paletteId: 'aw-orchestrator',
    label: 'Magentic orchestrator',
    description: 'Plans the task and delegates to the agents below',
    badge: 'Magentic',
    icon: Network,
  },
  {
    paletteId: 'aw-group-manager',
    label: 'Group chat manager',
    description: 'Moderates a conversation between the agents below',
    badge: 'Group chat',
    icon: MessagesSquare,
  },
  {
    paletteId: 'aw-router',
    label: 'Handoff router',
    description: 'Triages and hands off to one of the agents below',
    badge: 'Handoff',
    icon: Split,
  },
]

export const ORCHESTRATOR_TILE = 'bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.14] text-foreground ring-foreground/25'

/** Ready-made agent types, added to the canvas like any block. */
export const LIBRARY_AGENTS: { paletteId: string; label: string; description: string; icon: LucideIcon }[] = [
  { paletteId: 'aw-llm-agent', label: 'LLM agent', description: 'General-purpose reasoning agent', icon: Bot },
  { paletteId: 'aw-specialist', label: 'Specialist', description: 'Focused domain expert agent', icon: BrainCircuit },
  { paletteId: 'aw-tool-agent', label: 'Tool agent', description: 'Calls tools and APIs to get work done', icon: Hammer },
  { paletteId: 'aw-reviewer', label: 'Human review', description: 'Pauses for a person to approve', icon: ShieldCheck },
  { paletteId: EXECUTOR_PALETTE_ID, label: 'Executor', description: 'Runs code to process messages', icon: Terminal },
]

export const CAPABILITY_VISUALS: Record<AgentCapabilityKind, { icon: LucideIcon; tile: string; title: string }> = {
  tool: { icon: Wrench, tile: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-300', title: 'Tools' },
  skill: { icon: Sparkles, tile: 'bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-300', title: 'Skills' },
  integration: {
    icon: Boxes,
    tile: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
    title: 'Integrations',
  },
  mcp: { icon: Plug, tile: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300', title: 'MCP servers' },
  memory: { icon: Database, tile: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300', title: 'Memory' },
}

const CUSTOM_BLOCKS: { kind: CustomBlockKind; label: string; icon: LucideIcon; tile: string; paletteId: string }[] = [
  { kind: 'agent', label: 'Agent', icon: Bot, tile: 'bg-foreground/10 text-foreground ring-foreground/20', paletteId: 'aw-agent' },
  { kind: 'tool', label: 'Tool', icon: Wrench, tile: CAPABILITY_VISUALS.tool.tile, paletteId: 'aw-tool' },
  { kind: 'skill', label: 'Skill', icon: Sparkles, tile: CAPABILITY_VISUALS.skill.tile, paletteId: 'aw-skill' },
]

function matches(needle: string, ...fields: Array<string | undefined>): boolean {
  return !needle || fields.some((field) => field?.toLowerCase().includes(needle))
}

/** A heading over one group of the library, with its count. */
function LibraryGroup({
  title,
  count,
  view,
  children,
}: {
  title: string
  count: number
  view: LibraryView
  children: ReactNode
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
        <span className="tabular-nums text-muted-foreground/60">{count}</span>
      </h3>
      <div className={view === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>{children}</div>
    </section>
  )
}

/** One library entry: tinted icon, name, description and an optional badge. */
function LibraryRow({
  icon: Icon,
  tile,
  title,
  description,
  badge,
  dragPaletteId,
  onClick,
  view = 'list',
}: {
  view?: LibraryView
  icon: LucideIcon
  tile: string
  title: string
  description: string
  badge?: string
  /** When set, the row can also be dragged onto the canvas as this palette block. */
  dragPaletteId?: string
  onClick: () => void
}) {
  const grid = view === 'grid'
  return (
    <button
      type="button"
      draggable={Boolean(dragPaletteId)}
      onDragStart={
        dragPaletteId
          ? (event) => {
              event.dataTransfer.setData(DND_MIME, dragPaletteId)
              event.dataTransfer.effectAllowed = 'copy'
            }
          : undefined
      }
      onClick={onClick}
      title={`Add ${title} · ${description}`}
      className={cn(
        'group relative flex w-full rounded-lg border border-border bg-card shadow-sm',
        'transition-all duration-150 hover:border-foreground/20 hover:shadow-md',
        grid ? 'min-w-0 flex-col items-center gap-1.5 px-2 pb-2.5 pt-3 text-center' : 'items-center gap-2.5 p-2 text-left',
        dragPaletteId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
          grid ? 'size-9' : 'size-8',
          tile,
        )}
      >
        <Icon className={grid ? 'size-4' : 'size-3.5'} />
      </span>
      {grid ? (
        <>
          <span className="line-clamp-1 w-full text-[11.5px] font-semibold leading-tight text-foreground">{title}</span>
          <span className="line-clamp-2 w-full text-[9.5px] leading-snug text-muted-foreground">{description}</span>
          {badge ? (
            <span className="absolute right-1.5 top-1.5 rounded border border-border/60 bg-muted/60 px-1 py-px text-[8px] font-medium uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </>
      ) : (
        <>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] font-semibold leading-tight text-foreground">{title}</span>
          {badge ? (
            <span className="shrink-0 rounded border border-border/60 bg-muted/60 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[10.5px] leading-snug text-muted-foreground">{description}</span>
      </span>
      <Plus
        className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors duration-150 group-hover:text-muted-foreground"
        aria-hidden
      />
        </>
      )}
    </button>
  )
}

/** "Create your own" cards: a blank agent, tool or skill to define. */
function CreateCustomCards({
  kinds,
  onCreate,
}: {
  kinds: CustomBlockKind[]
  onCreate?: (kind: CustomBlockKind) => void
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Create your own
      </h3>
      <div className={cn('grid gap-2', kinds.length === 1 ? 'grid-cols-1' : 'grid-cols-3')}>
        {CUSTOM_BLOCKS.filter((block) => kinds.includes(block.kind)).map(({ kind, label, icon: Icon, tile, paletteId }) => (
          <button
            key={kind}
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(DND_MIME, paletteId)
              event.dataTransfer.effectAllowed = 'copy'
            }}
            onClick={() => onCreate?.(kind)}
            title={`Create a custom ${label.toLowerCase()}`}
            className={cn(
              'group relative flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border bg-card px-1.5 pb-2.5 pt-3',
              'transition-all duration-150 hover:border-solid hover:border-foreground/25 hover:shadow-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span className={cn('relative flex size-9 items-center justify-center rounded-lg ring-1 ring-inset', tile)}>
              <Icon className="size-4" />
              <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-card">
                <Plus className="size-2.5" strokeWidth={3} />
              </span>
            </span>
            <span className="text-[11.5px] font-semibold leading-none text-foreground">{label}</span>
            <span className="text-[9px] font-medium uppercase leading-none tracking-wide text-muted-foreground">Custom</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** A saved model client in the library: logo, name, model, whose it is; click or drag onto an agent. */
function ModelClientRow({
  client,
  active,
  onPick,
  view = 'list',
}: {
  client: ModelConnection
  active: boolean
  onPick?: (providerId: ModelProviderId) => void
  view?: LibraryView
}) {
  const ref = modelClientRef(client.id) as ModelProviderId
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(MODEL_PROVIDER_DND_MIME, ref)
        event.dataTransfer.effectAllowed = 'link'
      }}
      onClick={() => onPick?.(ref)}
      title={`Use ${client.name} · ${client.model}`}
      className={cn(
        'group relative flex w-full rounded-lg border bg-card shadow-sm',
        view === 'grid'
          ? 'min-w-0 flex-col items-center gap-1.5 px-2 pb-2.5 pt-3 text-center'
          : 'items-center gap-2.5 p-2.5 text-left',
        'cursor-grab transition-all duration-150 active:cursor-grabbing',
        active ? 'border-foreground/40 ring-1 ring-foreground/10' : 'border-border hover:border-foreground/20 hover:shadow-md',
      )}
    >
      {view === 'grid' ? (
        <>
          <ModelLogo hints={[client.providerType, client.model]} className="size-9" />
          <span className="line-clamp-1 w-full text-[11.5px] font-semibold leading-tight text-foreground">
            {client.name}
          </span>
          <ModelOwnerBadge connection={client} />
          {active ? (
            <Check className="absolute right-1.5 top-1.5 size-3.5 text-foreground/70" aria-label="Current model client" />
          ) : null}
        </>
      ) : (
        <>
          <ModelLogo hints={[client.providerType, client.model]} className="size-8" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[12.5px] font-semibold leading-tight text-foreground">{client.name}</span>
              <ModelOwnerBadge connection={client} />
            </div>
            <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">{client.model}</p>
          </div>
          {active ? <Check className="size-4 shrink-0 text-foreground/70" aria-label="Current model client" /> : null}
        </>
      )}
    </button>
  )
}

/**
 * The library's main action (all blocks): a solid rounded square at the top of the rail, the one
 * filled control in it, with a soft lift on hover.
 */
function AddBlocksButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label="All blocks"
          aria-pressed={open}
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90',
            'shadow-[0_1px_2px_rgba(16,24,40,0.2),0_4px_10px_-4px_rgba(16,24,40,0.45),inset_0_1px_0_rgba(255,255,255,0.15)]',
            'dark:shadow-[0_1px_2px_rgba(0,0,0,0.5),0_4px_10px_-4px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(0,0,0,0.08)]',
            'transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-px active:translate-y-0 active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          <Plus className={cn('size-5 transition-transform duration-200 ease-out', open && 'rotate-45')} strokeWidth={2.25} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="px-2.5 py-1.5 text-xs font-medium">
        {open ? 'Close' : 'All blocks'}
      </TooltipContent>
    </Tooltip>
  )
}

/** A library section in the rail: icon over a short label, with an edge bar when open. */
function RailNavItem({
  label,
  shortLabel,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  shortLabel: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'group/nav relative flex w-12 shrink-0 flex-col items-center gap-1 rounded-lg py-1.5 transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {/* Edge bar on the rail's left side for the open section. */}
      <span
        aria-hidden
        className={cn(
          'absolute -left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity duration-150',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        className={cn(
          'flex h-8 w-10 items-center justify-center rounded-lg transition-colors duration-150',
          active ? 'bg-accent shadow-[inset_0_0_0_1px_hsl(var(--border))]' : 'group-hover/nav:bg-accent/60',
        )}
      >
        <Icon className="size-[18px]" strokeWidth={active ? 2 : 1.75} />
      </span>
      <span className={cn('text-[9.5px] leading-none tracking-[-0.01em]', active ? 'font-semibold' : 'font-medium')}>
        {shortLabel}
      </span>
    </button>
  )
}

/** A thin rule between rail groups. */
function RailDivider() {
  return <div className="my-2 h-px w-6 shrink-0 bg-border" aria-hidden />
}

export const AgentLibrarySidebar = memo(function AgentLibrarySidebar({
  onAddAgent,
  onOpenSettings,
  serverModelConfig,
  llmConfigured = false,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
  embedded = false,
  activeSection,
  onSectionChange,
  canvasView,
  blocksTab: blocksTabProp,
  onBlocksTabChange,
  onPickModelProvider,
  modelTargetLabel,
  activeModelProviderId,
  onAddCapability,
  onCreateCustom,
}: AgentLibrarySidebarProps) {
  const [category, setCategoryState] = useState<LibraryCategory>(blocksTabProp === 'models' ? 'models' : 'all')
  // The page opens the library on Model clients for an agent's model slot.
  useEffect(() => {
    if (blocksTabProp === 'models') setCategoryState('models')
  }, [blocksTabProp])
  const setCategory = (next: LibraryCategory) => {
    setCategoryState(next)
    onBlocksTabChange?.(next === 'models' ? 'models' : 'blocks')
  }
  const showCategory = (id: LibraryCategory) => {
    const scoped = resolvedSection ? CATALOG_SECTIONS[resolvedSection] : undefined
    if (scoped) return scoped.includes(id)
    return category === 'all' || category === id
  }
  const [libraryView, setLibraryView] = useState<LibraryView>('grid')
  const [section, setSection] = useState<LibrarySection | null>(
    embedded ? 'blocks' : null,
  )
  const resolvedSection = activeSection !== undefined ? activeSection : section
  const [query, setQuery] = useState('')
  const [importSourceId, setImportSourceId] = useState<string | null>(null)
  const [focusSearch, setFocusSearch] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  // Re-renders when the session changes (sign-in, switching account, restored from the server)
  const session = useSession()
  const userInitials = (session?.email || 'U').slice(0, 1).toUpperCase()
  const isAdmin = session?.accessRole === 'admin'
  const userLabel = session?.email ? `${session.email}${isAdmin ? ' · Admin' : ''}` : undefined

  // Deployments opens in the main canvas — keep the rail highlighted, no flyout.
  const flyoutOpen = resolvedSection !== null && resolvedSection !== 'deployments'
  const flyoutWidth = Math.max(width, FLYOUT_MIN_WIDTH)
  const totalWidth = embedded
    ? '100%'
    : SIDE_PANEL_COLLAPSED_WIDTH + (flyoutOpen ? flyoutWidth : 0)

  const closeFlyout = useCallback(() => {
    setSection(null)
    onSectionChange?.(null)
    setQuery('')
    setFocusSearch(false)
    if (!collapsed) onToggleCollapse()
  }, [collapsed, onToggleCollapse, onSectionChange])

  useEffect(() => {
    if (!focusSearch || resolvedSection !== 'blocks') return
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [focusSearch, resolvedSection])

  // Collapse the expandable section when clicking outside the library.
  useEffect(() => {
    if (!flyoutOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      // Keep open while an import dialog (portal) is active.
      if (importSourceId !== null) return
      if (target instanceof Element && target.closest('[role="dialog"], [data-radix-popper-content-wrapper]')) {
        return
      }
      closeFlyout()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [flyoutOpen, importSourceId, closeFlyout])

  const needle = query.trim().toLowerCase()
  const libraryOrchestrators = useMemo(
    () => LIBRARY_ORCHESTRATORS.filter((item) => matches(needle, item.label, item.description, item.badge)),
    [needle],
  )
  const libraryAgents = useMemo(
    () => LIBRARY_AGENTS.filter((agent) => matches(needle, agent.label, agent.description)),
    [needle],
  )
  const capabilitiesByKind = useMemo(() => {
    const groups = new Map<AgentCapabilityKind, AgentCapability[]>()
    for (const capability of AGENT_CAPABILITIES) {
      if (!matches(needle, capability.label, capability.description, capability.provider, capability.badge)) continue
      groups.set(capability.kind, [...(groups.get(capability.kind) ?? []), capability])
    }
    return groups
  }, [needle])
  const flowBlocks = useMemo(
    () =>
      SIDEBAR_BLOCKS.filter(
        (block) => (block.id === 'start' || block.id === 'end' || block.id === 'switch') && matches(needle, block.label, block.description),
      ),
    [needle],
  )

  // Model clients are the saved ones: the user's own, then the admin's for the application.
  const { connections: modelClients } = useModelConnections()
  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const sorted = [...modelClients].sort(
      (a, b) => Number(a.scope === 'application') - Number(b.scope === 'application'),
    )
    if (!needle) return sorted
    return sorted.filter(
      (client) =>
        client.name.toLowerCase().includes(needle) ||
        client.model.toLowerCase().includes(needle) ||
        client.providerType.toLowerCase().includes(needle),
    )
  }, [query, modelClients])

  const filteredStore = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || resolvedSection !== 'store') return EXTERNAL_AGENT_BLOCKS
    return EXTERNAL_AGENT_BLOCKS.filter(
      (block) =>
        block.label.toLowerCase().includes(needle) ||
        block.provider.toLowerCase().includes(needle) ||
        (block.description?.toLowerCase().includes(needle) ?? false),
    )
  }, [query, resolvedSection])

  const setActiveSection = useCallback(
    (next: LibrarySection | null) => {
      setSection(next)
      onSectionChange?.(next)
    },
    [onSectionChange],
  )

  const openSection = (next: LibrarySection, options?: { focusSearch?: boolean }) => {
    setQuery('')
    setFocusSearch(Boolean(options?.focusSearch))
    const current = resolvedSection
    const closing = current === next && !options?.focusSearch
    if (closing) {
      if (!collapsed && next !== 'deployments') onToggleCollapse()
      setFocusSearch(false)
      setActiveSection(null)
      return
    }
    if (next !== 'deployments' && collapsed) onToggleCollapse()
    setActiveSection(next)
  }

  useEffect(() => {
    const openDeployments = () => {
      setQuery('')
      setFocusSearch(false)
      setActiveSection('deployments')
    }
    window.addEventListener(OPEN_LIBRARY_DEPLOYMENTS_EVENT, openDeployments)
    return () => window.removeEventListener(OPEN_LIBRARY_DEPLOYMENTS_EVENT, openDeployments)
  }, [setActiveSection])

  const meta =
    resolvedSection && resolvedSection !== 'deployments'
      ? SECTION_META[resolvedSection]
      : null

  return (
    <>
      <aside
        ref={rootRef}
        className={cn(
          'relative flex h-full shrink-0 border-r border-border',
          'bg-background',
          embedded && 'w-full border-r-0',
        )}
        style={{ width: totalWidth }}
      >
        {flyoutOpen && !embedded && (
          <DesignerResizeHandle
            side="right"
            onPointerDown={onResizePointerDown}
            ariaLabel="Resize library panel"
          />
        )}

        {/* Icon rail: add / search, library sections, deployments, then settings and profile */}
        {!embedded && (
        <div
          className={cn(
            'relative z-30 flex h-full shrink-0 flex-col bg-background',
            flyoutOpen ? 'border-r border-border' : '',
          )}
          style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
        >

          <TooltipProvider delayDuration={180}>
            <div className="flex h-full min-h-0 flex-col items-center py-3">
              <AddBlocksButton open={resolvedSection === 'blocks'} onClick={() => openSection('blocks')} />

              {/* Library sections, labelled; scrolls on short screens. */}
              <nav
                aria-label="Library"
                className="mt-3 flex min-h-0 w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {(
                  [
                    ['workflows', 'Workflows', 'Workflows', WorkflowIcon],
                    ['agents', 'Agents', 'Agents', Bot],
                    ['tools', 'Tools', 'Tools', Wrench],
                    ['skills', 'Skills', 'Skills', Sparkles],
                    ['models', 'Model clients', 'Models', Cpu],
                  ] as const
                ).map(([id, label, short, icon]) => (
                  <RailNavItem
                    key={id}
                    label={label}
                    shortLabel={short}
                    icon={icon}
                    active={resolvedSection === id}
                    onClick={() => openSection(id)}
                  />
                ))}
                <RailDivider />
                {EXTERNAL_AGENT_BLOCKS.length > 0 && (
                  <RailNavItem
                    label="Agent store"
                    shortLabel="Store"
                    icon={Blocks}
                    active={resolvedSection === 'store'}
                    onClick={() => openSection('store')}
                  />
                )}
                <RailNavItem
                  label="Import agents"
                  shortLabel="Import"
                  icon={Import}
                  active={resolvedSection === 'import'}
                  onClick={() => openSection('import')}
                />
                <RailNavItem
                  label="Deployments"
                  shortLabel="Deploy"
                  icon={Server}
                  active={resolvedSection === 'deployments'}
                  onClick={() => openSection('deployments')}
                />
              </nav>



              <div className="flex w-full shrink-0 flex-col items-center gap-1.5">
                <RailDivider />
                <HelpMenu side="right" align="end" />
                <SettingsMenu
                  onOpenWorkflowSettings={onOpenSettings}
                  modelConfig={serverModelConfig}
                  llmConfigured={llmConfigured}
                  side="right"
                  align="end"
                  canvasView={canvasView}
                />
                <div
                  className={`relative rounded-full p-0.5 ring-1 ${isAdmin ? 'ring-amber-500/70' : 'ring-border'} transition-shadow duration-150 hover:ring-foreground/25`}
                  title={isAdmin ? 'Profile · Admin' : 'Profile'}
                >
                  <ProfileMenu
                    showSignOut={Boolean(session)}
                    userInitials={userInitials}
                    userLabel={userLabel}
                    side="right"
                    align="end"
                    avatarSize="sm"
                    triggerClassName="h-9 w-9 rounded-full hover:bg-transparent"
                  />
                  <AdminBadge show={isAdmin} />
                </div>
              </div>
            </div>
          </TooltipProvider>
        </div>
        )}

        {/* Expandable section */}
        {flyoutOpen && meta ? (
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col bg-background',
              !embedded && 'animate-in fade-in-0 slide-in-from-left-1 duration-200',
            )}
            style={embedded ? undefined : { width: flyoutWidth }}
          >
            {!embedded && (
            <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
              <h2 className="truncate text-sm font-semibold text-foreground">{meta.title}</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{meta.subtitle}</p>
            </div>
            )}

            {embedded && (
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 px-2 py-2">
                {(
                  [
                    ['blocks', 'All'],
                    ['workflows', 'Workflows'],
                    ['agents', 'Agents'],
                    ['tools', 'Tools'],
                    ['skills', 'Skills'],
                    ['models', 'Models'],
                    ['store', 'Store'],
                    ['import', 'Import'],
                    ['deployments', 'Deployments'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveSection(id)
                      setQuery('')
                    }}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap',
                      resolvedSection === id
                        ? 'bg-foreground/[0.08] text-foreground'
                        : 'text-muted-foreground hover:bg-foreground/[0.06]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {(isCatalogSection(resolvedSection) ||
              resolvedSection === 'store') && (
              <div className="shrink-0 border-b border-border/60 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={
                        resolvedSection === 'blocks'
                          ? 'Search agents, tools, skills, models…'
                          : resolvedSection && SECTION_META[resolvedSection]
                            ? `Search ${SECTION_META[resolvedSection].title.toLowerCase()}…`
                            : 'Search…'
                      }
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  {isCatalogSection(resolvedSection) && (
                    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
                      {(
                        [
                          ['list', 'List view', List],
                          ['grid', 'Grid view', LayoutGrid],
                        ] as const
                      ).map(([id, label, Icon]) => (
                        <button
                          key={id}
                          type="button"
                          aria-label={label}
                          aria-pressed={libraryView === id}
                          onClick={() => setLibraryView(id)}
                          className={cn(
                            'flex size-6 items-center justify-center rounded transition-colors duration-150',
                            libraryView === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <Icon className="size-3.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {resolvedSection === 'blocks' && (
                  <div
                    role="tablist"
                    aria-label="Library categories"
                    className="-mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {LIBRARY_CATEGORIES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={category === id}
                        onClick={() => setCategory(id)}
                        className={cn(
                          'h-6 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          category === id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {isCatalogSection(resolvedSection) && (
                <div className="space-y-5">
                  {!needle &&
                  (resolvedSection !== 'blocks' || category === 'all') &&
                  resolvedSection &&
                  CUSTOM_KINDS_BY_SECTION[resolvedSection] ? (
                    <CreateCustomCards kinds={CUSTOM_KINDS_BY_SECTION[resolvedSection]!} onCreate={onCreateCustom} />
                  ) : null}

                  {showCategory('orchestration') && libraryOrchestrators.length > 0 ? (
                    <LibraryGroup view={libraryView} title="Orchestration" count={libraryOrchestrators.length}>
                      {libraryOrchestrators.map((item) => (
                        <LibraryRow
                          view={libraryView}
                          key={item.paletteId}
                          icon={item.icon}
                          tile={ORCHESTRATOR_TILE}
                          title={item.label}
                          description={item.description}
                          badge={item.badge}
                          dragPaletteId={item.paletteId}
                          onClick={() => onAddAgent(item.paletteId)}
                        />
                      ))}
                    </LibraryGroup>
                  ) : null}

                  {showCategory('agents') && libraryAgents.length > 0 ? (
                    <LibraryGroup view={libraryView} title="Agents" count={libraryAgents.length}>
                      {libraryAgents.map((agent) => (
                        <LibraryRow
                          view={libraryView}
                          key={agent.paletteId}
                          icon={agent.icon}
                          tile="bg-foreground/10 text-foreground ring-foreground/20"
                          title={agent.label}
                          description={agent.description}
                          dragPaletteId={agent.paletteId}
                          onClick={() => onAddAgent(agent.paletteId)}
                        />
                      ))}
                    </LibraryGroup>
                  ) : null}

                  {(Object.keys(CAPABILITY_VISUALS) as AgentCapabilityKind[]).map((kind) => {
                    const items = capabilitiesByKind.get(kind) ?? []
                    if (!showCategory(kind) || items.length === 0) return null
                    const visual = CAPABILITY_VISUALS[kind]
                    return (
                      <LibraryGroup view={libraryView} key={kind} title={visual.title} count={items.length}>
                        {items.map((capability) => (
                          <LibraryRow
                            view={libraryView}
                            key={capability.id}
                            icon={visual.icon}
                            tile={visual.tile}
                            title={capability.label}
                            description={capability.description}
                            badge={capability.provider === 'Eleven Nodes' ? undefined : capability.provider}
                            onClick={() => onAddCapability?.(capability.id)}
                          />
                        ))}
                      </LibraryGroup>
                    )
                  })}

                  {showCategory('models') && filteredClients.length > 0 ? (
                    <LibraryGroup view={libraryView} title="Model clients" count={filteredClients.length}>
                      {category === 'models' || resolvedSection === 'models' ? (
                        <p className="px-0.5 pb-1 text-[11px] leading-snug text-muted-foreground">
                          {modelTargetLabel ? (
                            <>
                              Choose the model client for{' '}
                              <span className="font-medium text-foreground">{modelTargetLabel}</span>, or drag one onto any
                              agent.
                            </>
                          ) : (
                            'Click to use on the selected agent, or drag one onto an agent.'
                          )}
                        </p>
                      ) : null}
                      {filteredClients.map((client) => (
                        <ModelClientRow
                          view={libraryView}
                          key={client.id}
                          client={client}
                          active={modelClientRef(client.id) === activeModelProviderId}
                          onPick={onPickModelProvider}
                        />
                      ))}
                    </LibraryGroup>
                  ) : null}

                  {showCategory('flow') && flowBlocks.length > 0 ? (
                    <LibraryGroup view={libraryView} title="Flow" count={flowBlocks.length}>
                      {flowBlocks.map((block) => {
                        const { styles, Icon } = resolveBlockVisual(block)
                        return (
                          <LibraryRow
                            view={libraryView}
                            key={block.id}
                            icon={Icon}
                            tile={cn(styles.icon, styles.ring)}
                            title={block.label}
                            description={block.description}
                            dragPaletteId={block.paletteId}
                            onClick={() => onAddAgent(block.paletteId)}
                          />
                        )
                      })}
                    </LibraryGroup>
                  ) : null}

                  {needle &&
                  libraryOrchestrators.length === 0 &&
                  libraryAgents.length === 0 &&
                  capabilitiesByKind.size === 0 &&
                  filteredClients.length === 0 &&
                  flowBlocks.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Nothing matches “{query.trim()}”.</p>
                  ) : null}
                </div>
              )}

              {resolvedSection === 'store' && (
                <div className="space-y-1.5">
                  {filteredStore.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No agents match.</p>
                  ) : (
                    filteredStore.map((block) => (
                      <ExternalAgentListItem
                        key={block.id}
                        block={block}
                        onAddAgent={onAddAgent}
                        draggable
                      />
                    ))
                  )}
                </div>
              )}

              {resolvedSection === 'import' && (
                <ExternalAgentImportSection
                  onOpenImport={setImportSourceId}
                  collapsed={false}
                  embedded
                />
              )}
            </div>
          </div>
        ) : null}
      </aside>

      <AgentImportDialog
        sourceId={importSourceId}
        open={importSourceId !== null}
        onOpenChange={(open) => {
          if (!open) setImportSourceId(null)
        }}
      />
    </>
  )
})
