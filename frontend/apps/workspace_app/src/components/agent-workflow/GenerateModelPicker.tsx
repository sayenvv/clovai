import { memo, useCallback, useState } from 'react'
import { Check, ChevronDown, Cpu, Loader2, RefreshCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fetchModelCatalog, type ModelCatalog } from '@/services/models-api'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import { cn } from '@/utils/cn'

interface GenerateModelPickerProps {
  value: GenerateWorkflowModel
  onChange: (value: GenerateWorkflowModel) => void
  /** Shown for the default choice until the catalog has loaded. */
  serverModel: string
  serverConfigured: boolean
  /** Kept for callers; models now come from the application's model catalog. */
  ollamaBaseUrl?: string
  disabled?: boolean
}

/**
 * Model switcher for the Workflow AI composer. Lists the application's model catalog
 * (Admin center → Configuration → System → models): every provider with its models,
 * including the models installed on discover providers such as Ollama.
 */
export const GenerateModelPicker = memo(function GenerateModelPicker({
  value,
  onChange,
  serverModel,
  disabled = false,
}: GenerateModelPickerProps) {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchModelCatalog()
      .then(setCatalog)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load models.'))
      .finally(() => setLoading(false))
  }, [])

  const defaultLabel = defaultModelLabel(catalog) ?? serverModel
  const label =
    value.provider === 'catalog' ? value.label : value.provider === 'ollama' ? value.model : defaultLabel

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && catalog === null && !loading) load()
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
          <Cpu className="h-3.5 w-3.5 shrink-0" />
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
          name={defaultLabel}
          detail="The application's default model"
          selected={value.provider === 'server'}
          onSelect={() => onChange({ provider: 'server' })}
        />

        {loading && catalog === null ? (
          <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading models…
          </p>
        ) : error ? (
          <p className="px-2 py-1.5 text-xs leading-snug text-destructive">{error}</p>
        ) : (
          catalog?.providers.map((provider) => (
            <div key={provider.id}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">{provider.label}</DropdownMenuLabel>
              {provider.error ? (
                <p className="px-2 py-1.5 text-xs leading-snug text-muted-foreground">{provider.error}</p>
              ) : provider.models.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No models.</p>
              ) : (
                provider.models.map((model) => (
                  <ModelItem
                    key={model.id}
                    name={model.label}
                    detail={modelDetail(model)}
                    selected={isSelected(value, provider.id, model.id)}
                    onSelect={() =>
                      onChange({ provider: 'catalog', providerId: provider.id, modelId: model.id, label: model.label })
                    }
                  />
                ))
              )}
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

function defaultModelLabel(catalog: ModelCatalog | null): string | undefined {
  const { provider, modelId } = catalog?.default ?? {}
  const found = catalog?.providers.find((item) => item.id === provider)?.models.find((model) => model.id === modelId)
  return found?.label ?? modelId
}

function isSelected(value: GenerateWorkflowModel, providerId: string, modelId: string): boolean {
  if (value.provider === 'catalog') return value.providerId === providerId && value.modelId === modelId
  // An older saved Ollama choice matches the same model in the catalog's ollama provider.
  return value.provider === 'ollama' && providerId === 'ollama' && value.model === modelId
}

function modelDetail(model: { detail?: string; maxTokens?: number; supportsTools?: boolean }): string | undefined {
  const parts = [
    model.detail,
    model.maxTokens ? `${Math.round(model.maxTokens / 1000)}k tokens` : undefined,
    model.supportsTools ? 'tools' : undefined,
  ]
  return parts.filter(Boolean).join(' · ') || undefined
}

function ModelItem({
  name,
  detail,
  selected,
  onSelect,
}: {
  name: string
  detail?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start py-1.5">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center pt-0.5">
        {selected ? <Check className="h-3.5 w-3.5 !text-foreground" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-foreground">{name}</span>
        {detail ? <span className="block truncate text-[11px] text-muted-foreground">{detail}</span> : null}
      </span>
    </DropdownMenuItem>
  )
}
