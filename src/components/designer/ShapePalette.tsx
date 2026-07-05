import { memo, useMemo } from 'react'
import { Shapes, Sparkles } from 'lucide-react'
import { byOrder } from '@/utils/collection'
import { Badge } from '@/components/ui/badge'
import { NodeShape } from './NodeShape'
import { DND_MIME } from './diagram-types'
import type { PaletteItem } from '@/types/config'

interface ShapePaletteProps {
  palette: PaletteItem[]
  /** True when the tool ships its own palette (vs the generic fallback). */
  isToolSpecific: boolean
  toolTitle: string
  onAdd: (paletteId: string) => void
}

const ShapeTile = memo(function ShapeTile({
  item,
  onAdd,
}: {
  item: PaletteItem
  onAdd: (paletteId: string) => void
}) {
  return (
    <button
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DND_MIME, item.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAdd(item.id)}
      title={item.description ? `${item.label} — ${item.description}` : item.label}
      className="group flex cursor-grab flex-col items-center gap-1.5 rounded-lg border bg-background p-2 pt-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:cursor-grabbing"
    >
      <div className="flex h-8 w-full items-center justify-center px-1" aria-hidden>
        <div className="h-7 w-12">
          <NodeShape shape={item.shape} color={item.color} label="" className="!text-[0px] [&_*]:!shadow-none" />
        </div>
      </div>
      <span className="w-full truncate text-center text-[10.5px] font-medium leading-tight text-muted-foreground group-hover:text-foreground">
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
}: ShapePaletteProps) {
  const groups = useMemo(() => {
    const ordered = byOrder(palette)
    const map = new Map<string, PaletteItem[]>()
    ordered.forEach((item) => {
      const group = item.group ?? 'Shapes'
      const bucket = map.get(group)
      if (bucket) bucket.push(item)
      else map.set(group, [item])
    })
    return Array.from(map.entries())
  }, [palette])

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/20" aria-label="Shape palette">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Shapes className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-sm font-semibold">Shapes</span>
        <span className="ml-auto text-[11px] text-muted-foreground">{palette.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {groups.map(([groupName, items]) => (
          <section key={groupName} className="mb-4 last:mb-0">
            <h3 className="mb-2 px-1 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
              {groupName}
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((item) => (
                <ShapeTile key={item.id} item={item} onAdd={onAdd} />
              ))}
            </div>
          </section>
        ))}

        {!isToolSpecific && (
          <p className="mt-2 rounded-lg border border-dashed p-3 text-[11px] leading-relaxed text-muted-foreground">
            The dedicated shape library for {toolTitle} is coming soon. Meanwhile, use these basic
            shapes to sketch your ideas.
          </p>
        )}
      </div>

      <div className="border-t p-3">
        <div className="rounded-lg border bg-gradient-to-b from-primary/5 to-transparent p-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="text-xs font-semibold">Clovai Engine</span>
            <Badge variant="gradient" className="ml-auto px-1.5 py-0 text-[10px]">
              Soon
            </Badge>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Multi-agent AI orchestration that turns plain language into complete diagrams —
            launching soon.
          </p>
        </div>
      </div>
    </aside>
  )
})
