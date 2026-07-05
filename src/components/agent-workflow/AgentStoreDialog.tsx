import { memo } from 'react'
import { Store } from 'lucide-react'
import { EXTERNAL_AGENT_BLOCKS } from '@/components/agent-workflow/agent-workflow-defaults'
import { CatalogDialogShell } from '@/components/agent-workflow/CatalogDialogShell'
import {
  AgentStoreCard,
  useAgentCatalogFilters,
} from '@/components/agent-workflow/external-agent-ui'
import { CatalogEmptyState, CatalogFilterChip } from '@/components/agent-workflow/workflow-ui'

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
    <CatalogDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={<Store className="h-5 w-5" />}
      title="Agent store"
      description="Browse third-party agent integrations and add them to your workflow."
      count={EXTERNAL_AGENT_BLOCKS.length}
      countLabel="agents"
      query={query}
      onQueryChange={setQuery}
      searchPlaceholder="Search by agent, provider, or capability…"
      filters={
        <div className="flex flex-wrap gap-1.5">
          <CatalogFilterChip active={provider === 'all'} onClick={() => setProvider('all')}>
            All providers
          </CatalogFilterChip>
          {providers.map((name) => (
            <CatalogFilterChip
              key={name}
              active={provider === name}
              onClick={() => setProvider(name)}
            >
              {name}
            </CatalogFilterChip>
          ))}
        </div>
      }
    >
      {filtered.length === 0 ? (
        <CatalogEmptyState message="No agents match your search." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((block) => (
            <AgentStoreCard key={block.id} block={block} onAddAgent={handleAdd} />
          ))}
        </div>
      )}
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-center text-[11px] text-muted-foreground">
          Showing {filtered.length} of {EXTERNAL_AGENT_BLOCKS.length} integrations
        </p>
      </div>
    </CatalogDialogShell>
  )
})
