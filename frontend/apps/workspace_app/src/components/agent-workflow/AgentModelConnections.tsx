import { memo, useState } from 'react'
import { ArrowRight, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/constants'
import { cn } from '@/utils/cn'
import { Field } from '@/components/agent-workflow/FormField'
import { ModelConnectionDialog, ModelOwnerBadge } from '@/components/agent-workflow/ModelConnectionDialog'
import { ModelLogo } from '@/components/agent-workflow/model-providers'
import { useModelConnections } from '@/components/agent-workflow/hooks/use-model-connections'
import type { ModelConnection } from '@/services/model-connections-api'

/**
 * "Models" in an agent's Model tab: the user's own model clients, then the admin's (read-only),
 * each marked Yours or Admin. Picking one runs the agent on it.
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
    <Field label="Models" hint="Yours are marked; manage them in Dashboard → Models">
      {status === 'unavailable' ? (
        <p className="rounded-[3px] border border-dashed border-border px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          Model clients appear here once they’re added in Admin center → Model clients, or as your own in Dashboard → Models. Until then the agent runs on the workflow’s model.
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
          {/* Yours first, then the admin's. */}
          {[...connections]
            .sort((a, b) => Number(a.scope === 'application') - Number(b.scope === 'application'))
            .map((connection) => {
            const selected = connection.id === selectedId
            return (
              <div
                key={connection.id}
                className={cn(
                  'group flex items-center gap-2.5 rounded-[3px] border px-2.5 py-2 transition-colors',
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
                      <ModelOwnerBadge connection={connection} />
                    </span>
                    <span className="block truncate font-mono text-[10.5px] text-muted-foreground">
                      {connection.model}
                      {connection.endpointVariable
                        ? ` · ${connection.endpointVariable}`
                        : connection.endpoint
                          ? ` · ${connection.endpoint.replace(/^https?:\/\//, '')}`
                          : ''}
                    </span>
                  </span>
                  {selected ? <Check className="size-3.5 shrink-0" /> : null}
                </button>
                {/* The admin's model clients are offered to everyone, read-only. */}
                <span
                  className={cn(
                    'flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                    connection.scope === 'application' && 'hidden',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(connection)
                      setDialogOpen(true)
                    }}
                    aria-label={`Edit ${connection.name}`}
                    className="flex size-6 items-center justify-center rounded-[2px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(connection)}
                    aria-label={`Delete ${connection.name}`}
                    className="flex size-6 items-center justify-center rounded-[2px] text-muted-foreground hover:bg-muted hover:text-destructive"
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
            className="flex w-full items-center justify-center gap-1.5 rounded-[3px] border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            {status === 'loading' ? 'Loading your models…' : 'Add your own model'}
          </button>
        </div>
      )}

      <Link
        to={ROUTES.workspaceSettings('models')}
        className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Manage your models in Dashboard
        <ArrowRight className="size-3" />
      </Link>

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
