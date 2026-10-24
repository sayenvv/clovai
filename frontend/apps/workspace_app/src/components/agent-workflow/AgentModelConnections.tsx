import { memo, useState } from 'react'
import { ArrowUpRight, Check, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { DASHBOARD_TAB_LINK, ROUTES } from '@/constants'
import { cn } from '@/utils/cn'
import { Field } from '@/components/agent-workflow/FormField'
import { ModelConnectionDialog } from '@/components/agent-workflow/ModelConnectionDialog'
import { ModelLogo } from '@/components/agent-workflow/model-providers'
import { useModelConnections } from '@/components/agent-workflow/hooks/use-model-connections'
import type { ModelConnection } from '@/services/model-connections-api'

/**
 * "My models" in an agent's Model tab: the user's saved connections (own endpoint, key and model).
 * Picking one runs the agent on it; the admin's catalog stays below as the alternative.
 */
export const AgentModelConnections = memo(function AgentModelConnections({
  selectedId,
  onSelect,
}: {
  selectedId: string | undefined
  /** A connection was picked (or cleared with `null`). */
  onSelect: (connection: ModelConnection | null) => void
}) {
  const { connections, status, error, reload, save, remove } = useModelConnections()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ModelConnection | null>(null)

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleDelete = async (connection: ModelConnection) => {
    if (!window.confirm(`Delete “${connection.name}”? Agents using it will need another model.`)) return
    try {
      await remove(connection.id)
      if (connection.id === selectedId) onSelect(null)
      toast.success('Connection deleted')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the connection.')
    }
  }

  return (
    <Field label="My models" hint="Your own models, managed in Dashboard → Models">
      {status === 'unavailable' ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          Your own models will appear here once they’re added. For now, use a model client from the catalog below.
        </p>
      ) : status === 'error' ? (
        <p className="text-xs text-destructive">
          {error}{' '}
          <button type="button" onClick={() => void reload()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </p>
      ) : (
        <div className="space-y-1.5">
          {connections.map((connection) => {
            const selected = connection.id === selectedId
            return (
              <div
                key={connection.id}
                className={cn(
                  'group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
                  selected ? 'border-foreground/50 bg-accent' : 'border-border hover:border-foreground/25',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(selected ? null : connection)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  aria-pressed={selected}
                >
                  <ModelLogo hints={[connection.providerType, connection.model]} className="size-6" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-foreground">{connection.name}</span>
                      {connection.scope === 'workspace' ? (
                        <Users className="size-3 shrink-0 text-muted-foreground" aria-label="Shared with the workspace" />
                      ) : null}
                    </span>
                    <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
                      {connection.model}
                      {connection.endpoint ? ` · ${connection.endpoint.replace(/^https?:\/\//, '')}` : ''}
                    </span>
                  </span>
                  {selected ? <Check className="size-3.5 shrink-0" /> : null}
                </button>
                <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(connection)
                      setDialogOpen(true)
                    }}
                    aria-label={`Edit ${connection.name}`}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(connection)}
                    aria-label={`Delete ${connection.name}`}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </span>
              </div>
            )
          })}
          <button
            type="button"
            onClick={openAdd}
            disabled={status === 'loading'}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {status === 'loading' ? 'Loading your models…' : 'Add your own model'}
          </button>
        </div>
      )}

      <a
        href={`${ROUTES.dashboard}?tab=models`}
        {...DASHBOARD_TAB_LINK}
        className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Manage your models in Dashboard
        <ArrowUpRight className="size-3" />
      </a>

      <ModelConnectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connection={editing}
        onSave={async (input, id) => {
          const saved = await save(input, id)
          // A new connection is put to use right away.
          if (!id) onSelect(saved)
          return saved
        }}
      />
    </Field>
  )
})
