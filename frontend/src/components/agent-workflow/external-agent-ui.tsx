import { useMemo, useState } from 'react'
import { Bot, CheckCircle2, Clock, Loader2, Plus, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'
import { DND_MIME } from '@/components/designer/diagram-types'
import { resolveExternalAgent } from '@/components/agent-workflow/agent-workflow-defaults'
import type { ExternalAgentBlock } from '@/components/agent-workflow/agent-workflow-defaults'
import type { AgentType } from '@/types/agent-workflow'

export const TYPE_LABELS: Record<AgentType, string> = {
  llm: 'LLM',
  specialist: 'Specialist',
  tool: 'Tool',
  planner: 'Planner',
  human: 'Human review',
  router: 'Router',
  trigger: 'Trigger',
  memory: 'Memory',
  output: 'Output',
  control: 'Control',
}

const PROVIDER_META: Record<string, { initials: string; avatar: string }> = {
  LangChain: {
    initials: 'LC',
    avatar: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  },
  CrewAI: {
    initials: 'CR',
    avatar: 'bg-orange-500/15 text-orange-700 ring-orange-500/20 dark:text-orange-300',
  },
  Microsoft: {
    initials: 'MS',
    avatar: 'bg-sky-500/15 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  },
  AWS: {
    initials: 'AWS',
    avatar: 'bg-amber-500/15 text-amber-800 ring-amber-500/20 dark:text-amber-300',
  },
  Google: {
    initials: 'G',
    avatar: 'bg-blue-500/15 text-blue-700 ring-blue-500/20 dark:text-blue-300',
  },
  Databricks: {
    initials: 'DB',
    avatar: 'bg-rose-500/15 text-rose-700 ring-rose-500/20 dark:text-rose-300',
  },
  Salesforce: {
    initials: 'SF',
    avatar: 'bg-cyan-500/15 text-cyan-800 ring-cyan-500/20 dark:text-cyan-300',
  },
  OpenAI: {
    initials: 'OA',
    avatar: 'bg-neutral-500/15 text-neutral-800 ring-neutral-500/20 dark:text-neutral-300',
  },
  Anthropic: {
    initials: 'AN',
    avatar: 'bg-orange-500/15 text-orange-800 ring-orange-500/20 dark:text-orange-300',
  },
  LlamaIndex: {
    initials: 'LI',
    avatar: 'bg-violet-500/15 text-violet-700 ring-violet-500/20 dark:text-violet-300',
  },
  'Hugging Face': {
    initials: 'HF',
    avatar: 'bg-yellow-500/15 text-yellow-800 ring-yellow-500/20 dark:text-yellow-300',
  },
}

function providerMeta(provider: string) {
  return (
    PROVIDER_META[provider] ?? {
      initials: provider.slice(0, 2).toUpperCase(),
      avatar: 'bg-muted text-muted-foreground ring-border',
    }
  )
}

export function ProviderLogo({
  block,
  size = 'md',
}: {
  block: Pick<ExternalAgentBlock, 'provider' | 'logo'>
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const [failed, setFailed] = useState(false)
  const meta = providerMeta(block.provider)
  const dimensions =
    size === 'xs'
      ? 'h-7 w-7'
      : size === 'sm'
        ? 'h-5 w-5'
        : size === 'lg'
          ? 'h-11 w-11'
          : 'h-9 w-9'
  const textSize =
    size === 'xs'
      ? 'text-[7px]'
      : size === 'sm'
        ? 'text-[8px]'
        : size === 'lg'
          ? 'text-[11px]'
          : 'text-[10px]'
  const padding = size === 'xs' ? 'p-0.5' : 'p-1'

  if (block.logo && !failed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background',
          padding,
          dimensions,
        )}
      >
        <img
          src={block.logo}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg font-bold ring-1',
        dimensions,
        textSize,
        meta.avatar,
      )}
      aria-hidden
    >
      {meta.initials}
    </div>
  )
}

type AgentNodeAvatarSize = 'xs' | 'md'
type ExecutionAvatarState = 'idle' | 'running' | 'completed' | 'waiting'

export function AgentNodeAvatar({
  paletteId,
  toolNode = false,
  size = 'md',
  executionState,
}: {
  paletteId: string
  toolNode?: boolean
  size?: AgentNodeAvatarSize
  executionState?: ExecutionAvatarState
}) {
  const external = useMemo(() => resolveExternalAgent(paletteId), [paletteId])
  const iconSize = size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  if (toolNode) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-300',
          size === 'xs' ? 'h-7 w-7' : 'h-9 w-9',
        )}
      >
        <Wrench className={iconSize} />
      </div>
    )
  }

  if (executionState === 'running') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15',
          size === 'xs' ? 'h-7 w-7' : 'h-9 w-9',
        )}
      >
        <Loader2 className={cn(iconSize, 'animate-spin')} />
      </div>
    )
  }

  if (executionState === 'completed') {
    return (
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-lg ring-1 ring-emerald-500/20',
          size === 'xs' ? 'h-7 w-7' : 'h-9 w-9',
        )}
      >
        {external?.logo ? (
          <ProviderLogo block={external} size={size === 'xs' ? 'xs' : 'md'} />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-emerald-500/10">
            <CheckCircle2 className={cn(iconSize, 'text-emerald-600 dark:text-emerald-400')} />
          </div>
        )}
        {external?.logo && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-card">
            <CheckCircle2 className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
    )
  }

  if (executionState === 'waiting') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400',
          size === 'xs' ? 'h-7 w-7' : 'h-9 w-9',
        )}
      >
        <Clock className={iconSize} />
      </div>
    )
  }

  if (external) {
    return <ProviderLogo block={external} size={size === 'xs' ? 'xs' : 'md'} />
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/15 dark:text-violet-300',
        size === 'xs' ? 'h-7 w-7' : 'h-9 w-9',
      )}
    >
      <Bot className={size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </div>
  )
}

export function filterExternalAgents(agents: ExternalAgentBlock[], query: string, provider: string) {
  const normalized = query.trim().toLowerCase()
  return agents.filter((block) => {
    if (provider !== 'all' && block.provider !== provider) return false
    if (!normalized) return true
    return (
      block.label.toLowerCase().includes(normalized) ||
      block.provider.toLowerCase().includes(normalized) ||
      block.description.toLowerCase().includes(normalized)
    )
  })
}

export function groupByProvider(agents: ExternalAgentBlock[]) {
  const map = new Map<string, ExternalAgentBlock[]>()
  for (const block of agents) {
    const list = map.get(block.provider) ?? []
    list.push(block)
    map.set(block.provider, list)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export function sidebarPreviewAgents(agents: ExternalAgentBlock[], limit = 3) {
  const featured = agents.filter((agent) => agent.featured)
  if (featured.length >= limit) return featured.slice(0, limit)
  const featuredIds = new Set(featured.map((agent) => agent.id))
  const rest = agents.filter((agent) => !featuredIds.has(agent.id))
  return [...featured, ...rest].slice(0, limit)
}

export function uniqueProviders(agents: ExternalAgentBlock[]) {
  return [...new Set(agents.map((agent) => agent.provider))].sort()
}

export function ExternalAgentListItem({
  block,
  onAddAgent,
  draggable = false,
}: {
  block: ExternalAgentBlock
  onAddAgent: (paletteId: string) => void
  draggable?: boolean
}) {
  const typeLabel = TYPE_LABELS[block.agentType] ?? 'Agent'

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.setData(DND_MIME, block.paletteId)
              event.dataTransfer.effectAllowed = 'copy'
            }
          : undefined
      }
      onClick={() => onAddAgent(block.paletteId)}
      title={`Add ${block.label} · ${block.description}`}
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-left transition-all',
        draggable && 'cursor-grab active:cursor-grabbing',
        'hover:border-border hover:bg-muted/30 hover:shadow-sm',
      )}
    >
      <ProviderLogo block={block} />

      <div className="min-w-0 flex-1 pr-8">
        <p className="truncate text-[13px] font-medium leading-tight text-foreground">
          {block.label}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {block.description}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="h-4 border-0 bg-muted/80 px-1.5 text-[9px] font-normal">
            {typeLabel}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{block.provider}</span>
        </div>
      </div>

      <Plus
        className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40 transition-colors group-hover:text-foreground"
        aria-hidden
      />
    </button>
  )
}

export function AgentStoreCard({
  block,
  onAddAgent,
}: {
  block: ExternalAgentBlock
  onAddAgent: (paletteId: string) => void
}) {
  const typeLabel = TYPE_LABELS[block.agentType] ?? 'Agent'

  return (
    <button
      type="button"
      onClick={() => onAddAgent(block.paletteId)}
      className={cn(
        'group flex h-full flex-col rounded-xl border border-border/70 bg-card p-4 text-left transition-all',
        'hover:border-border hover:bg-muted/20 hover:shadow-sm',
      )}
    >
      <div className="flex items-start gap-3">
        <ProviderLogo block={block} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{block.label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{block.provider}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
        {block.description}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant="outline" className="h-5 border-0 bg-muted/80 text-[10px] font-normal">
          {typeLabel}
        </Badge>
        <span className="text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Add to canvas
        </span>
      </div>
    </button>
  )
}

export function useAgentCatalogFilters(agents: ExternalAgentBlock[]) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('all')

  const providers = useMemo(() => uniqueProviders(agents), [agents])

  const filtered = useMemo(
    () => filterExternalAgents(agents, query, provider),
    [agents, query, provider],
  )

  const grouped = useMemo(() => groupByProvider(filtered), [filtered])

  return { query, setQuery, provider, setProvider, providers, filtered, grouped }
}
