import { useState, type FormEvent } from 'react'
import { AppWindow, Check, ChevronsUpDown, Plus } from 'lucide-react'
import { errorMessage } from '@/api/config'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useApplication } from '@/hooks/use-application'
import { cn } from '@/utils/cn'

/** Picks the application the configuration pages edit, and creates new ones. */
export function ApplicationSwitcher({ collapsed }: { collapsed: boolean }) {
  const { applications, current, loading, error, select, create } = useApplication()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [createError, setCreateError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setCreateError('Enter a name.')
      return
    }
    setBusy(true)
    setCreateError('')
    try {
      await create(name.trim(), location.trim())
      setName('')
      setLocation('')
      setCreating(false)
    } catch (reason) {
      setCreateError(errorMessage(reason, 'Could not create the application.'))
    } finally {
      setBusy(false)
    }
  }

  const label = loading ? 'Loading…' : (current?.name ?? (error ? 'Unavailable' : 'No application'))

  return (
    <div className={cn('shrink-0', collapsed ? 'flex justify-center px-2 pt-3' : 'px-3 pt-3')}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[3px] text-primary" title={label} aria-label={`Application: ${label}`}>
              <AppWindow className="h-4 w-4" />
            </Button>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[3px] border border-border bg-card px-2.5 py-1.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-foreground/25"
            >
              <AppWindow className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Application
                </span>
                <span className="block truncate text-[12px] font-medium text-foreground">{label}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={collapsed ? 'right' : 'bottom'} className="w-64">
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Applications
          </DropdownMenuLabel>
          {applications.length === 0 && (
            <p className="px-2 py-1.5 text-[11.5px] text-muted-foreground">{error || 'None yet.'}</p>
          )}
          {applications.map((item) => (
            <DropdownMenuItem
              key={item.ai_integration_id}
              onSelect={() => select(item.ai_integration_id)}
              className="flex items-start gap-2"
            >
              <Check
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0',
                  item.ai_integration_id === current?.ai_integration_id ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span className="min-w-0">
                <span className="block truncate text-[12px]">{item.name}</span>
                <span className="block truncate font-mono text-[10px] text-muted-foreground">
                  {item.location ? `${item.location} · ` : ''}
                  {item.ai_integration_id}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)} className="gap-2 text-[12px]">
            <Plus className="h-3.5 w-3.5" />
            New application
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {creating && !collapsed && (
        <form onSubmit={submit} className="mt-2 space-y-1.5 rounded-[3px] border border-border bg-card p-2">
          <Input
            autoFocus
            aria-label="Application name"
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 text-[12px]"
          />
          <Input
            aria-label="Location"
            placeholder="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="h-8 text-[12px]"
          />
          {createError && <p className="text-[11px] text-destructive">{createError}</p>}
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={() => {
                setCreating(false)
                setCreateError('')
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-7 text-[11px] font-semibold" disabled={busy}>
              Create
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
