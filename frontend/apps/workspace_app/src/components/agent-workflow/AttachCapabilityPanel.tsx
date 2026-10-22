import { memo, useEffect, useMemo, useState } from 'react'
import { Brain, Link2, Plug, Search, Sparkles, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CatalogEmptyState, CatalogFilterChip } from '@/components/agent-workflow/workflow-ui'
import {
  AGENT_CAPABILITIES,
  type AgentCapability,
  type AgentCapabilityKind,
} from '@/components/agent-workflow/agent-capabilities'
import { cn } from '@/utils/cn'

const KIND_META: Record<
  AgentCapabilityKind,
  { label: string; icon: typeof Wrench; accent: string }
> = {
  tool: { label: 'Tools', icon: Wrench, accent: 'text-sky-600 dark:text-sky-300' },
  skill: { label: 'Knowledge', icon: Sparkles, accent: 'text-violet-600 dark:text-violet-300' },
  integration: { label: 'Integrations', icon: Link2, accent: 'text-amber-600 dark:text-amber-300' },
  mcp: { label: 'MCP', icon: Plug, accent: 'text-emerald-600 dark:text-emerald-300' },
  memory: { label: 'Memory', icon: Brain, accent: 'text-teal-600 dark:text-teal-300' },
}

interface AttachCapabilityPanelProps {
  agentLabel: string
  initialKind?: AgentCapabilityKind
  attachedIds?: string[]
  onAttach: (capability: AgentCapability) => void
  onClose: () => void
}

/** Right-sidebar picker for attaching tools / memory / knowledge to an agent. */
export const AttachCapabilityPanel = memo(function AttachCapabilityPanel({
  agentLabel,
  initialKind = 'tool',
  attachedIds = [],
  onAttach,
  onClose,
}: AttachCapabilityPanelProps) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<AgentCapabilityKind | 'all'>(initialKind)
  const attached = useMemo(() => new Set(attachedIds), [attachedIds])

  useEffect(() => {
    setKind(initialKind)
    setQuery('')
  }, [initialKind, agentLabel])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return AGENT_CAPABILITIES.filter((item) => {
      if (kind !== 'all' && item.kind !== kind) return false
      if (!needle) return true
      return (
        item.label.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        item.id.toLowerCase().includes(needle) ||
        item.provider.toLowerCase().includes(needle)
      )
    })
  }, [kind, query])

  const kindTitle =
    kind === 'all' ? 'capabilities' : KIND_META[kind]?.label.toLowerCase() ?? 'capabilities'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2.5 border-b border-border/60 px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          Select {kindTitle} to map under {agentLabel}
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            className="h-8 pl-8 text-xs"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CatalogFilterChip active={kind === 'all'} onClick={() => setKind('all')}>
            All
          </CatalogFilterChip>
          {(Object.keys(KIND_META) as AgentCapabilityKind[]).map((value) => (
            <CatalogFilterChip key={value} active={kind === value} onClick={() => setKind(value)}>
              {KIND_META[value].label}
            </CatalogFilterChip>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <CatalogEmptyState message="No capabilities match." />
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const meta = KIND_META[item.kind]
              const Icon = meta.icon
              const already = attached.has(item.id)
              return (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-xl border bg-card/80 p-3 transition-colors',
                    already
                      ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                      : 'border-border/70 hover:border-border',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50',
                        meta.accent,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[12px] font-semibold tracking-tight">{item.label}</p>
                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                          {item.badge}
                        </Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                        {item.description}
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                        {item.provider} · {meta.label}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      disabled={already}
                      className={cn(
                        'h-7 px-3 text-[11px]',
                        already
                          ? 'bg-emerald-600/80 text-white'
                          : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
                      )}
                      onClick={() => onAttach(item)}
                    >
                      {already ? 'Attached' : 'Add'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border/60 px-4 py-2">
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {filtered.length} available
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
})
