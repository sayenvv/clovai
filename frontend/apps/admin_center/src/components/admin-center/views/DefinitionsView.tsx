import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, LayoutGrid, List, Plus, RefreshCw } from 'lucide-react'
import { listDefinitions, type DefinitionDetail, type DefinitionKind } from '@/api/definitions'
import { DEFINITION_KINDS } from '@/components/admin-center/definition-kinds'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { SearchInput } from '@/components/admin-center/SearchInput'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'
import { cn } from '@/utils/cn'
import { formatWhen } from '@/utils/format'

type Layout = 'list' | 'grid'
const LAYOUT_KEY = 'admin-center.definitions-layout'

function readLayout(): Layout {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

/** The list page for one kind of definition: workflows, agents, tools or middlewares. */
export function DefinitionsView({ kind }: { kind: DefinitionKind }) {
  const config = DEFINITION_KINDS[kind]
  const [rows, setRows] = useState<DefinitionDetail[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<Layout>(readLayout)

  const chooseLayout = (next: Layout) => {
    setLayout(next)
    try {
      window.localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      /* the choice just won't be remembered */
    }
  }

  const load = useCallback(() => {
    setRows(null)
    setError('')
    listDefinitions(kind, config.onlyType)
      .then(setRows)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [kind, config.onlyType])

  useEffect(load, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!rows || !needle) return rows ?? []
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        row.description.toLowerCase().includes(needle) ||
        row.id.includes(needle),
    )
  }, [rows, query])

  return (
    <>
      <PageHeader
        eyebrow="Definitions"
        title={config.label}
        description={config.description}
        actions={
          <>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[11.5px]" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button asChild size="sm" className="h-8 gap-1.5 text-[11.5px] font-semibold">
              <Link to={ROUTES.definition(kind, 'new')}>
                <Plus className="h-3.5 w-3.5" />
                New {config.singular}
              </Link>
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        <PremiumCard className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={`Search ${config.label.toLowerCase()}…`}
              className="max-w-sm flex-1"
            />
            <div className="flex items-center gap-3">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {rows ? `${filtered.length} of ${rows.length}` : 'Loading…'}
                {config.onlyType ? ' · admin-made only' : ''}
              </span>
              <LayoutToggle value={layout} onChange={chooseLayout} />
            </div>
          </div>
        </PremiumCard>

        {error ? (
          <PremiumCard>
            <EmptyHint
              title={`Couldn't load ${config.label.toLowerCase()}`}
              hint={error}
              className="m-4 border-0 bg-transparent"
            />
          </PremiumCard>
        ) : rows === null ? (
          <PremiumCard>
            <p className="px-4 py-10 text-center text-[11px] text-muted-foreground">Loading…</p>
          </PremiumCard>
        ) : filtered.length === 0 ? (
          <PremiumCard>
            <EmptyHint
              title={rows.length === 0 ? `No ${config.label.toLowerCase()} yet` : 'Nothing matches'}
              hint={rows.length === 0 ? `Create one with “New ${config.singular}”.` : 'Try another search.'}
              className="m-4 border-0 bg-transparent"
            />
          </PremiumCard>
        ) : layout === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((row) => (
              <DefinitionCard key={row.id} row={row} kind={kind} />
            ))}
          </div>
        ) : (
          <PremiumCard>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="bg-muted/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Name</th>
                    {config.detailColumn && (
                      <th className="px-4 py-2.5 text-left font-medium">{config.detailColumn.label}</th>
                    )}
                    <th className="px-4 py-2.5 text-left font-medium">Owner</th>
                    <th className="px-4 py-2.5 text-left font-medium">Updated</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <DefinitionRow key={row.id} row={row} kind={kind} />
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        )}
      </PageBody>
    </>
  )
}

function DefinitionRow({ row, kind }: { row: DefinitionDetail; kind: DefinitionKind }) {
  const config = DEFINITION_KINDS[kind]
  const href = ROUTES.definition(kind, row.id)
  return (
    <tr className="border-t border-border/60 transition-colors hover:bg-accent/30">
      <td className="max-w-[420px] px-4 py-2.5">
        <Link to={href} className="block min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <p className="truncate font-medium text-foreground hover:underline">{row.name || 'Untitled'}</p>
          <p className="truncate text-[10.5px] text-muted-foreground">{row.description || row.id}</p>
        </Link>
      </td>
      {config.detailColumn && (
        <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
          {config.detailColumn.read(row.definition)}
        </td>
      )}
      <td className="px-4 py-2.5">
        <OwnerBadge row={row} />
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{row.updatedAt ? formatWhen(row.updatedAt) : '—'}</td>
      <td className="px-4 py-2.5 text-right">
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]">
          <Link to={href}>
            Open
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </td>
    </tr>
  )
}

function OwnerBadge({ row }: { row: DefinitionDetail }) {
  return row.workflowType === 'system_generated' ? (
    <StatusBadge label="Admin" tone="info" />
  ) : (
    <StatusBadge label={row.userId ?? 'User'} tone="neutral" className="normal-case" />
  )
}

function DefinitionCard({ row, kind }: { row: DefinitionDetail; kind: DefinitionKind }) {
  const config = DEFINITION_KINDS[kind]
  const Icon = config.icon
  const detail = config.detailColumn?.read(row.definition)
  return (
    <Link
      to={ROUTES.definition(kind, row.id)}
      className="group flex flex-col rounded-lg border border-border/70 bg-card p-3.5 shadow-sm outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground/10 text-foreground dark:text-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground group-hover:underline">
            {row.name || 'Untitled'}
          </p>
          {detail && detail !== '—' ? (
            <p className="truncate font-mono text-[10.5px] text-muted-foreground">{detail}</p>
          ) : null}
        </div>
        <OwnerBadge row={row} />
      </div>

      <p className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-[11.5px] leading-5 text-muted-foreground">
        {row.description || 'No description.'}
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-2.5">
        {config.stats(row.definition).map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="truncate text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="mt-0.5 truncate text-[12px] font-semibold capitalize tabular-nums text-foreground">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span>Updated {row.updatedAt ? formatWhen(row.updatedAt) : '—'}</span>
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

function LayoutToggle({ value, onChange }: { value: Layout; onChange: (next: Layout) => void }) {
  const options: { layout: Layout; label: string; icon: typeof List }[] = [
    { layout: 'list', label: 'List view', icon: List },
    { layout: 'grid', label: 'Grid view', icon: LayoutGrid },
  ]
  return (
    <div className="flex rounded-md border border-border/70 bg-muted/40 p-0.5" role="group" aria-label="Layout">
      {options.map(({ layout, label, icon: Icon }) => (
        <button
          key={layout}
          type="button"
          onClick={() => onChange(layout)}
          aria-pressed={value === layout}
          aria-label={label}
          title={label}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            value === layout
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
