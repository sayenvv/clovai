import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense, lazy } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { APP_NAME } from '@/constants'
import { useAppConfig } from '@/hooks/use-app-config'
import { Icon } from '@/components/shared/Icon'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import { useTheme } from '@/hooks/use-theme'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { ShapePalette } from '@/components/designer/ShapePalette'
import { DesignerCanvas, type Selection } from '@/components/designer/DesignerCanvas'
import { DesignerMenubar } from '@/components/designer/DesignerMenubar'
import { ShareDialog } from '@/components/designer/ShareDialog'
import { PropertiesPanel } from '@/components/designer/PropertiesPanel'
import { PagesBar } from '@/components/designer/PagesBar'
import { computeCenteredViewport, zoomViewportAt } from '@/components/designer/viewport-utils'
import { resolveDesignerPalette, mergePaletteWithCloudProviders } from '@/utils/resolve-designer-palette'
import { useAzurePalette } from '@/hooks/use-azure-palette'
import { useCloudPalette } from '@/hooks/use-cloud-palette'
import { STORAGE_KEYS } from '@/constants'
import { exportDiagram } from '@/components/designer/diagram-export'
import { downloadJson } from '@/utils/download'
import {
  createNodeId,
  createPage,
  nodeSize,
  normalizeDocument,
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
 *  comes from the tool's JSON `designer` config; AI generation (Eleven Nodes
 *  Engine) is coming soon. */
export default function ToolDetailPage() {
  const { toolId = '' } = useParams()
  const { megaMenu, navbar } = useAppConfig()
  const { isDark } = useTheme()

  const isDiagramGenerator = toolId === 'ai-flowchart'

  const tool = useMemo(
    () => megaMenu.tools.find((t) => t.route === `/tools/${toolId}` && t.isVisible !== false),
    [megaMenu.tools, toolId],
  )

  const { palette: basePalette, isToolSpecific } = useMemo(
    () => resolveDesignerPalette(tool, toolId),
    [tool, toolId],
  )
  const {
    items: azureItems,
    count: azureCount,
    loading: azureLoading,
    error: azureError,
  } = useAzurePalette(isDiagramGenerator)
  const {
    items: providerItems,
    count: providerCount,
    loading: providerLoading,
    error: providerError,
  } = useCloudPalette(isDiagramGenerator)
  const palette = useMemo(
    () => isDiagramGenerator
      ? mergePaletteWithCloudProviders(basePalette, [...azureItems, ...providerItems])
      : basePalette,
    [isDiagramGenerator, basePalette, azureItems, providerItems],
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
  const [shareOpen, setShareOpen] = useState(false)
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const activePage = doc.pages.find((page) => page.id === doc.activePageId) ?? doc.pages[0]
  const diagram = activePage.diagram
  const diagramRef = useRef(diagram)
  diagramRef.current = diagram

  useEffect(() => {
    if (tool) document.title = `${tool.title} — ${APP_NAME}`
  }, [tool])

  // Autosave the whole document per tool.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.diagram(toolId), JSON.stringify(doc))
  }, [doc, toolId])

  const applyCenteredViewport = useCallback(
    (targetDiagram: Diagram) => {
      const rect = canvasAreaRef.current?.getBoundingClientRect()
      if (!rect?.width || !rect?.height) return
      setViewport(computeCenteredViewport(targetDiagram, paletteById, rect.width, rect.height))
    },
    [paletteById],
  )

  const centerViewport = useCallback(() => {
    applyCenteredViewport(diagram)
  }, [applyCenteredViewport, diagram])

  // Center the active page on load, refresh, and page switch.
  useLayoutEffect(() => {
    applyCenteredViewport(diagramRef.current)
    const frame = requestAnimationFrame(() => applyCenteredViewport(diagramRef.current))
    return () => cancelAnimationFrame(frame)
  }, [toolId, activePage.id, applyCenteredViewport])

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
    setViewport((previous) => {
      const rect = canvasAreaRef.current?.getBoundingClientRect()
      const anchorX = rect ? rect.width / 2 : 0
      const anchorY = rect ? rect.height / 2 : 0
      return zoomViewportAt(previous, factor, anchorX, anchorY)
    })
  }, [])

  const fitToContent = useCallback(() => {
    centerViewport()
  }, [centerViewport])

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
      if (selection.kind === 'nodes') {
        const removeIds = new Set(selection.ids)
        return {
          nodes: previous.nodes.filter((node) => !removeIds.has(node.id)),
          edges: previous.edges.filter(
            (edge) => !removeIds.has(edge.from) && !removeIds.has(edge.to),
          ),
        }
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

  /* ---- import / export ---- */
  const exportBaseName = `${tool?.title ?? toolId}-${activePage.name}`

  const exportOptions = useCallback(
    () => ({
      diagram,
      paletteById,
      isDark,
      fileBaseName: exportBaseName,
    }),
    [diagram, paletteById, isDark, exportBaseName],
  )

  const exportJson = useCallback(() => {
    downloadJson(doc, `${toolId}-diagram.json`)
  }, [doc, toolId])

  const runImageExport = useCallback(
    async (format: 'svg' | 'png' | 'pdf') => {
      if (diagram.nodes.length === 0) return
      try {
        await exportDiagram(exportOptions(), format)
        toast.success(`Exported ${format.toUpperCase()}`)
      } catch (error) {
        toast.error(
          `Export failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        )
      }
    },
    [diagram.nodes.length, exportOptions],
  )

  const exportSvg = useCallback(() => runImageExport('svg'), [runImageExport])
  const exportPng = useCallback(() => runImageExport('png'), [runImageExport])
  const exportPdf = useCallback(() => runImageExport('pdf'), [runImageExport])

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
          requestAnimationFrame(() => {
            const page =
              imported.pages.find((p) => p.id === imported.activePageId) ?? imported.pages[0]
            applyCenteredViewport(page.diagram)
          })
        } catch (error) {
          toast.error(
            `Could not import: ${error instanceof Error ? error.message : 'invalid file'}`,
          )
        }
      }
      reader.readAsText(file)
    },
    [paletteById, applyCenteredViewport],
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
          title={`Back to ${APP_NAME}`}
        >
          <Logo src={navbar.logo.image} size={LOGO_SIZE_WORKSPACE} rounded="md" />
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
          <ProfileMenu />
        </div>
      </div>

      {!isDiagramGenerator && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          documentTitle={tool.title}
          toolId={toolId}
        />
      )}

      <DesignerMenubar
        selection={selection}
        isEmpty={diagram.nodes.length === 0}
        snapToGrid={snapToGrid}
        showGrid={showGrid}
        onNew={clearActivePage}
        onImport={() => importInputRef.current?.click()}
        onExportJson={exportJson}
        onExportSvg={exportSvg}
        onExportPng={exportPng}
        onExportPdf={exportPdf}
        onViewCode={toggleCodeExport}
        onDuplicate={duplicateSelection}
        onDeleteSelection={deleteSelection}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onResetView={centerViewport}
        onFitToContent={fitToContent}
        onSnapToGridChange={setSnapToGrid}
        onShowGridChange={setShowGrid}
        onShare={isDiagramGenerator ? undefined : () => setShareOpen(true)}
        toolId={toolId}
        onManageAccess={isDiagramGenerator ? undefined : () => setShareOpen(true)}
        showShare={!isDiagramGenerator}
        showWorkspaceMembers={!isDiagramGenerator}
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
          cloudCount={azureCount + providerCount}
          cloudLoading={azureLoading || providerLoading}
          cloudError={azureError ?? providerError}
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
              onZoomIn={() => zoomBy(1.2)}
              onZoomOut={() => zoomBy(1 / 1.2)}
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
