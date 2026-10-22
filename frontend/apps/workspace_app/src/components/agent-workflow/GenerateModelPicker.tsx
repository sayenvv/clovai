import { memo, useCallback, useState } from 'react'
import { Check, ChevronDown, Cpu, HardDrive, Loader2, RefreshCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fetchOllamaModels, type LocalModel } from '@/services/models-api'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'
import { cn } from '@/utils/cn'

interface GenerateModelPickerProps {
  value: GenerateWorkflowModel
  onChange: (value: GenerateWorkflowModel) => void
  serverModel: string
  serverConfigured: boolean
  ollamaBaseUrl: string
  disabled?: boolean
}

/** Compact model switcher for the Generate composer: server LLM or a local Ollama model. */
export const GenerateModelPicker = memo(function GenerateModelPicker({
  value,
  onChange,
  serverModel,
  serverConfigured,
  ollamaBaseUrl,
  disabled = false,
}: GenerateModelPickerProps) {
  const [localModels, setLocalModels] = useState<LocalModel[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLocalModels = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchOllamaModels(ollamaBaseUrl)
      .then(setLocalModels)
      .catch((reason: unknown) => {
        setLocalModels([])
        setError(reason instanceof Error ? reason.message : 'Could not reach Ollama.')
      })
      .finally(() => setLoading(false))
  }, [ollamaBaseUrl])

  const label = value.provider === 'ollama' ? value.model : serverModel

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && localModels === null && !loading) loadLocalModels()
      }}
    >
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 max-w-[11rem] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground',
            'transition-colors hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-muted data-[state=open]:text-foreground',
          )}
          aria-label={`Model: ${label}`}
          title={`Model: ${label}`}
        >
          {value.provider === 'ollama' ? (
            <HardDrive className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Cpu className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Server</DropdownMenuLabel>
        <ModelItem
          name={serverModel}
          detail={serverConfigured ? 'Configured on the API server' : 'Not configured · drafts from templates'}
          selected={value.provider === 'server'}
          onSelect={() => onChange({ provider: 'server' })}
        />

        <DropdownMenuSeparator />
        <div className="flex items-center justify-between pr-1">
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
            Local · Ollama
          </DropdownMenuLabel>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.preventDefault()
              loadLocalModels()
            }}
            aria-label="Refresh local models"
            title="Refresh local models"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && localModels === null ? (
          <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Looking for models…
          </p>
        ) : error ? (
          <p className="px-2 py-1.5 text-xs leading-snug text-muted-foreground">
            Ollama isn't reachable at {ollamaBaseUrl}.
          </p>
        ) : localModels && localModels.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No local models installed.</p>
        ) : (
          localModels?.map((model) => (
            <ModelItem
              key={model.name}
              name={model.name}
              detail={[model.parameterSize, model.family].filter(Boolean).join(' · ') || undefined}
              selected={value.provider === 'ollama' && value.model === model.name}
              onSelect={() =>
                onChange({ provider: 'ollama', model: model.name, baseUrl: ollamaBaseUrl })
              }
            />
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

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
        {detail ? (
          <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
        ) : null}
      </span>
    </DropdownMenuItem>
  )
}
