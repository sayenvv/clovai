import {
  buildEdgePath,
  edgeLabelPosition,
  getNodeSize,
  nodeRouteObstacle,
  portPoint,
  resolveNodeStyle,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
  type EdgeRouteContext,
} from './diagram-types'
import { resolveEdgeColors, resolveNodeColors } from './diagram-colors'
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
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${fill}" stroke="${border}" stroke-width="2" />`
  }
}

function renderNodeSvg(
  node: DiagramNode,
  item: PaletteItem,
  isDark: boolean,
): string {
  const { shape, colorOverrides } = resolveNodeStyle(node, item)
  const { width, height } = getNodeSize(node, shape)
  const { fill, border, text } = resolveNodeColors(colorOverrides, isDark)
  const label = escapeXml(node.label.trim() || item.label)
  const cx = node.x + width / 2
  const cy = node.y + height / 2

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
  const routing = edge.routing ?? 'orthogonal'
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
    markup += `<g>
      <rect x="${midpoint.x - 28}" y="${midpoint.y - 11}" width="56" height="22" rx="4" fill="${colors.fill}" stroke="${colors.border}" stroke-width="1" />
      <text x="${midpoint.x}" y="${midpoint.y + 1}" text-anchor="middle" dominant-baseline="middle" fill="${colors.text}" font-size="11" font-family="system-ui, -apple-system, sans-serif">${escapeXml(label)}</text>
    </g>`
  }

  return `<g data-edge-id="${escapeXml(edge.id)}">${markup}</g>`
}

/** Builds an SVG document for the diagram (vector export). */
export function buildDiagramSvg(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
  isDark: boolean,
  backgroundColor?: string,
): { svg: string; width: number; height: number } {
  const padding = 48
  const bounds = computeBounds(diagram, paletteById, padding)
  const bg = backgroundColor ?? (isDark ? '#18181b' : '#ffffff')

  const edges = diagram.edges
    .map((edge) => renderEdgeSvg(edge, diagram, paletteById, isDark))
    .join('\n')
  const nodes = diagram.nodes
    .map((node) => {
      const item = paletteById.get(node.paletteId)
      return item ? renderNodeSvg(node, item, isDark) : ''
    })
    .join('\n')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">
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
): Promise<Blob> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * pixelRatio)
    canvas.height = Math.ceil(height * pixelRatio)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')

    context.scale(pixelRatio, pixelRatio)
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('PNG export failed'))),
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image data'))
    reader.readAsDataURL(blob)
  })
}

/** Export the active diagram page in the requested format. */
export async function exportDiagram(options: DiagramExportOptions, format: DiagramExportFormat) {
  const base = slugFileName(options.fileBaseName)
  const backgroundColor = options.backgroundColor ?? (options.isDark ? '#18181b' : '#ffffff')

  if (format === 'json') {
    downloadJson(options.diagram, `${base}.json`)
    return
  }

  const { svg, width, height } = buildDiagramSvg(
    options.diagram,
    options.paletteById,
    options.isDark,
    backgroundColor,
  )

  if (format === 'svg') {
    downloadText(svg, `${base}.svg`, 'image/svg+xml;charset=utf-8')
    return
  }

  const pngBlob = await svgToPngBlob(svg, width, height, backgroundColor)

  if (format === 'png') {
    downloadBlob(pngBlob, `${base}.png`)
    return
  }

  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf')
    const dataUrl = await blobToDataUrl(pngBlob)
    const orientation = width >= height ? 'landscape' : 'portrait'
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [width, height],
      hotfixes: ['px_scaling'],
    })
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height)
    pdf.save(`${base}.pdf`)
  }
}
