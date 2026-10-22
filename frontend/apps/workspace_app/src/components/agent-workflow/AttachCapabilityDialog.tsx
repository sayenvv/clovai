import { memo, useEffect, useMemo, useState } from 'react'
import { Link2, Plug, Sparkles, Wrench, Brain } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CatalogDialogShell } from '@/components/agent-workflow/CatalogDialogShell'
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
  skill: { label: 'Skills', icon: Sparkles, accent: 'text-violet-600 dark:text-violet-300' },
  integration: { label: 'Integrations', icon: Link2, accent: 'text-amber-600 dark:text-amber-300' },
  mcp: { label: 'MCP', icon: Plug, accent: 'text-emerald-600 dark:text-emerald-300' },
  memory: { label: 'Memory', icon: Brain, accent: 'text-teal-600 dark:text-teal-300' },
}

interface AttachCapabilityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentLabel: string
  initialKind?: AgentCapabilityKind
  attachedIds?: string[]
  onAttach: (capability: AgentCapability) => void
}

export const AttachCapabilityDialog = memo(function AttachCapabilityDialog({
  open,
  onOpenChange,
  agentLabel,
  initialKind = 'tool',
  attachedIds = [],
  onAttach,
}: AttachCapabilityDialogProps) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<AgentCapabilityKind | 'all'>(initialKind)
  const attached = useMemo(() => new Set(attachedIds), [attachedIds])

  useEffect(() => {
    if (open) {
      setKind(initialKind)
      setQuery('')
    }
  }, [open, initialKind])

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

  return (
    <CatalogDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={<Sparkles className="h-5 w-5" />}
      title={`Equip ${agentLabel}`}
      description="Attach tools, skills, memory, MCP, or integrations as child nodes under this agent."
      count={filtered.length}
      countLabel="capabilities"
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="Search tools, skills, memory, or integrations…"
      filters={
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
      }
    >
      {filtered.length === 0 ? (
        <CatalogEmptyState message="No capabilities match. Try another search or category." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((item) => {
            const meta = KIND_META[item.kind]
            const Icon = meta.icon
            const already = attached.has(item.id)
            return (
              <div
                key={item.id}
                className={cn(
                  'flex flex-col rounded-xl border bg-card/80 p-3 transition-colors',
                  already ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-border/70 hover:border-red-400/40',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50',
                      meta.accent,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[13px] font-semibold tracking-tight">{item.label}</p>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[9px]">
                        {item.badge}
                      </Badge>
                      {item.featured && (
                        <Badge variant="outline" className="h-5 border-amber-400/40 px-1.5 text-[9px] text-amber-700 dark:text-amber-300">
                          Featured
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {item.provider} · {meta.label}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
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
                    onClick={() => {
                      onAttach(item)
                      onOpenChange(false)
                    }}
                  >
                    {already ? 'Attached' : 'Add'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </CatalogDialogShell>
  )
})
