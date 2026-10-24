import { memo } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/utils/cn'
import { isLocalModel } from '@/components/agent-workflow/workflow-model-config'
import { ModelLogo, providerFromHints } from '@/components/agent-workflow/model-providers'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

interface ServerLlmModelIndicatorProps {
  modelConfig: WorkflowModelConfig
  configured: boolean
  isLoading?: boolean
  className?: string
  /** Compact single-line layout for toolbars. */
  variant?: 'default' | 'compact'
}

/** Read-only navbar indicator for the server-managed LLM configuration. */
export const ServerLlmModelIndicator = memo(function ServerLlmModelIndicator({
  modelConfig,
  configured,
  isLoading = false,
  className,
  variant = 'default',
}: ServerLlmModelIndicatorProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'inline-flex h-7 items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-2.5',
          className,
        )}
        aria-hidden
      >
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading model…</span>
      </div>
    )
  }

  const compact = variant === 'compact'
  const local = isLocalModel(modelConfig)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex shrink-0 items-center gap-2 rounded-md border',
            compact ? 'h-7 px-2' : 'h-8 px-2.5',
            'border-border/80 bg-background/80 shadow-sm backdrop-blur-sm',
            'transition-[border-color,box-shadow,background-color]',
            'hover:border-foreground/30 hover:bg-foreground/[0.04] hover:shadow-md',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
            className,
          )}
          aria-label={`Active model: ${modelConfig.model}`}
        >
          <ModelLogo
            hints={[modelConfig.provider, modelConfig.model]}
            className={compact ? 'h-5 w-5' : 'h-6 w-6'}
          />

          <span className={cn('min-w-0 text-left leading-tight', compact ? 'max-w-[9rem]' : 'max-w-[11rem]')}>
            <span className="block truncate text-[11px] font-semibold text-foreground">
              {modelConfig.model}
            </span>
            {!compact && (
              <span className="block truncate text-[9px] text-muted-foreground">
                {local ? 'Ollama · local' : 'Server · .env'}
              </span>
            )}
          </span>

          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              configured ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]' : 'bg-amber-500',
            )}
            title={configured ? 'Model ready' : 'Not configured — template fallback'}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-foreground" />
          Model configuration
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="space-y-2.5 px-2 py-1.5 text-xs">
          <DetailRow label="Source" value={local ? 'Ollama (local)' : 'Server (.env)'} />
          <DetailRow
            label="Provider"
            value={providerFromHints(modelConfig.provider, modelConfig.model)?.label ?? modelConfig.provider ?? '—'}
          />
          <DetailRow label="Model" value={modelConfig.model} mono />
          {local && modelConfig.baseUrl ? (
            <DetailRow label="Server URL" value={modelConfig.baseUrl} mono />
          ) : null}
          <DetailRow label="Temperature" value={String(modelConfig.temperature)} />
          <DetailRow label="Top P" value={String(modelConfig.topP)} />
          <DetailRow label="Max tokens" value={String(modelConfig.maxTokens)} />
          <DetailRow
            label="Status"
            value={configured ? 'Ready' : 'Not configured'}
            valueClassName={configured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
          />
        </div>

        <DropdownMenuSeparator />
        <p className="px-2 pb-2 text-[10px] leading-relaxed text-muted-foreground">
          {local
            ? 'Set under Workflow → Model. Re-validate after changing the model or Ollama URL.'
            : 'Loaded from project .env. Update model settings there and restart the API, or switch to Ollama in Workflow → Model.'}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

function DetailRow({
  label,
  value,
  mono = false,
  valueClassName,
}: {
  label: string
  value: string
  mono?: boolean
  valueClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          'truncate text-right font-medium text-foreground',
          mono && 'font-mono text-[11px]',
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  )
}
