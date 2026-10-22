import {
  buildEdgePath,
  edgeLabelPosition,
  getNodeSize,
  nodeRouteObstacle,
  portPoint,
  resolveEdgeRouting,
  resolveNodeStyle,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type EdgeRouteContext,
} from './diagram-types'
import { resolveEdgeColors, resolveNodeColors } from './diagram-colors'
import { connectorLabelHeight, connectorLabelLines, connectorLabelWidth } from './connector-label'
import { downloadBlob, downloadJson, downloadText } from '@/utils/download'
import type { PaletteItem, PaletteShape } from '@/types/config'

export type DiagramExportFormat = 'json' | 'svg' | 'png' | 'pdf'

export interface DiagramExportOptions {
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  isDark: boolean
  fileBaseName: string
  /** Background for raster exports; SVG uses transparent unless set. */
  backgroundColor?: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image data'))
    reader.readAsDataURL(blob)
  })
}

/** Cache icon fetches so multi-format exports reuse the same embeds. */
const iconDataUrlCache = new Map<string, Promise<string | null>>()

/** Resolve a palette icon path to an embedded data URL for portable SVG/PNG/PDF. */
function resolveIconDataUrl(iconPath: string): Promise<string | null> {
  if (iconPath.startsWith('data:')) return Promise.resolve(iconPath)

  const cached = iconDataUrlCache.get(iconPath)
  if (cached) return cached

  const pending = (async () => {
    try {
      const response = await fetch(iconPath)
      if (!response.ok) return null
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('svg') || iconPath.toLowerCase().endsWith('.svg')) {
        const svgText = await response.text()
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
      }
      return await blobToDataUrl(await response.blob())
    } catch {
      return null
    }
  })()

  iconDataUrlCache.set(iconPath, pending)
  return pending
}

async function collectIconDataUrls(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
): Promise<Map<string, string>> {
  const paths = new Set<string>()
  for (const node of diagram.nodes) {
    const item = paletteById.get(node.paletteId)
    if (item?.icon) paths.add(item.icon)
  }

  const embedded = new Map<string, string>()
  await Promise.all(
    [...paths].map(async (path) => {
      const dataUrl = await resolveIconDataUrl(path)
      if (dataUrl) embedded.set(path, dataUrl)
    }),
  )
  return embedded
}

function slugFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'diagram'
}

function computeBounds(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
  padding: number,
): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of diagram.nodes) {
    const item = paletteById.get(node.paletteId)
    if (!item) continue
    const { shape } = resolveNodeStyle(node, item)
    const { width, height } = getNodeSize(node, shape)
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + width)
    maxY = Math.max(maxY, node.y + height)
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, width: 800, height: 600 }
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

function buildRouteContext(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
): EdgeRouteContext {
  return {
    obstacles: diagram.nodes.flatMap((node) => {
      const item = paletteById.get(node.paletteId)
      if (!item) return []
      return [nodeRouteObstacle(node, resolveNodeStyle(node, item).shape)]
    }),
    fromNodeId: '',
    toNodeId: '',
  }
}

function shapeBodyMarkup(
  node: DiagramNode,
  shape: PaletteShape,
  width: number,
  height: number,
  fill: string,
  border: string,
): string {
  const { x, y } = node
  const cx = x + width / 2
  const cy = y + height / 2

  switch (shape) {
    case 'decision':
    case 'parallel-gateway':
      return `<polygon points="${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}" fill="${fill}" stroke="${border}" stroke-width="2" stroke-linejoin="round" />`
    case 'triangle':
      return `<polygon points="${x},${y} ${x + width},${y} ${cx},${y + height}" fill="${fill}" stroke="${border}" stroke-width="2" stroke-linejoin="round" />`
    case 'circle':
    case 'terminator':
    case 'connector':
    case 'event':
    case 'or-gate':
    case 'ellipse':
      return `<ellipse cx="${cx}" cy="${cy}" rx="${width / 2}" ry="${height / 2}" fill="${fill}" stroke="${border}" stroke-width="2" />`
    case 'note':
      return `<path d="M ${x} ${y} H ${x + width - 12} L ${x + width} ${y + 12} V ${y + height} H ${x} Z" fill="${fill}" stroke="${border}" stroke-width="2" stroke-linejoin="round" />`
    default:
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="0" fill="${fill}" stroke="${border}" stroke-width="2" />`
  }
}

function renderNodeSvg(
  node: DiagramNode,
  item: PaletteItem,
  isDark: boolean,
  iconDataUrls: Map<string, string>,
): string {
  const { shape, colorOverrides } = resolveNodeStyle(node, item)
  const { width, height } = getNodeSize(node, shape)
  const { fill, border, text } = resolveNodeColors(colorOverrides, isDark)
  const label = escapeXml(node.label.trim() || item.label)
  const cx = node.x + width / 2
  const cy = node.y + height / 2

  if (shape === 'service') {
    const iconSize = Math.min(width, height)
    const iconHref = item.icon ? iconDataUrls.get(item.icon) : undefined
    if (!iconHref) {
      // Fallback when the icon could not be embedded.
      return `<g data-node-id="${escapeXml(node.id)}">
        <rect x="${node.x}" y="${node.y}" width="${iconSize}" height="${iconSize}" fill="${fill}" stroke="${border}" stroke-width="1" />
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${text}" font-size="10" font-family="system-ui, -apple-system, sans-serif">${label}</text>
      </g>`
    }
    const iconX = node.x + (width - iconSize) / 2
    const iconY = node.y + (height - iconSize) / 2
    const safeHref = escapeXml(iconHref)
    return `<g data-node-id="${escapeXml(node.id)}">
      <image href="${safeHref}" xlink:href="${safeHref}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet" />
    </g>`
  }

  return `<g data-node-id="${escapeXml(node.id)}">
    ${shapeBodyMarkup(node, shape, width, height, fill, border)}
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${text}" font-size="12" font-family="system-ui, -apple-system, sans-serif">${label}</text>
  </g>`
}

function renderEdgeSvg(
  edge: DiagramEdge,
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
  isDark: boolean,
): string {
  const from = diagram.nodes.find((node) => node.id === edge.from)
  const to = diagram.nodes.find((node) => node.id === edge.to)
  if (!from || !to) return ''

  const fromItem = paletteById.get(from.paletteId)
  const toItem = paletteById.get(to.paletteId)
  if (!fromItem || !toItem) return ''

  const fromStyle = resolveNodeStyle(from, fromItem)
  const toStyle = resolveNodeStyle(to, toItem)
  const routing = resolveEdgeRouting(edge.routing)
  const fromPoint = portPoint(from, fromStyle.shape, edge.fromSide)
  const toPoint = portPoint(to, toStyle.shape, edge.toSide)
  const routeContext: EdgeRouteContext = {
    ...buildRouteContext(diagram, paletteById),
    fromNodeId: edge.from,
    toNodeId: edge.to,
  }
  const path = buildEdgePath(
    fromPoint,
    edge.fromSide,
    toPoint,
    edge.toSide,
    routing,
    routeContext,
  )
  const colors = resolveEdgeColors(
    { fillColor: edge.fillColor, borderColor: edge.borderColor },
    isDark,
  )
  const label = edge.label?.trim()
  const midpoint = edgeLabelPosition(
    fromPoint,
    edge.fromSide,
    toPoint,
    edge.toSide,
    routing,
    routeContext,
  )

  let markup = `<path d="${path}" fill="none" stroke="${colors.border}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#export-arrow)" />`

  if (label) {
    const endpointGap = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y)
    const labelWidth = connectorLabelWidth(label, endpointGap - 48)
    const lines = connectorLabelLines(label, labelWidth)
    const lineHeight = 14
    const labelHeight = connectorLabelHeight(lines.length)
    const clipId = `edge-label-clip-${edge.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    const firstLineY = midpoint.y - ((lines.length - 1) * lineHeight) / 2
    const textMarkup = lines
      .map((line, index) =>
        index === 0
          ? `<tspan x="${midpoint.x}" y="${firstLineY}">${escapeXml(line)}</tspan>`
          : `<tspan x="${midpoint.x}" dy="${lineHeight}">${escapeXml(line)}</tspan>`,
      )
      .join('')
    markup += `<g>
      <defs>
        <clipPath id="${clipId}">
          <rect x="${midpoint.x - labelWidth / 2}" y="${midpoint.y - labelHeight / 2}" width="${labelWidth}" height="${labelHeight}" />
        </clipPath>
      </defs>
      <rect x="${midpoint.x - labelWidth / 2}" y="${midpoint.y - labelHeight / 2}" width="${labelWidth}" height="${labelHeight}" rx="0" fill="${colors.fill}" stroke="${colors.border}" stroke-width="1" />
      <text text-anchor="middle" fill="${colors.text}" font-size="11" font-family="system-ui, -apple-system, sans-serif" clip-path="url(#${clipId})">${textMarkup}</text>
    </g>`
  }

  return `<g data-edge-id="${escapeXml(edge.id)}">${markup}</g>`
}

/** Builds an SVG document for the diagram (vector export). Icons are inlined. */
export async function buildDiagramSvg(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
  isDark: boolean,
  backgroundColor?: string,
): Promise<{ svg: string; width: number; height: number }> {
  const padding = 48
  const bounds = computeBounds(diagram, paletteById, padding)
  const bg = backgroundColor ?? (isDark ? '#18181b' : '#ffffff')
  const iconDataUrls = await collectIconDataUrls(diagram, paletteById)

  const edges = diagram.edges
    .map((edge) => renderEdgeSvg(edge, diagram, paletteById, isDark))
    .join('\n')
  const nodes = diagram.nodes
    .map((node) => {
      const item = paletteById.get(node.paletteId)
      return item ? renderNodeSvg(node, item, isDark, iconDataUrls) : ''
    })
    .join('\n')

  // 100vw/100vh so opening the SVG fills the browser/viewer; viewBox keeps aspect ratio.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%" viewBox="0 0 ${bounds.width} ${bounds.height}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100vw;height:100vh;background-color:${bg}">
  <defs>
    <marker id="export-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="context-stroke" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="${bg}" />
  <g transform="translate(${-bounds.minX} ${-bounds.minY})">
    ${edges}
    ${nodes}
  </g>
</svg>`

  return { svg, width: bounds.width, height: bounds.height }
}

/** Target frame for PNG/PDF — diagram scaled to fill, letterboxed on theme background. */
const EXPORT_FRAME = { width: 1920, height: 1080 }

function fitInFrame(
  contentWidth: number,
  contentHeight: number,
  frameWidth = EXPORT_FRAME.width,
  frameHeight = EXPORT_FRAME.height,
): { frameWidth: number; frameHeight: number; drawWidth: number; drawHeight: number; offsetX: number; offsetY: number } {
  const scale = Math.min(frameWidth / Math.max(contentWidth, 1), frameHeight / Math.max(contentHeight, 1))
  const drawWidth = contentWidth * scale
  const drawHeight = contentHeight * scale
  return {
    frameWidth,
    frameHeight,
    drawWidth,
    drawHeight,
    offsetX: (frameWidth - drawWidth) / 2,
    offsetY: (frameHeight - drawHeight) / 2,
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to render diagram image'))
    image.src = url
  })
}

async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  backgroundColor: string,
  pixelRatio = 2,
): Promise<{ blob: Blob; width: number; height: number }> {
  // Rasterize from a fixed-size SVG so canvas draw matches content bounds.
  const rasterSvg = svg
    .replace(/width="100%"/, `width="${width}"`)
    .replace(/height="100%"/, `height="${height}"`)
    .replace(/style="[^"]*"/, '')
  const blob = new Blob([rasterSvg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    const fitted = fitInFrame(width, height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(fitted.frameWidth * pixelRatio)
    canvas.height = Math.ceil(fitted.frameHeight * pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')

    context.scale(pixelRatio, pixelRatio)
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, fitted.frameWidth, fitted.frameHeight)
    context.drawImage(
      image,
      fitted.offsetX,
      fitted.offsetY,
      fitted.drawWidth,
      fitted.drawHeight,
    )

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('PNG export failed'))),
        'image/png',
      )
    })
    return { blob: pngBlob, width: fitted.frameWidth, height: fitted.frameHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Export the active diagram page in the requested format. */
export async function exportDiagram(options: DiagramExportOptions, format: DiagramExportFormat) {
  const base = slugFileName(options.fileBaseName)
  const backgroundColor = options.backgroundColor ?? (options.isDark ? '#18181b' : '#ffffff')

  if (format === 'json') {
    downloadJson(options.diagram, `${base}.json`)
    return
  }

  const { svg, width, height } = await buildDiagramSvg(
    options.diagram,
    options.paletteById,
    options.isDark,
    backgroundColor,
  )

  if (format === 'svg') {
    downloadText(svg, `${base}.svg`, 'image/svg+xml;charset=utf-8')
    return
  }

  const { blob: pngBlob, width: frameWidth, height: frameHeight } = await svgToPngBlob(
    svg,
    width,
    height,
    backgroundColor,
  )

  if (format === 'png') {
    downloadBlob(pngBlob, `${base}.png`)
    return
  }

  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf')
    const dataUrl = await blobToDataUrl(pngBlob)
    const orientation = frameWidth >= frameHeight ? 'landscape' : 'portrait'
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [frameWidth, frameHeight],
      hotfixes: ['px_scaling'],
    })
    pdf.addImage(dataUrl, 'PNG', 0, 0, frameWidth, frameHeight)
    pdf.save(`${base}.pdf`)
  }
}
