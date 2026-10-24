import { useState } from 'react'
import { KeyRound, Pencil, Plus, ServerCog, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ListSkeleton, PageIntro } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { Section } from '@/components/agent-workflow/dashboard/activity-ui'
import { formatWhen } from '@/components/agent-workflow/dashboard/dashboard-format'
import { ModelConnectionDialog, CONNECTION_PROVIDERS } from '@/components/agent-workflow/ModelConnectionDialog'
import { ModelLogo } from '@/components/agent-workflow/model-providers'
import { useModelConnections } from '@/components/agent-workflow/hooks/use-model-connections'
import type { ModelConnection } from '@/services/model-connections-api'

/**
 * The user's own models: saved connections (endpoint, key, model) that any agent can then run on
 * from its Model tab. Keys go to the server once and are never shown again.
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

  return (
    <div>
      <PageIntro
        eyebrow="Models"
        title="Your models"
        description="Connect your own model (your endpoint, key and model) once here, then pick it in any agent’s Model tab."
        actions={
          <Button type="button" size="sm" onClick={() => open(null)} disabled={unavailable || status === 'loading'}>
            <Plus className="size-3.5" />
            Add model
          </Button>
        }
      />

      {unavailable ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
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
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center transition-colors hover:border-foreground/30 hover:bg-card"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-b from-muted to-muted/40 ring-1 ring-inset ring-border/70">
            <Plus className="size-5 text-muted-foreground" />
          </span>
          <span className="text-sm font-medium text-foreground">Add your first model</span>
          <span className="max-w-sm text-xs text-muted-foreground">
            OpenAI, Azure OpenAI, Anthropic, Gemini, Mistral, Groq, Ollama or any OpenAI-compatible endpoint.
          </span>
        </button>
      ) : (
        <Section title={`${connections.length} model${connections.length === 1 ? '' : 's'}`}>
          <div className="-mx-5 -mb-5 divide-y divide-border/70 border-t border-border/70">
            {connections.map((connection) => (
              <div key={connection.id} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40">
                <ModelLogo hints={[connection.providerType, connection.model]} className="size-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{connection.name}</span>
                    <span className="rounded border border-border/70 bg-muted/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                      {CONNECTION_PROVIDERS.find((item) => item.value === connection.providerType)?.label ??
                        connection.providerType}
                    </span>
                    {connection.scope === 'workspace' ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
                        <Users className="size-3" /> Workspace
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {connection.model}
                    {connection.endpoint ? ` · ${connection.endpoint}` : ''}
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
                <div className="flex shrink-0 gap-1">
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
      )}

      <ModelConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} connection={editing} onSave={save} />
    </div>
  )
}
