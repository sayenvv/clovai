import { memo } from 'react'
import { ArrowLeftRight, Copy, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { DesignerPanelHeader } from './DesignerPanelHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  COLOR_OPTIONS,
  getNodeSize,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
  resizeAspect,
  resolveNodeStyle,
  SHAPE_OPTIONS,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type EdgeRouting,
} from './diagram-types'
import type { Selection } from './DesignerCanvas'
import type { PaletteColor, PaletteItem, PaletteShape } from '@/types/config'

const SWATCH_CLASSES: Record<PaletteColor, string> = {
  emerald: 'bg-emerald-400 dark:bg-emerald-500',
  blue: 'bg-blue-400 dark:bg-blue-500',
  amber: 'bg-amber-400 dark:bg-amber-500',
  violet: 'bg-violet-400 dark:bg-violet-500',
  cyan: 'bg-cyan-400 dark:bg-cyan-500',
  rose: 'bg-rose-400 dark:bg-rose-500',
  slate: 'bg-slate-400 dark:bg-slate-500',
}

interface PropertiesPanelProps {
  diagram: Diagram
  selection: Selection
  paletteById: Map<string, PaletteItem>
  onChange: (updater: (previous: Diagram) => Diagram) => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

const NodeProperties = memo(function NodeProperties({
  node,
  item,
  onChange,
}: {
  node: DiagramNode
  item: PaletteItem
  onChange: PropertiesPanelProps['onChange']
}) {
  const { shape, color } = resolveNodeStyle(node, item)
  const { width, height } = getNodeSize(node, shape)
  const aspect = resizeAspect(shape)
  const sizeRatio = width / height

  const updateNode = (patch: Partial<DiagramNode>) => {
    onChange((previous) => ({
      ...previous,
      nodes: previous.nodes.map((candidate) =>
        candidate.id === node.id ? { ...candidate, ...patch } : candidate,
      ),
    }))
  }

  const updateSize = (patch: { width?: number; height?: number }) => {
    if (aspect === 'square') {
      const size = Math.max(patch.width ?? width, patch.height ?? height)
      updateNode({ width: size, height: size })
      return
    }
    if (aspect === 'preserve') {
      if (patch.width !== undefined) {
        updateNode({ width: patch.width, height: Math.round(patch.width / sizeRatio) })
        return
      }
      if (patch.height !== undefined) {
        updateNode({ width: Math.round(patch.height * sizeRatio), height: patch.height })
        return
      }
    }
    updateNode(patch)
  }

  const numeric = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? fallback : parsed
  }

  const hasOverrides =
    node.shape !== undefined ||
    node.color !== undefined ||
    node.width !== undefined ||
    node.height !== undefined

  return (
    <div className="flex flex-col gap-4">
      <Field label="Text">
        <Input
          value={node.label}
          onChange={(event) => updateNode({ label: event.target.value })}
          placeholder="Shape label"
          className="h-8 text-xs"
        />
      </Field>

      <Field label="Shape">
        <Select
          value={shape}
          onChange={(event) => updateNode({ shape: event.target.value as PaletteShape })}
          className="h-8 text-xs"
          aria-label="Shape type"
        >
          {SHAPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Color">
        <div className="flex flex-wrap gap-1.5">
          {COLOR_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => updateNode({ color: option })}
              aria-label={`Set color ${option}`}
              title={option}
              className={cn(
                'h-6 w-6 rounded-full border-2 border-background shadow-sm transition-transform hover:scale-110',
                SWATCH_CLASSES[option],
                color === option && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
            />
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <Input
            type="number"
            value={Math.round(node.x)}
            onChange={(event) => updateNode({ x: numeric(event.target.value, node.x) })}
            className="h-8 text-xs tabular-nums"
          />
        </Field>
        <Field label="Y">
          <Input
            type="number"
            value={Math.round(node.y)}
            onChange={(event) => updateNode({ y: numeric(event.target.value, node.y) })}
            className="h-8 text-xs tabular-nums"
          />
        </Field>
        <Field label="Width">
          <Input
            type="number"
            min={MIN_NODE_WIDTH}
            value={Math.round(width)}
            onChange={(event) =>
              updateSize({ width: Math.max(MIN_NODE_WIDTH, numeric(event.target.value, width)) })
            }
            className="h-8 text-xs tabular-nums"
          />
        </Field>
        <Field label="Height">
          <Input
            type="number"
            min={MIN_NODE_HEIGHT}
            value={Math.round(height)}
            onChange={(event) =>
              updateSize({ height: Math.max(MIN_NODE_HEIGHT, numeric(event.target.value, height)) })
            }
            className="h-8 text-xs tabular-nums"
          />
        </Field>
      </div>

      {hasOverrides && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 justify-start text-xs text-muted-foreground"
          onClick={() =>
            updateNode({ shape: undefined, color: undefined, width: undefined, height: undefined })
          }
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset to palette style
        </Button>
      )}
    </div>
  )
})

const EdgeProperties = memo(function EdgeProperties({
  edge,
  nodeLabel,
  onChange,
}: {
  edge: DiagramEdge
  nodeLabel: (id: string) => string
  onChange: PropertiesPanelProps['onChange']
}) {
  const routing = edge.routing ?? 'curved'

  const updateEdge = (patch: Partial<DiagramEdge>) => {
    onChange((previous) => ({
      ...previous,
      edges: previous.edges.map((candidate) =>
        candidate.id === edge.id ? { ...candidate, ...patch } : candidate,
      ),
    }))
  }

  const updateRouting = (next: EdgeRouting) => {
    updateEdge({ routing: next })
  }

  const reverse = () => {
    onChange((previous) => ({
      ...previous,
      edges: previous.edges.map((candidate) =>
        candidate.id === edge.id
          ? {
              ...candidate,
              from: candidate.to,
              to: candidate.from,
              fromSide: candidate.toSide,
              toSide: candidate.fromSide,
            }
          : candidate,
      ),
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Connection">
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
          <p className="truncate font-medium">{nodeLabel(edge.from)}</p>
          <p className="my-0.5 text-muted-foreground">↓ {edge.fromSide} → {edge.toSide}</p>
          <p className="truncate font-medium">{nodeLabel(edge.to)}</p>
        </div>
      </Field>
      <Field label="Label">
        <Input
          value={edge.label ?? ''}
          onChange={(event) =>
            updateEdge({ label: event.target.value.length > 0 ? event.target.value : undefined })
          }
          onBlur={(event) => {
            const trimmed = event.target.value.trim()
            updateEdge({ label: trimmed.length > 0 ? trimmed : undefined })
          }}
          placeholder="e.g. Yes, No, Retry"
          className="h-8 text-xs"
        />
      </Field>
      <Field label="Routing">
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <div>
            <p className="text-xs font-medium">Straight connector</p>
            <p className="text-[11px] text-muted-foreground">90° corners only</p>
          </div>
          <Switch
            checked={routing === 'orthogonal'}
            onCheckedChange={(checked) => updateRouting(checked ? 'orthogonal' : 'curved')}
            aria-label="Toggle straight connector"
          />
        </div>
      </Field>
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={reverse}>
        <ArrowLeftRight className="h-3.5 w-3.5" /> Reverse direction
      </Button>
    </div>
  )
})

/** Right-hand inspector for the current selection — full control over a
 *  shape's text, type, color, position and size. */
export const PropertiesPanel = memo(function PropertiesPanel({
  diagram,
  selection,
  paletteById,
  onChange,
  onDuplicate,
  onDelete,
  onClose,
}: PropertiesPanelProps) {
  if (!selection) return null

  const node =
    selection.kind === 'node' ? diagram.nodes.find((n) => n.id === selection.id) : undefined
  const edge =
    selection.kind === 'edge' ? diagram.edges.find((e) => e.id === selection.id) : undefined
  const item = node ? paletteById.get(node.paletteId) : undefined

  if (!node && !edge) return null

  const nodeLabel = (id: string) => diagram.nodes.find((n) => n.id === id)?.label ?? 'Deleted shape'

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-l bg-background"
      aria-label="Selection properties"
    >
      <DesignerPanelHeader
        icon={<SlidersHorizontal className="h-4 w-4" />}
        title={node ? 'Shape' : 'Connection'}
        onClose={onClose}
        closeLabel="Close properties"
      />

      <div className="flex-1 overflow-y-auto p-4">
        {node && item && <NodeProperties node={node} item={item} onChange={onChange} />}
        {edge && <EdgeProperties edge={edge} nodeLabel={nodeLabel} onChange={onChange} />}
      </div>

      <div className="flex gap-2 border-t p-3">
        {node && (
          <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex-1 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </aside>
  )
})
