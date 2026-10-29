import { memo, useCallback, useState } from 'react'
import { Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { listModelConnections, ConnectionsUnavailableError, type ModelConnection } from '@/services/model-connections-api'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import { cn } from '@/utils/cn'
import { ModelLogo } from '@/components/agent-workflow/model-providers'
import { CONNECTION_PROVIDERS } from '@/components/agent-workflow/ModelConnectionDialog'

interface GenerateModelPickerProps {
  value: GenerateWorkflowModel
  onChange: (value: GenerateWorkflowModel) => void
  /** Shown for the default choice. */
  serverModel: string
  serverConfigured: boolean
  /** Kept for callers; the list is the saved model clients. */
  ollamaBaseUrl?: string
  disabled?: boolean
}

/**
 * Model switcher for the Workflow AI composer. Lists only the admin's model clients for this
 * application (Admin center → Model clients); users' own models are for running their own
 * workflows, not the assistant. "Default" runs on the application's default model.
 */
export const GenerateModelPicker = memo(function GenerateModelPicker({
  value,
  onChange,
  serverModel,
  disabled = false,
}: GenerateModelPickerProps) {
  const [clients, setClients] = useState<ModelConnection[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listModelConnections()
      .then(setClients)
      .catch((reason: unknown) =>
        setError(
          reason instanceof ConnectionsUnavailableError
            ? reason.message
            : reason instanceof Error
              ? reason.message
              : 'Could not load models.',
        ),
      )
      .finally(() => setLoading(false))
  }, [])

  const label = value.provider === 'client' || value.provider === 'catalog' ? value.label : value.provider === 'ollama' ? value.model : 'Default'
  const triggerHints =
    value.provider === 'client' ? [value.providerType, value.model] : value.provider === 'ollama' ? ['ollama'] : [serverModel]
  const admins = (clients ?? []).filter((client) => client.scope === 'application')
  const fallback = admins.find((client) => client.isDefault)

  const group = (title: string, items: ModelConnection[]) =>
    items.length === 0 ? null : (
      <div key={title}>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">{title}</DropdownMenuLabel>
        {items.map((client) => (
          <ModelItem
            key={client.id}
            name={client.name}
            detail={`${CONNECTION_PROVIDERS.find((item) => item.value === client.providerType)?.label ?? client.providerType} · ${client.model}`}
            hints={[client.providerType, client.model]}
            selected={value.provider === 'client' && value.connectionId === client.id}
            onSelect={() =>
              onChange({
                provider: 'client',
                connectionId: client.id,
                label: client.name,
                providerType: client.providerType,
                model: client.model,
              })
            }
          />
        ))}
      </div>
    )

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && clients === null && !loading) load()
      }}
    >
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 max-w-[12rem] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground',
            'transition-colors hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-muted data-[state=open]:text-foreground',
          )}
          aria-label={`Model: ${label}`}
          title={`Model: ${label}`}
        >
          <ModelLogo hints={triggerHints} className="h-4 w-4" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="max-h-[22rem] w-72 overflow-y-auto">
        <div className="flex items-center justify-between pr-1">
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Default</DropdownMenuLabel>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.preventDefault()
              load()
            }}
            aria-label="Refresh models"
            title="Refresh models"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>
        <ModelItem
          name="Default"
          detail={fallback ? `${fallback.name} · ${fallback.model}` : "The application's default model"}
          hints={fallback ? [fallback.providerType, fallback.model] : [serverModel]}
          selected={value.provider !== 'client'}
          onSelect={() => onChange({ provider: 'server' })}
        />

        {loading && clients === null ? (
          <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading models…
          </p>
        ) : error ? (
          <p className="px-2 py-1.5 text-xs leading-snug text-destructive">{error}</p>
        ) : clients && admins.length === 0 ? (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs leading-snug text-muted-foreground">
              No models yet. An admin adds them in Admin center → Model clients.
            </p>
          </>
        ) : (
          group('Models', admins)
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

function ModelItem({
  name,
  detail,
  hints,
  selected,
  onSelect,
}: {
  name: string
  detail?: string
  /** Provider and model names, for the provider's logo. */
  hints: Array<string | undefined>
  selected: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start py-1.5">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center pt-0.5">
        {selected ? <Check className="h-3.5 w-3.5 !text-foreground" /> : null}
      </span>
      <ModelLogo hints={hints} className="mt-0.5 h-4 w-4" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-foreground">{name}</span>
        {detail ? <span className="block truncate text-[11px] text-muted-foreground">{detail}</span> : null}
      </span>
    </DropdownMenuItem>
  )
}
