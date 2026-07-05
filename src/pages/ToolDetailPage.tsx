import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAppConfig } from '@/hooks/use-app-config'
import { Icon } from '@/components/shared/Icon'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { ShapePalette } from '@/components/designer/ShapePalette'
import { DesignerCanvas } from '@/components/designer/DesignerCanvas'
import { DesignerToolbar } from '@/components/designer/DesignerToolbar'
import {
  FALLBACK_PALETTE,
  nodeSize,
  type Diagram,
  type DiagramEdge,
  type Viewport,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'

const EMPTY_DIAGRAM: Diagram = { nodes: [], edges: [] }
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

const storageKey = (toolId: string) => `clovai-diagram-${toolId}`

function loadDiagram(toolId: string): Diagram {
  try {
    const raw = localStorage.getItem(storageKey(toolId))
    if (raw) {
      // Older drafts were saved before edges carried port sides.
      type StoredDiagram = Omit<Diagram, 'edges'> & {
        edges?: Array<Omit<DiagramEdge, 'fromSide' | 'toSide'> & Partial<DiagramEdge>>
      }
      const parsed = JSON.parse(raw) as StoredDiagram
      const edges: DiagramEdge[] = (parsed.edges ?? []).map((edge) => ({
        ...edge,
        fromSide: edge.fromSide ?? 'right',
        toSide: edge.toSide ?? 'left',
      }))
      return { nodes: parsed.nodes ?? [], edges }
    }
  } catch {
    // corrupted draft — start fresh
  }
  return EMPTY_DIAGRAM
}

/** Standalone tool workspace (opened in its own tab, no site navbar):
 *  an n8n-style canvas designer. The shape palette comes from the tool's
 *  JSON `designer` config; AI generation (Clovai Engine) is coming soon. */
export default function ToolDetailPage() {
  const { toolId = '' } = useParams()
  const { megaMenu, navbar } = useAppConfig()

  const tool = useMemo(
    () => megaMenu.tools.find((t) => t.route === `/tools/${toolId}` && t.isVisible !== false),
    [megaMenu.tools, toolId],
  )

  const palette: PaletteItem[] = tool?.designer?.palette ?? FALLBACK_PALETTE
  const paletteById = useMemo(() => {
    const map = new Map<string, PaletteItem>()
    palette.forEach((item) => map.set(item.id, item))
    return map
  }, [palette])

  const [diagram, setDiagram] = useState<Diagram>(() => loadDiagram(toolId))
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tool) document.title = `${tool.title} — Clovai`
  }, [tool])

  // Autosave draft per tool.
  useEffect(() => {
    localStorage.setItem(storageKey(toolId), JSON.stringify(diagram))
  }, [diagram, toolId])

  const handleChange = useCallback((updater: (previous: Diagram) => Diagram) => {
    setDiagram(updater)
  }, [])

  const handleViewportChange = useCallback((updater: (previous: Viewport) => Viewport) => {
    setViewport(updater)
  }, [])

  const addAtCenter = useCallback(
    (paletteId: string) => {
      const item = paletteById.get(paletteId)
      if (!item) return
      const { width, height } = nodeSize(item.shape)

      // Place the node at the center of the visible canvas area.
      const rect = canvasAreaRef.current?.getBoundingClientRect()
      const visibleWidth = rect?.width ?? window.innerWidth
      const visibleHeight = rect?.height ?? window.innerHeight
      const centerX = (visibleWidth / 2 - viewport.x) / viewport.scale
      const centerY = (visibleHeight / 2 - viewport.y) / viewport.scale

      const node = {
        id: `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        paletteId,
        label: item.label,
        x: centerX - width / 2,
        y: centerY - height / 2,
      }
      setDiagram((previous) => {
        // Nudge so stacked additions stay visible.
        const offset = (previous.nodes.length % 5) * 16
        return {
          ...previous,
          nodes: [...previous.nodes, { ...node, x: node.x + offset, y: node.y + offset }],
        }
      })
    },
    [paletteById, viewport],
  )

  const zoomBy = useCallback((factor: number) => {
    setViewport((previous) => ({
      ...previous,
      scale: Math.min(2.5, Math.max(0.4, previous.scale * factor)),
    }))
  }, [])

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${toolId}-diagram.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [diagram, toolId])

  if (!tool) return <Navigate to="/404" replace />

  const category = megaMenu.categories.find((c) => c.id === tool.category)

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Workspace header (replaces the site navbar) */}
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
        <Link
          to="/"
          className="flex items-center gap-2"
          aria-label={`${navbar.logo.text} home`}
          title="Back to Clovai"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-sm">
            <Icon name={navbar.logo.icon} className="h-4 w-4" aria-hidden />
          </span>
        </Link>

        <div className="h-6 w-px bg-border" aria-hidden />

        <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted/50">
          <Icon name={tool.icon} className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{tool.title}</h1>
            <ConfigBadge badge={tool.badge} className="px-1.5 py-0 text-[10px]" />
          </div>
          {category && (
            <p className="text-[11px] text-muted-foreground">
              {category.title} · Draft autosaved locally
            </p>
          )}
        </div>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      <DesignerToolbar
        scale={viewport.scale}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onResetView={() => setViewport(DEFAULT_VIEWPORT)}
        onClear={() => setDiagram(EMPTY_DIAGRAM)}
        onExport={exportJson}
        isEmpty={diagram.nodes.length === 0}
      />

      <div className="flex min-h-0 flex-1">
        <ShapePalette
          palette={palette}
          isToolSpecific={Boolean(tool.designer)}
          toolTitle={tool.title}
          onAdd={addAtCenter}
        />
        <div ref={canvasAreaRef} className="min-w-0 flex-1">
          <DesignerCanvas
            diagram={diagram}
            onChange={handleChange}
            paletteById={paletteById}
            viewport={viewport}
            onViewportChange={handleViewportChange}
          />
        </div>
      </div>
    </div>
  )
}
