import { useState } from 'react'
import { KeyRound, Pencil, Plus, ServerCog, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ListSkeleton, PageIntro } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { Section } from '@/components/agent-workflow/dashboard/activity-ui'
import { formatWhen } from '@/components/agent-workflow/dashboard/dashboard-format'
import { ModelConnectionDialog, CONNECTION_PROVIDERS, ModelOwnerBadge } from '@/components/agent-workflow/ModelConnectionDialog'
import { ModelLogo } from '@/components/agent-workflow/model-providers'
import { useModelConnections } from '@/components/agent-workflow/hooks/use-model-connections'
import type { ModelConnection } from '@/services/model-connections-api'

/**
 * Models: the user's own model clients (endpoint, key, model), then the admin's for the
 * application (read-only). Any agent can run on either from its Model tab. Keys go to the
 * server once and are never shown again.
 */
export default function ModelsTab() {
  const { connections, status, error, reload, save, remove } = useModelConnections()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ModelConnection | null>(null)

  const open = (connection: ModelConnection | null) => {
    setEditing(connection)
    setDialogOpen(true)
  }

  const handleDelete = async (connection: ModelConnection) => {
    if (!window.confirm(`Delete “${connection.name}”? Agents using it will need another model.`)) return
    try {
      await remove(connection.id)
      toast.success('Connection deleted')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the connection.')
    }
  }

  const unavailable = status === 'unavailable'
  const own = connections.filter((connection) => connection.scope !== 'application')
  const admins = connections.filter((connection) => connection.scope === 'application')

  return (
    <div>
      <PageIntro
        eyebrow="Models"
        title="Models"
        description="Your own models (your endpoint, key and model) and the models available to everyone. Pick either in any agent’s Model tab."
        actions={
          <Button type="button" size="sm" onClick={() => open(null)} disabled={unavailable || status === 'loading'}>
            <Plus className="size-3.5" />
            Add model
          </Button>
        }
      />

      {unavailable ? (
        <div className="flex flex-col items-center gap-2 rounded-[3px] border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <ServerCog className="size-7 text-muted-foreground/70" />
          <p className="text-sm font-medium text-foreground">Not available on this server yet</p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Saved model connections need the server’s <span className="font-mono">/api/v1/models/connections</span>{' '}
            API. Until then, agents use the model clients your admin configured.
          </p>
        </div>
      ) : status === 'error' ? (
        <p className="text-sm text-destructive">
          {error}{' '}
          <button type="button" onClick={() => void reload()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </p>
      ) : status === 'loading' && connections.length === 0 ? (
        <ListSkeleton />
      ) : connections.length === 0 ? (
        <button
          type="button"
          onClick={() => open(null)}
          className="flex w-full flex-col items-center gap-2 rounded-[3px] border border-dashed border-border bg-card/50 px-6 py-14 text-center transition-colors hover:border-foreground/30 hover:bg-card"
        >
          <span className="flex size-11 items-center justify-center rounded-[3px] bg-gradient-to-b from-muted to-muted/40 ring-1 ring-inset ring-border/70">
            <Plus className="size-5 text-muted-foreground" />
          </span>
          <span className="text-sm font-medium text-foreground">Add your first model</span>
          <span className="max-w-sm text-xs text-muted-foreground">
            OpenAI, Azure OpenAI, Anthropic, Gemini, Mistral, Groq, Ollama or any OpenAI-compatible endpoint.
          </span>
        </button>
      ) : (
        <>
          {[
            { title: 'Your models', hint: 'Added by you — only you can use them.', items: own },
            { title: 'Available models', hint: 'Ready to use in any agent.', items: admins },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <Section key={group.title} title={`${group.title} · ${group.items.length}`} className="mb-5">
                <p className="-mt-2 mb-3 text-[11.5px] text-muted-foreground">{group.hint}</p>
                <div className="-mx-3 -mb-2.5 divide-y divide-border/70 border-t border-border/70">
                  {group.items.map((connection) => (
              <div key={connection.id} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40">
                <ModelLogo hints={[connection.providerType, connection.model]} className="size-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{connection.name}</span>
                    <span className="rounded border border-border/70 bg-muted/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                      {CONNECTION_PROVIDERS.find((item) => item.value === connection.providerType)?.label ??
                        connection.providerType}
                    </span>
                    <ModelOwnerBadge connection={connection} />
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {connection.model}
                    {connection.endpointVariable
                      ? ` · ${connection.endpointVariable}`
                      : connection.endpoint
                        ? ` · ${connection.endpoint}`
                        : ''}
                  </p>
                </div>
                <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
                  <KeyRound className="size-3" />
                  {connection.apiKeyVariable ? (
                    <span className="font-mono">{connection.apiKeyVariable}</span>
                  ) : connection.hasApiKey ? (
                    'Key saved'
                  ) : (
                    'No key'
                  )}
                </span>
                <span className="hidden w-28 text-right text-[11px] text-muted-foreground md:block">
                  {formatWhen(connection.updatedAt)}
                </span>
                {/* The admin's model clients are offered to everyone, read-only. */}
                <div className={connection.scope === 'application' ? 'invisible flex shrink-0 gap-1' : 'flex shrink-0 gap-1'}>
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => open(connection)} aria-label={`Edit ${connection.name}`}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-destructive"
                    onClick={() => void handleDelete(connection)}
                    aria-label={`Delete ${connection.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
                  ))}
                </div>
              </Section>
            ))}
        </>
      )}

      <ModelConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} connection={editing} onSave={save} />
    </div>
  )
}
