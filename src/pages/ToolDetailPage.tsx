import { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppConfig } from '@/hooks/use-app-config'
import { Icon } from '@/components/shared/Icon'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { ShapePalette } from '@/components/designer/ShapePalette'
import { DesignerCanvas, type Selection } from '@/components/designer/DesignerCanvas'
import { DesignerMenubar } from '@/components/designer/DesignerMenubar'
import { PropertiesPanel } from '@/components/designer/PropertiesPanel'
import { PagesBar } from '@/components/designer/PagesBar'
import { resolveDesignerPalette } from '@/utils/resolve-designer-palette'
import { STORAGE_KEYS } from '@/constants'
import { clampViewportScale } from '@/constants/designer'
import { downloadJson } from '@/utils/download'
import {
  createNodeId,
  createPage,
  getNodeSize,
  nodeSize,
  normalizeDocument,
  resolveNodeStyle,
  type Diagram,
  type DiagramDocument,
  type Viewport,
} from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'

const CodeExportPanel = lazy(() =>
  import('@/components/designer/CodeExportPanel').then((module) => ({
    default: module.CodeExportPanel,
  })),
)

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

function loadDocument(toolId: string): DiagramDocument {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.diagram(toolId))
    if (raw) return normalizeDocument(JSON.parse(raw))
  } catch {
    // corrupted draft — start fresh
  }
  return normalizeDocument(null)
}

/** Standalone tool workspace (opened in its own tab, no site navbar):
 *  an n8n-style canvas designer with multiple pages. The shape palette
 *  comes from the tool's JSON `designer` config; AI generation (Clovai
 *  Engine) is coming soon. */
export default function ToolDetailPage() {
  const { toolId = '' } = useParams()
  const { megaMenu, navbar } = useAppConfig()

  const tool = useMemo(
    () => megaMenu.tools.find((t) => t.route === `/tools/${toolId}` && t.isVisible !== false),
    [megaMenu.tools, toolId],
  )

  const { palette, isToolSpecific } = useMemo(
    () => resolveDesignerPalette(tool, toolId),
    [tool, toolId],
  )
  const paletteById = useMemo(() => {
    const map = new Map<string, PaletteItem>()
    palette.forEach((item) => map.set(item.id, item))
    return map
  }, [palette])

  const [doc, setDoc] = useState<DiagramDocument>(() => loadDocument(toolId))
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT)
  const [selection, setSelection] = useState<Selection>(null)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [codeExportOpen, setCodeExportOpen] = useState(false)
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const activePage = doc.pages.find((page) => page.id === doc.activePageId) ?? doc.pages[0]
  const diagram = activePage.diagram

  useEffect(() => {
    if (tool) document.title = `${tool.title} — Clovai`
  }, [tool])

  // Autosave the whole document per tool.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.diagram(toolId), JSON.stringify(doc))
  }, [doc, toolId])

  /* ---- active-page diagram updates ---- */
  const handleChange = useCallback((updater: (previous: Diagram) => Diagram) => {
    setDoc((previous) => ({
      ...previous,
      pages: previous.pages.map((page) =>
        page.id === previous.activePageId ? { ...page, diagram: updater(page.diagram) } : page,
      ),
    }))
  }, [])

  const handleViewportChange = useCallback((updater: (previous: Viewport) => Viewport) => {
    setViewport(updater)
  }, [])

  /* ---- page management ---- */
  const selectPage = useCallback((pageId: string) => {
    setDoc((previous) => ({ ...previous, activePageId: pageId }))
    setSelection(null)
  }, [])

  const addPage = useCallback(() => {
    setDoc((previous) => {
      const page = createPage(`Page ${previous.pages.length + 1}`)
      return { pages: [...previous.pages, page], activePageId: page.id }
    })
    setSelection(null)
  }, [])

  const renamePage = useCallback((pageId: string, name: string) => {
    setDoc((previous) => ({
      ...previous,
      pages: previous.pages.map((page) => (page.id === pageId ? { ...page, name } : page)),
    }))
  }, [])

  const deletePage = useCallback((pageId: string) => {
    setDoc((previous) => {
      if (previous.pages.length <= 1) return previous
      const pages = previous.pages.filter((page) => page.id !== pageId)
      const activePageId =
        previous.activePageId === pageId ? pages[pages.length - 1].id : previous.activePageId
      return { pages, activePageId }
    })
    setSelection(null)
  }, [])

  /* ---- canvas actions ---- */
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
        id: createNodeId(),
        paletteId,
        label: item.label,
        x: centerX - width / 2,
        y: centerY - height / 2,
      }
      handleChange((previous) => {
        // Nudge so stacked additions stay visible.
        const offset = (previous.nodes.length % 5) * 16
        return {
          ...previous,
          nodes: [...previous.nodes, { ...node, x: node.x + offset, y: node.y + offset }],
        }
      })
    },
    [paletteById, viewport, handleChange],
  )

  const zoomBy = useCallback((factor: number) => {
    setViewport((previous) => ({
      ...previous,
      scale: clampViewportScale(previous.scale * factor),
    }))
  }, [])

  const fitToContent = useCallback(() => {
    if (diagram.nodes.length === 0) return
    const rect = canvasAreaRef.current?.getBoundingClientRect()
    if (!rect) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    diagram.nodes.forEach((node) => {
      const item = paletteById.get(node.paletteId)
      if (!item) return
      const { width, height } = getNodeSize(node, resolveNodeStyle(node, item).shape)
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + width)
      maxY = Math.max(maxY, node.y + height)
    })

    const padding = 80
    const contentWidth = maxX - minX + padding * 2
    const contentHeight = maxY - minY + padding * 2
    const scale = Math.min(rect.width / contentWidth, rect.height / contentHeight, 1.5)
    setViewport({
      scale,
      x: rect.width / 2 - ((minX + maxX) / 2) * scale,
      y: rect.height / 2 - ((minY + maxY) / 2) * scale,
    })
  }, [diagram.nodes, paletteById])

  const duplicateSelection = useCallback(() => {
    if (selection?.kind !== 'node') return
    handleChange((previous) => {
      const source = previous.nodes.find((node) => node.id === selection.id)
      if (!source) return previous
      const copy = {
        ...source,
        id: createNodeId(),
        x: source.x + 24,
        y: source.y + 24,
      }
      return { ...previous, nodes: [...previous.nodes, copy] }
    })
  }, [selection, handleChange])

  const deleteSelection = useCallback(() => {
    if (!selection) return
    handleChange((previous) => {
      if (selection.kind === 'edge') {
        return { ...previous, edges: previous.edges.filter((edge) => edge.id !== selection.id) }
      }
      return {
        nodes: previous.nodes.filter((node) => node.id !== selection.id),
        edges: previous.edges.filter(
          (edge) => edge.from !== selection.id && edge.to !== selection.id,
        ),
      }
    })
    setSelection(null)
  }, [selection, handleChange])

  const clearActivePage = useCallback(() => {
    handleChange(() => ({ nodes: [], edges: [] }))
    setSelection(null)
  }, [handleChange])

  /* ---- import / export (whole document, all pages) ---- */
  const exportJson = useCallback(() => {
    downloadJson(doc, `${toolId}-diagram.json`)
  }, [doc, toolId])

  const toggleCodeExport = useCallback(() => {
    setCodeExportOpen((open) => {
      if (!open) setSelection(null)
      return !open
    })
  }, [])

  const handleImportFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const imported = normalizeDocument(JSON.parse(String(reader.result)))
          const known = imported.pages.every((page) =>
            page.diagram.nodes.every((node) => paletteById.has(node.paletteId)),
          )
          if (!known) throw new Error('contains shapes not in this tool\u2019s palette')
          setDoc(imported)
          setSelection(null)
          toast.success(`Imported ${file.name} (${imported.pages.length} page${imported.pages.length === 1 ? '' : 's'})`)
        } catch (error) {
          toast.error(
            `Could not import: ${error instanceof Error ? error.message : 'invalid file'}`,
          )
        }
      }
      reader.readAsText(file)
    },
    [paletteById],
  )

  if (!tool) return <Navigate to="/404" replace />

  const category = megaMenu.categories.find((c) => c.id === tool.category)

  return (
    <div className="workspace-surface flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Workspace header (replaces the site navbar) */}
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
        <Link
          to="/"
          className="flex items-center gap-2"
          aria-label={`${navbar.logo.text} home`}
          title="Back to Clovai"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-sm">
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

      <DesignerMenubar
        scale={viewport.scale}
        selection={selection}
        isEmpty={diagram.nodes.length === 0}
        snapToGrid={snapToGrid}
        showGrid={showGrid}
        onNew={clearActivePage}
        onImport={() => importInputRef.current?.click()}
        onExport={exportJson}
        onViewCode={toggleCodeExport}
        onDuplicate={duplicateSelection}
        onDeleteSelection={deleteSelection}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onResetView={() => setViewport(DEFAULT_VIEWPORT)}
        onFitToContent={fitToContent}
        onSnapToGridChange={setSnapToGrid}
        onShowGridChange={setShowGrid}
      />

      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleImportFile(file)
          event.target.value = ''
        }}
      />

      <div className="flex min-h-0 flex-1">
        <ShapePalette
          palette={palette}
          isToolSpecific={isToolSpecific}
          toolTitle={tool.title}
          onAdd={addAtCenter}
        />
        {/* Canvas column: the pages bar only spans the canvas, not the sidebars. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={canvasAreaRef} className="min-h-0 min-w-0 flex-1">
            <DesignerCanvas
              key={activePage.id}
              diagram={diagram}
              onChange={handleChange}
              paletteById={paletteById}
              viewport={viewport}
              onViewportChange={handleViewportChange}
              selection={selection}
              onSelectionChange={setSelection}
              snapToGrid={snapToGrid}
              showGrid={showGrid}
            />
          </div>
          <PagesBar
            pages={doc.pages}
            activePageId={activePage.id}
            onSelect={selectPage}
            onAdd={addPage}
            onRename={renamePage}
            onDelete={deletePage}
          />
        </div>
        {!codeExportOpen && (
          <PropertiesPanel
            diagram={diagram}
            selection={selection}
            paletteById={paletteById}
            onChange={handleChange}
            onDuplicate={duplicateSelection}
            onDelete={deleteSelection}
            onClose={() => setSelection(null)}
          />
        )}
        {codeExportOpen && (
          <Suspense fallback={null}>
            <CodeExportPanel
              diagram={diagram}
              paletteById={paletteById}
              pageName={activePage.name}
              toolTitle={tool.title}
              onClose={() => setCodeExportOpen(false)}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
