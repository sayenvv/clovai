import { useEffect, useState } from 'react'
import { BookOpen, Brain, Plus, Save, Trash2 } from 'lucide-react'
import { errorMessage } from '@/api/config'
import {
  createContextProvider,
  deleteContextProvider,
  listContextProviders,
  listContextProviderStarters,
  updateContextProvider,
  type ContextProvider,
  type ContextProviderStarter,
  type ContextProviderWrite,
} from '@/api/context-providers'
import { LayoutToggle, useLayout } from '@/components/admin-center/LayoutToggle'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

const FIELD = 'grid gap-1 text-[11px] font-medium text-muted-foreground'
const SELECT =
  'h-8 rounded-[2px] border border-input bg-transparent px-2 text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const TEXTAREA =
  'w-full rounded-[2px] border border-input bg-transparent px-2.5 py-2 font-mono text-[11.5px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const CUSTOM = ''

/** One provider, new or saved, edited and saved on its own. */
function ProviderCard({
  provider,
  starters,
  onSaved,
  onDeleted,
}: {
  provider: ContextProvider | null
  starters: ContextProviderStarter[]
  onSaved: (saved: ContextProvider) => void
  onDeleted: () => void
}) {
  const first = starters[0]
  const [name, setName] = useState(provider?.name ?? first?.label ?? '')
  const [description, setDescription] = useState(provider?.description ?? first?.description ?? '')
  const [handler, setHandler] = useState(provider?.handler ?? first?.handler ?? '')
  const [slot, setSlot] = useState<'memory' | 'knowledge'>(provider?.slot ?? first?.slot ?? 'memory')
  const [config, setConfig] = useState(JSON.stringify(provider?.config ?? first?.config ?? {}, null, 2))
  const [isActive, setIsActive] = useState(provider?.isActive ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const starter = starters.find((item) => item.handler === handler)

  // A new provider can start from a handler marked @context_provider in code, or from your own
  const startFrom = (next: string) => {
    const chosen = starters.find((item) => item.handler === next)
    setHandler(chosen?.handler ?? '')
    setName(chosen?.label ?? '')
    setDescription(chosen?.description ?? '')
    setSlot(chosen?.slot ?? 'memory')
    setConfig(JSON.stringify(chosen?.config ?? {}, null, 2))
  }

  const save = async () => {
    setError('')
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(config || '{}')
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    } catch {
      setError('Settings must be a JSON object.')
      return
    }
    const body: ContextProviderWrite = { name, description, handler: handler.trim(), slot, config: parsed, isActive }
    setBusy(true)
    try {
      onSaved(provider ? await updateContextProvider(provider.id, body) : await createContextProvider(body))
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save the provider.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!provider) return onDeleted()
    if (!window.confirm(`Delete "${provider.name}"? Agents that use it will fail to run until it is removed from them.`)) return
    setBusy(true)
    try {
      await deleteContextProvider(provider.id)
      onDeleted()
    } catch (reason) {
      setError(errorMessage(reason, 'Could not delete the provider.'))
      setBusy(false)
    }
  }

  return (
    <PremiumCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-semibold">{provider ? provider.name : 'New context provider'}</p>
          <StatusBadge label={slot === 'knowledge' ? 'Knowledge' : 'Memory'} tone="info" />
          {provider && !starter ? <StatusBadge label="Custom" tone="neutral" /> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Active" />
            Active
          </label>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => void remove()} disabled={busy} aria-label="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-[11.5px] font-semibold" onClick={() => void save()} disabled={busy || !name.trim() || !handler.trim()}>
            <Save className="h-3.5 w-3.5" />
            {provider ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
      {error && <p className="mb-3 rounded-[2px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={FIELD}>
          Name
          <Input value={name} onChange={(event) => setName(event.target.value)} className="h-8 text-[12px]" />
        </label>
        <label className={FIELD}>
          Slot
          <select value={slot} onChange={(event) => setSlot(event.target.value as 'memory' | 'knowledge')} className={SELECT}>
            <option value="memory">Memory</option>
            <option value="knowledge">Knowledge</option>
          </select>
        </label>
        {provider ? null : (
          <label className={`${FIELD} sm:col-span-2`}>
            Start from
            <select value={starter ? handler : CUSTOM} onChange={(event) => startFrom(event.target.value)} className={SELECT}>
              {starters.map((item) => (
                <option key={item.handler} value={item.handler}>
                  {item.label}
                </option>
              ))}
              <option value={CUSTOM}>Custom handler (your own code)</option>
            </select>
          </label>
        )}
        <label className={`${FIELD} sm:col-span-2`}>
          Handler: the function that builds it, package.module:function (as for tools)
          <Input
            value={handler}
            onChange={(event) => setHandler(event.target.value)}
            placeholder="app.packages.context_providers.my_provider:my_provider"
            className="h-8 font-mono text-[12px]"
          />
        </label>
        <label className={`${FIELD} sm:col-span-2`}>
          Description (users see this when they add it to an agent)
          <Input value={description} onChange={(event) => setDescription(event.target.value)} className="h-8 text-[12px]" />
        </label>
        <label className={`${FIELD} sm:col-span-2`}>
          Settings (JSON)
          <textarea rows={Math.max(3, config.split('\n').length)} value={config} onChange={(event) => setConfig(event.target.value)} className={TEXTAREA} />
        </label>
      </div>
    </PremiumCard>
  )
}

/** A provider at a glance, for the grid; clicking it opens its editor. */
function ProviderTile({
  provider,
  starters,
  selected,
  onOpen,
}: {
  provider: ContextProvider
  starters: ContextProviderStarter[]
  selected: boolean
  onOpen: () => void
}) {
  const Icon = provider.slot === 'knowledge' ? BookOpen : Brain
  const custom = !starters.some((item) => item.handler === provider.handler)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={`flex flex-col rounded-[3px] border bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? 'border-foreground/60' : 'border-border/70 hover:border-foreground/40'
      } ${provider.isActive ? '' : 'opacity-60'}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] bg-foreground/10">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{provider.name}</p>
          <p className="truncate text-[10.5px] text-muted-foreground">{provider.slot === 'knowledge' ? 'Knowledge' : 'Memory'}</p>
        </div>
        <StatusBadge label={provider.isActive ? 'Active' : 'Inactive'} tone={provider.isActive ? 'success' : 'neutral'} />
      </div>
      <p className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[11.5px] leading-5 text-muted-foreground">
        {provider.description || 'No description.'}
      </p>
      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5">
        <p className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted-foreground" title={provider.handler}>
          {provider.handler}
        </p>
        {custom ? <StatusBadge label="Custom" tone="neutral" /> : null}
      </div>
    </button>
  )
}

/** Configuration → Context providers: the memory and knowledge sources users may add to their agents. */
export function ContextProvidersView() {
  const [providers, setProviders] = useState<ContextProvider[] | null>(null)
  const [starters, setStarters] = useState<ContextProviderStarter[]>([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [layout, chooseLayout] = useLayout('admin-center.context-providers-layout')
  // Grid: the provider whose editor is open above the cards
  const [openId, setOpenId] = useState<string | null>(null)
  const opened = providers?.find((provider) => provider.id === openId) ?? null

  useEffect(() => {
    let live = true
    Promise.all([listContextProviders(), listContextProviderStarters()])
      .then(([rows, handlers]) => {
        if (!live) return
        setProviders(rows)
        setStarters(handlers)
      })
      .catch((reason: unknown) => live && setError(errorMessage(reason, 'Could not load the context providers.')))
    return () => {
      live = false
    }
  }, [])

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Context providers"
        description="Memory and knowledge sources users can add to their agents. Like tools, each runs a handler from the code (package.module:function); only active ones are offered on the canvas."
        actions={
          <>
            <LayoutToggle value={layout} onChange={chooseLayout} />
            <Button
              size="sm"
              className="h-8 gap-1.5 text-[11.5px] font-semibold"
              onClick={() => {
                setOpenId(null)
                setAdding(true)
              }}
              disabled={adding}
            >
              <Plus className="h-3.5 w-3.5" />
              New provider
            </Button>
          </>
        }
      />
      <PageBody className="grid gap-3">
        {error && <p className="rounded-[2px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">{error}</p>}
        {adding && (
          <ProviderCard
            provider={null}
            starters={starters}
            onSaved={(saved) => {
              setProviders((rows) => [...(rows ?? []), saved])
              setAdding(false)
            }}
            onDeleted={() => setAdding(false)}
          />
        )}
        {providers === null && !error ? (
          <EmptyHint title="Loading…" hint="Fetching context providers." />
        ) : providers?.length === 0 && !adding ? (
          <EmptyHint title="No context providers" hint="Create one so users can add memory to their agents." />
        ) : layout === 'grid' ? (
          <>
            {opened && (
              <ProviderCard
                key={`${opened.id}-${opened.updatedAt}`}
                provider={opened}
                starters={starters}
                onSaved={(saved) => setProviders((rows) => (rows ?? []).map((row) => (row.id === saved.id ? saved : row)))}
                onDeleted={() => {
                  setProviders((rows) => (rows ?? []).filter((row) => row.id !== opened.id))
                  setOpenId(null)
                }}
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providers?.map((provider) => (
                <ProviderTile
                  key={provider.id}
                  provider={provider}
                  starters={starters}
                  selected={provider.id === openId}
                  onOpen={() => {
                    setAdding(false)
                    setOpenId(provider.id === openId ? null : provider.id)
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          providers?.map((provider) => (
            <ProviderCard
              key={`${provider.id}-${provider.updatedAt}`}
              provider={provider}
              starters={starters}
              onSaved={(saved) => setProviders((rows) => (rows ?? []).map((row) => (row.id === saved.id ? saved : row)))}
              onDeleted={() => setProviders((rows) => (rows ?? []).filter((row) => row.id !== provider.id))}
            />
          ))
        )}
      </PageBody>
    </>
  )
}
