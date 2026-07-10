import { memo, useMemo, useState } from 'react'
import { Search, Shapes } from 'lucide-react'
import { byOrder } from '@/utils/collection'
import { cn } from '@/utils/cn'
import { NodeShape } from './NodeShape'
import { PALETTE_PREVIEW } from './palette-preview'
import { DND_MIME } from './diagram-types'
import { useTheme } from '@/hooks/use-theme'
import { paletteItemMatchesQuery } from '@/hooks/use-azure-palette'
import type { PaletteItem } from '@/types/config'

interface ShapePaletteProps {
  palette: PaletteItem[]
  /** True when the tool ships its own palette (vs the generic fallback). */
  isToolSpecific: boolean
  toolTitle: string
  onAdd: (paletteId: string) => void
  cloudCount?: number
  cloudLoading?: boolean
  cloudError?: string | null
}

const FLOWCHART_GROUPS = new Set(['Flow', 'Basic', 'Data', 'Logic', 'Swimlanes', 'Annotate'])
const CLOUD_PROVIDER_GROUPS = new Set(['AWS', 'Google Cloud'])

function isCloudItem(item: PaletteItem): boolean {
  return /^(fc-azure-|fc-gcp-|fc-aws-)/.test(item.id)
}

const ShapeTile = memo(function ShapeTile({
  item,
  onAdd,
  isDark,
}: {
  item: PaletteItem
  onAdd: (paletteId: string) => void
  isDark: boolean
}) {
  const preview = PALETTE_PREVIEW[item.shape]
  const isService = item.shape === 'service' && item.icon

  return (
    <button
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DND_MIME, item.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAdd(item.id)}
      title={item.description ? `${item.label} — ${item.description}` : item.label}
      className="group flex cursor-grab flex-col items-center gap-1 rounded-lg p-1.5 transition-all hover:-translate-y-0.5 hover:bg-muted/50 active:cursor-grabbing"
    >
      <div
        className={cn(
          'flex w-full items-center justify-center',
          isService ? 'h-10' : 'h-9 px-0.5',
        )}
        aria-hidden
      >
        {isService ? (
          <img
            src={item.icon}
            alt={item.label}
            className="h-8 w-8 object-contain"
            draggable={false}
          />
        ) : (
          <div style={{ width: preview.width, height: preview.height }}>
            <NodeShape
              shape={item.shape}
              icon={item.icon}
              isDark={isDark}
              label=""
              variant="palette"
              className="!text-[0px] [&_*]:!shadow-none"
            />
          </div>
        )}
      </div>
      <span
        className={cn(
          'flex min-h-[2rem] w-full items-start justify-center text-center font-medium leading-[1.15] text-muted-foreground group-hover:text-foreground',
          isService ? 'line-clamp-2 text-[9px]' : 'truncate text-[10.5px]',
        )}
      >
        {item.label}
      </span>
    </button>
  )
})

/** Left sidebar of the designer: shapes grouped into sections and laid out
 *  as a grid of tiles. Drag onto the canvas or click to add. */
export const ShapePalette = memo(function ShapePalette({
  palette,
  isToolSpecific,
  toolTitle,
  onAdd,
  cloudCount = 0,
  cloudLoading = false,
  cloudError = null,
}: ShapePaletteProps) {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const query = search.trim()

  const groups = useMemo(() => {
    const ordered = byOrder(palette)
    const filtered = ordered.filter((item) => {
      if (isCloudItem(item)) {
        if (!query) return false
        return paletteItemMatchesQuery(item, query)
      }
      if (!query) return true
      return paletteItemMatchesQuery(item, query)
    })

    const map = new Map<string, PaletteItem[]>()
    filtered.forEach((item) => {
      const group = item.group ?? 'Shapes'
      const bucket = map.get(group)
      if (bucket) bucket.push(item)
      else map.set(group, [item])
    })
    return Array.from(map.entries())
  }, [palette, query])

  const visibleCount = useMemo(
    () => groups.reduce((total, [, items]) => total + items.length, 0),
    [groups],
  )

  const cloudMatches = useMemo(
    () => (query ? palette.filter((item) => isCloudItem(item) && paletteItemMatchesQuery(item, query)).length : 0),
    [palette, query],
  )

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-background" aria-label="Shape palette">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Shapes className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="text-sm font-semibold">Components</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{visibleCount}</span>
      </div>

      <div className="border-b px-3 py-2.5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              cloudLoading
                ? 'Loading cloud icons…'
                : `Search cloud services (${cloudCount || '…'})…`
            }
            disabled={cloudLoading}
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-[12px] outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
        </label>
        {cloudError && (
          <p className="mt-2 text-[10.5px] text-destructive">{cloudError}</p>
        )}
        {!query && !cloudLoading && (
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
            {cloudCount > 0
              ? `${cloudCount} Azure, Google Cloud, and AWS icons available. Search to browse them.`
              : 'Cloud icon libraries are loading…'}
          </p>
        )}
        {query && cloudMatches > 0 && (
          <p className="mt-2 text-[10.5px] text-muted-foreground">
            {cloudMatches} cloud {cloudMatches === 1 ? 'match' : 'matches'}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {groups.map(([groupName, items]) => (
          <section key={groupName} className="mb-4 last:mb-0">
            <h3 className="mb-2 px-1 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
              {groupName}
            </h3>
            <div
              className={cn(
                'grid gap-1.5',
                FLOWCHART_GROUPS.has(groupName)
                  ? 'grid-cols-3'
                  : CLOUD_PROVIDER_GROUPS.has(groupName) || !FLOWCHART_GROUPS.has(groupName)
                    ? 'grid-cols-2'
                    : 'grid-cols-3',
              )}
            >
              {items.map((item) => (
                <ShapeTile key={item.id} item={item} onAdd={onAdd} isDark={isDark} />
              ))}
            </div>
          </section>
        ))}

        {query && groups.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            No components match &ldquo;{query}&rdquo;
          </p>
        )}

        {!isToolSpecific && (
          <p className="mt-2 rounded-lg border border-dashed p-3 text-[11px] leading-relaxed text-muted-foreground">
            The dedicated shape library for {toolTitle} is coming soon. Meanwhile, use these basic
            shapes to sketch your ideas.
          </p>
        )}
      </div>
    </aside>
  )
})
