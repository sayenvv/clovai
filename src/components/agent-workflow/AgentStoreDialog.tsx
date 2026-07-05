import { memo } from 'react'
import { Search, Store } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'
import { EXTERNAL_AGENT_BLOCKS } from '@/components/agent-workflow/agent-workflow-defaults'
import {
  AgentStoreCard,
  useAgentCatalogFilters,
} from '@/components/agent-workflow/external-agent-ui'

interface AgentStoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddAgent: (paletteId: string) => void
}

export const AgentStoreDialog = memo(function AgentStoreDialog({
  open,
  onOpenChange,
  onAddAgent,
}: AgentStoreDialogProps) {
  const { query, setQuery, provider, setProvider, providers, filtered } =
    useAgentCatalogFilters(EXTERNAL_AGENT_BLOCKS)

  const handleAdd = (paletteId: string) => {
    onAddAgent(paletteId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <DialogTitle>Agent store</DialogTitle>
              <DialogDescription className="mt-1">
                Browse third-party agent integrations and add them to your workflow.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {EXTERNAL_AGENT_BLOCKS.length} agents
            </Badge>
          </div>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-border px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by agent, provider, or capability…"
              className="h-9 pl-9"
              aria-label="Search agent store"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={provider === 'all'} onClick={() => setProvider('all')}>
              All providers
            </FilterChip>
            {providers.map((name) => (
              <FilterChip
                key={name}
                active={provider === name}
                onClick={() => setProvider(name)}
              >
                {name}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
              No agents match your search.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((block) => (
                <AgentStoreCard key={block.id} block={block} onAddAgent={handleAdd} />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-6 py-3">
          <p className="text-center text-[11px] text-muted-foreground">
            Showing {filtered.length} of {EXTERNAL_AGENT_BLOCKS.length} integrations
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
})

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      className={cn('h-7 rounded-full px-3 text-xs', !active && 'bg-background')}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
