import { memo, useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  Copy,
  Paintbrush,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  EDGE_ROUTING_OPTIONS,
  resolveEdgeRouting,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type EdgeRouting,
} from './diagram-types'
import {
  COLOR_PRESETS,
  defaultEdgeColors,
  defaultNodeColors,
  normalizeHexColor,
} from './diagram-colors'
import { useTheme } from '@/hooks/use-theme'
import { selectedEdgeIds, selectedNodeIds, type Selection } from './selection-utils'

interface DesignerBottomToolbarProps {
  diagram: Diagram
  selection: Selection
  onChange: (updater: (previous: Diagram) => Diagram) => void
  onDuplicate: () => void
  onDelete: () => void
}

type ColorTarget = 'fill' | 'border'

/** Accent circles shown inline when Color is active. */
const TOOLBAR_SWATCHES = [
  '#3b82f6',
  '#8b5cf6',
  '#a7f3d0',
  '#ec4899',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#ffffff',
  '#18181b',
] as const

/**
 * Floating selection toolbar (replaces the right properties sidebar for diagram generator).
 * Appears at the bottom of the canvas when a shape or connector is selected.
 */
export const DesignerBottomToolbar = memo(function DesignerBottomToolbar({
  diagram,
  selection,
  onChange,
  onDuplicate,
  onDelete,
}: DesignerBottomToolbarProps) {
  const { isDark } = useTheme()
  const [colorOpen, setColorOpen] = useState(false)
  const [colorTarget, setColorTarget] = useState<ColorTarget>('fill')
  const [moreColors, setMoreColors] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)

  const nodeIds = selectedNodeIds(selection)
  const edgeIds = selectedEdgeIds(selection)
  const selectedNode =
    nodeIds.length === 1 ? diagram.nodes.find((node) => node.id === nodeIds[0]) : undefined
  const selectedEdge =
    edgeIds.length === 1 ? diagram.edges.find((edge) => edge.id === edgeIds[0]) : undefined

  const hasTarget = Boolean(selectedNode || selectedEdge)
  const nodeDefaults = defaultNodeColors(isDark)
  const edgeDefaults = defaultEdgeColors(isDark)

  useEffect(() => {
    setColorOpen(false)
    setMoreColors(false)
    setEditingLabel(false)
    setColorTarget('fill')
  }, [selectedNode?.id, selectedEdge?.id])

  if (!hasTarget) return null

  const applyNodeColor = (patch: Partial<Pick<DiagramNode, 'fillColor' | 'borderColor'>>) => {
    if (!selectedNode) return
    onChange((previous) => ({
      ...previous,
      nodes: previous.nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, ...patch } : node,
      ),
    }))
  }

  const applyEdgeColor = (patch: Partial<Pick<DiagramEdge, 'fillColor' | 'borderColor'>>) => {
    if (!selectedEdge) return
    onChange((previous) => ({
      ...previous,
      edges: previous.edges.map((edge) =>
        edge.id === selectedEdge.id ? { ...edge, ...patch } : edge,
      ),
    }))
  }

  const applyColor = (hex: string | undefined, target: ColorTarget) => {
    if (target === 'fill') {
      if (selectedNode) applyNodeColor({ fillColor: hex })
      else applyEdgeColor({ fillColor: hex })
      return
    }
    if (selectedNode) applyNodeColor({ borderColor: hex })
    else applyEdgeColor({ borderColor: hex })
  }

  const updateLabel = (label: string) => {
    const trimmed = label.trim()
    if (selectedNode) {
      onChange((previous) => ({
        ...previous,
        nodes: previous.nodes.map((node) =>
          node.id === selectedNode.id
            ? { ...node, label: trimmed || node.label }
            : node,
        ),
      }))
      return
    }
    if (selectedEdge) {
      onChange((previous) => ({
        ...previous,
        edges: previous.edges.map((edge) =>
          edge.id === selectedEdge.id
            ? { ...edge, label: trimmed.length > 0 ? trimmed : undefined }
            : edge,
        ),
      }))
    }
  }

  const reverseEdge = () => {
    if (!selectedEdge) return
    const edgeId = selectedEdge.id
    onChange((previous) => {
      let changed = false
      const edges = previous.edges.map((edge) => {
        if (edge.id !== edgeId) return edge
        if (edge.locked) return edge
        changed = true
        return {
          ...edge,
          from: edge.to,
          to: edge.from,
          fromSide: edge.toSide,
          toSide: edge.fromSide,
        }
      })
      if (!changed) return previous
      return { ...previous, edges }
    })
  }

  const updateRouting = (routing: EdgeRouting) => {
    if (!selectedEdge) return
    onChange((previous) => ({
      ...previous,
      edges: previous.edges.map((edge) =>
        edge.id === selectedEdge.id ? { ...edge, routing } : edge,
      ),
    }))
  }

  const currentFill = selectedNode?.fillColor ?? selectedEdge?.fillColor
  const currentBorder = selectedNode?.borderColor ?? selectedEdge?.borderColor
  const fillDefault = selectedNode ? nodeDefaults.fill : edgeDefaults.fill
  const borderDefault = selectedNode ? nodeDefaults.border : edgeDefaults.border
  const activeValue =
    colorTarget === 'fill' ? (currentFill ?? fillDefault) : (currentBorder ?? borderDefault)
  const activeDefault = colorTarget === 'fill' ? fillDefault : borderDefault
  const swatches = moreColors ? COLOR_PRESETS : TOOLBAR_SWATCHES
  const labelValue = selectedNode?.label ?? selectedEdge?.label ?? ''
  const edgeRouting = selectedEdge ? resolveEdgeRouting(selectedEdge.routing) : null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-3"
      data-designer-toolbar
    >
      <div
        className="pointer-events-auto flex max-w-[min(52rem,calc(100vw-1.5rem))] flex-col items-center gap-2"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== 'Delete' && event.key !== 'Backspace') return
          const target = event.target as HTMLElement
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
          event.preventDefault()
          event.stopPropagation()
          onDelete()
        }}
      >
        <div
          className="flex items-center gap-1 rounded-full border bg-popover px-2 py-1.5 text-popover-foreground shadow-xl"
          role="toolbar"
          aria-label="Selection tools"
        >
          <span className="hidden max-w-[7rem] truncate px-2 text-[12px] font-medium text-muted-foreground sm:inline">
            {selectedNode ? 'Edit' : 'Connector'}
          </span>

          <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

          {/* Label */}
          {editingLabel ? (
            selectedEdge ? (
              <textarea
                autoFocus
                rows={2}
                defaultValue={labelValue}
                onBlur={(event) => {
                  updateLabel(event.target.value)
                  setEditingLabel(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    updateLabel(event.currentTarget.value)
                    setEditingLabel(false)
                  }
                  if (event.key === 'Escape') setEditingLabel(false)
                }}
                className="h-14 w-40 resize-none rounded-xl border border-input bg-background px-2 py-1 text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={'Line 1\nLine 2'}
                aria-label="Edit connector label"
              />
            ) : (
              <input
                autoFocus
                defaultValue={labelValue}
                onBlur={(event) => {
                  updateLabel(event.target.value)
                  setEditingLabel(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    updateLabel(event.currentTarget.value)
                    setEditingLabel(false)
                  }
                  if (event.key === 'Escape') setEditingLabel(false)
                }}
                className="h-8 w-36 rounded-full border border-input bg-background px-3 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Shape label"
                aria-label="Edit label"
              />
            )
          ) : (
            <button
              type="button"
              className="flex h-8 max-w-[9rem] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
              onClick={() => setEditingLabel(true)}
              title="Edit label"
            >
              <Type className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="hidden truncate whitespace-pre sm:inline">
                {labelValue || 'Label'}
              </span>
            </button>
          )}

          <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

          {/* Color */}
          <button
            type="button"
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors',
              colorOpen ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted',
            )}
            aria-label={colorOpen ? 'Hide colors' : 'Show colors'}
            title="Color"
            onClick={() => {
              setColorOpen((open) => !open)
              setMoreColors(false)
            }}
          >
            <Paintbrush className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Color</span>
            <span
              className="h-2.5 w-2.5 rounded-full border border-border"
              style={{ backgroundColor: activeValue }}
              aria-hidden
            />
          </button>

          {colorOpen && (
            <>
              <div className="flex items-center gap-0.5 rounded-full border bg-muted/40 p-0.5">
                <button
                  type="button"
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                    colorTarget === 'fill'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setColorTarget('fill')}
                >
                  {selectedNode ? 'Fill' : 'Label'}
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                    colorTarget === 'border'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setColorTarget('border')}
                >
                  {selectedNode ? 'Border' : 'Line'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 px-1">
                {swatches.map((preset) => {
                  const isActive = activeValue.toLowerCase() === preset.toLowerCase()
                  return (
                    <button
                      key={preset}
                      type="button"
                      title={preset}
                      aria-label={`Color ${preset}`}
                      onClick={() =>
                        applyColor(preset === activeDefault ? undefined : preset, colorTarget)
                      }
                      className={cn(
                        'h-5 w-5 shrink-0 rounded-full border border-border shadow-sm transition-transform hover:scale-110',
                        isActive && 'ring-2 ring-primary ring-offset-1 ring-offset-popover',
                      )}
                      style={{ backgroundColor: preset }}
                    />
                  )
                })}
                <label
                  className="relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted"
                  title="Custom color"
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  <input
                    type="color"
                    value={activeValue}
                    onChange={(event) => {
                      const next = normalizeHexColor(event.target.value)
                      applyColor(next === activeDefault ? undefined : next, colorTarget)
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Custom color"
                  />
                </label>
                {!moreColors && (
                  <button
                    type="button"
                    className="rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => setMoreColors(true)}
                  >
                    More
                  </button>
                )}
              </div>
            </>
          )}

          {selectedEdge && (
            <>
              <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
              <select
                value={edgeRouting ?? 'curved'}
                onChange={(event) => updateRouting(event.target.value as EdgeRouting)}
                className="h-8 max-w-[7.5rem] rounded-full border border-input bg-background px-2 text-[11px] text-foreground outline-none"
                aria-label="Connector routing"
              >
                {EDGE_ROUTING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  reverseEdge()
                }}
                disabled={Boolean(selectedEdge?.locked)}
                title={selectedEdge?.locked ? 'Unlock connector to flip' : 'Reverse direction'}
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Flip</span>
              </button>
            </>
          )}

          <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

          {selectedNode && (
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
              onClick={onDuplicate}
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>
          )}

          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>
    </div>
  )
})
