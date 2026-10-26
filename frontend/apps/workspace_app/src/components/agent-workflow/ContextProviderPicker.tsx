import { BookOpen, Brain } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useContextProviders } from '@/components/agent-workflow/hooks/use-context-providers'

const SLOTS = [
  { slot: 'memory', label: 'Memory', icon: Brain },
  { slot: 'knowledge', label: 'Knowledge', icon: BookOpen },
] as const

/**
 * The agent's context providers: switch on the ones it should use. They run before each of the
 * agent's turns (conversation history, long-term memory...), configured by the admin.
 */
export function ContextProviderPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { providers: offered, error } = useContextProviders()

  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((item) => item !== id))

  if (error) return <p className="text-xs text-destructive">{error}</p>
  if (offered === null) return <p className="text-xs text-muted-foreground">Loading context providers…</p>
  // Ids the agent still names but the admin removed or deactivated: shown so they can be switched off
  const missing = value.filter((id) => !offered.some((provider) => provider.id === id))
  if (offered.length === 0 && missing.length === 0) {
    return <p className="text-xs text-muted-foreground">No context providers yet. An admin adds them in Admin Center → Context providers.</p>
  }

  return (
    <div className="space-y-4">
      {SLOTS.map(({ slot, label, icon: Icon }) => {
        const rows = offered.filter((provider) => provider.slot === slot)
        if (rows.length === 0) return null
        return (
          <section key={slot} className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </p>
            {rows.map((provider) => (
              <label key={provider.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{provider.name}</span>
                  {provider.description ? <span className="block text-[11.5px] text-muted-foreground">{provider.description}</span> : null}
                </span>
                <Switch checked={value.includes(provider.id)} onCheckedChange={(on) => toggle(provider.id, on)} aria-label={provider.name} />
              </label>
            ))}
          </section>
        )
      })}
      {missing.length > 0 ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-300">
          This agent uses {missing.length} provider{missing.length === 1 ? '' : 's'} that no longer exist or were turned off; the run will fail
          until {missing.length === 1 ? 'it is' : 'they are'} removed.{' '}
          <button type="button" className="underline" onClick={() => onChange(value.filter((id) => !missing.includes(id)))}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  )
}
