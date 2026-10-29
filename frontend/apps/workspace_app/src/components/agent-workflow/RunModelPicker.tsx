import { memo } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ModelLogo } from '@/components/agent-workflow/model-providers'
import { useModelConnections } from '@/components/agent-workflow/hooks/use-model-connections'
import { connectionProviderId } from '@/components/agent-workflow/AgentConfigPanel'
import { useWorkflowModel, useWorkflowModelChange } from '@/components/agent-workflow/workflow-model-context'
import type { ModelConnection } from '@/services/model-connections-api'
import { cn } from '@/utils/cn'

/**
 * The run chat's model: the workflow's model, which test runs use and every agent without a model of
 * its own inherits. Lists the model clients from the Admin center and the user's own.
 */
export const RunModelPicker = memo(function RunModelPicker({ disabled = false }: { disabled?: boolean }) {
  const model = useWorkflowModel()
  const change = useWorkflowModelChange()
  const { connections, status } = useModelConnections()
  if (!model || !change) return null

  const picked = model.connectionId ? connections.find((connection) => connection.id === model.connectionId) : undefined
  const label = picked?.name ?? model.model ?? 'Default'
  const groups: Array<[string, ModelConnection[]]> = [
    ['Model clients', connections.filter((connection) => connection.scope === 'application')],
    ['Yours', connections.filter((connection) => connection.scope !== 'application')],
  ]

  return (
    <DropdownMenu>
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
          title={`Runs on ${label}; agents without their own model use it`}
        >
          <ModelLogo hints={[picked?.providerType ?? model.provider, model.model]} className="h-4 w-4" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="max-h-[22rem] w-72 overflow-y-auto">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          The workflow's model. Agents with their own model keep it.
        </DropdownMenuLabel>
        {status === 'loading' || status === 'idle' ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading models…</p>
        ) : connections.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No model clients yet. Add one in Admin center → Model clients.</p>
        ) : null}
        {groups.map(([title, items]) =>
          items.length ? (
            <div key={title}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">{title}</DropdownMenuLabel>
              {items.map((connection) => (
                <DropdownMenuItem
                  key={connection.id}
                  onSelect={() =>
                    change({ connectionId: connection.id, provider: connectionProviderId(connection.providerType), model: connection.model })
                  }
                  className="gap-2"
                >
                  <ModelLogo hints={[connection.providerType, connection.model]} className="h-5 w-5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{connection.name}</span>
                    <span className="block truncate font-mono text-[10.5px] text-muted-foreground">{connection.model}</span>
                  </span>
                  {connection.id === model.connectionId ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </DropdownMenuItem>
              ))}
            </div>
          ) : null,
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
