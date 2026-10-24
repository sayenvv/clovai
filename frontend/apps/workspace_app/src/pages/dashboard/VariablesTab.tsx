import { useMemo, useState } from 'react'
import { Braces, Check, Copy, Eye, Lock, Pencil, Plus, Search, ServerCog, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListSkeleton, PageIntro } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { Section } from '@/components/agent-workflow/dashboard/activity-ui'
import { formatWhen } from '@/components/agent-workflow/dashboard/dashboard-format'
import { VariableDialog } from '@/components/agent-workflow/VariableDialog'
import { useVariables } from '@/components/agent-workflow/hooks/use-variables'
import type { EnvVariable } from '@/services/variables-api'

/**
 * Environment variables: API keys, credentials and settings stored once on the server and referred
 * to by name (e.g. a model connection's key), so they never end up in workflow JSON.
 */
export default function VariablesTab() {
  const { variables, status, error, reload, save, remove } = useVariables()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EnvVariable | null>(null)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle
      ? variables.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(needle))
      : variables
  }, [variables, query])

  const open = (variable: EnvVariable | null) => {
    setEditing(variable)
    setDialogOpen(true)
  }

  const handleDelete = async (variable: EnvVariable) => {
    if (!window.confirm(`Delete ${variable.name}? Anything that refers to it will stop resolving.`)) return
    try {
      await remove(variable.id)
      toast.success('Variable deleted')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not delete the variable.')
    }
  }

  const copyName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name)
      setCopied(name)
      window.setTimeout(() => setCopied((current) => (current === name ? null : current)), 1500)
    } catch {
      toast.error('Could not copy to the clipboard.')
    }
  }

  const unavailable = status === 'unavailable'

  return (
    <div>
      <PageIntro
        eyebrow="Variables"
        title="Environment variables"
        description="Store API keys, credentials and settings once, then refer to them by name from your models and tools."
        actions={
          <Button type="button" size="sm" onClick={() => open(null)} disabled={unavailable || status === 'loading'}>
            <Plus className="size-3.5" />
            Add variable
          </Button>
        }
      />

      {unavailable ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <ServerCog className="size-7 text-muted-foreground/70" />
          <p className="text-sm font-medium text-foreground">Not available on this server yet</p>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Environment variables need the server’s <span className="font-mono">/api/v1/variables</span> API.
          </p>
        </div>
      ) : status === 'error' ? (
        <p className="text-sm text-destructive">
          {error}{' '}
          <button type="button" onClick={() => void reload()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </p>
      ) : status === 'loading' && variables.length === 0 ? (
        <ListSkeleton />
      ) : variables.length === 0 ? (
        <button
          type="button"
          onClick={() => open(null)}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center transition-colors hover:border-foreground/30 hover:bg-card"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-b from-muted to-muted/40 ring-1 ring-inset ring-border/70">
            <Braces className="size-5 text-muted-foreground" />
          </span>
          <span className="text-sm font-medium text-foreground">Add your first variable</span>
          <span className="max-w-sm text-xs text-muted-foreground">
            For example <span className="font-mono">OPENAI_API_KEY</span>, a database password or a webhook URL.
          </span>
        </button>
      ) : (
        <Section
          title={`${variables.length} variable${variables.length === 1 ? '' : 's'}`}
          action={
            <div className="relative w-48 sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search variables"
                className="h-8 pl-8 text-xs"
                aria-label="Search variables"
              />
            </div>
          }
        >
          <div className="-mx-5 -mb-5 divide-y divide-border/70 border-t border-border/70">
            {shown.map((variable) => (
              <div key={variable.id} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-muted to-muted/40 text-muted-foreground ring-1 ring-inset ring-border/70">
                  {variable.secret ? <Lock className="size-3.5" /> : <Eye className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyName(variable.name)}
                      className="inline-flex min-w-0 items-center gap-1.5 truncate font-mono text-[13px] font-medium text-foreground"
                      aria-label={`Copy ${variable.name}`}
                    >
                      <span className="truncate">{variable.name}</span>
                      {copied === variable.name ? (
                        <Check className="size-3 shrink-0 text-emerald-600" />
                      ) : (
                        <Copy className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </button>
                    {variable.scope === 'workspace' ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[10.5px] text-muted-foreground">
                        <Users className="size-3" /> Workspace
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                    {variable.description || (variable.secret ? 'Secret' : 'Plain value')}
                  </p>
                </div>
                <span className="hidden w-40 truncate text-right font-mono text-[11px] text-muted-foreground sm:block">
                  {variable.secret ? (variable.hasValue ? '••••••••' : 'Not set') : variable.value}
                </span>
                <span className="hidden w-28 text-right text-[11px] text-muted-foreground md:block">
                  {formatWhen(variable.updatedAt)}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => open(variable)} aria-label={`Edit ${variable.name}`}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-destructive"
                    onClick={() => void handleDelete(variable)}
                    aria-label={`Delete ${variable.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {shown.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-muted-foreground">No variables match “{query}”.</p>
            ) : null}
          </div>
        </Section>
      )}

      <VariableDialog open={dialogOpen} onOpenChange={setDialogOpen} variable={editing} onSave={save} />
    </div>
  )
}
