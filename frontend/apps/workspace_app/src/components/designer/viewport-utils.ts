import { clampViewportScale } from '@/constants/designer'
import type { PaletteItem } from '@/types/config'
import {
  getNodeSize,
  resolveNodeStyle,
  type Diagram,
  type Viewport,
} from './diagram-types'

const CONTENT_PADDING = 80

/** Pan/zoom so diagram content sits in the middle of the canvas. */
export function computeCenteredViewport(
  diagram: Diagram,
  paletteById: Map<string, PaletteItem>,
  canvasWidth: number,
  canvasHeight: number,
): Viewport {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return { x: 0, y: 0, scale: 1 }
  }

  if (diagram.nodes.length === 0) {
    return { x: canvasWidth / 2, y: canvasHeight / 2, scale: 1 }
  }

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

  const contentWidth = maxX - minX + CONTENT_PADDING * 2
  const contentHeight = maxY - minY + CONTENT_PADDING * 2
  const fitScale = Math.min(canvasWidth / contentWidth, canvasHeight / contentHeight, 1.5)
  const scale = clampViewportScale(fitScale)

  const contentCenterX = (minX + maxX) / 2
  const contentCenterY = (minY + maxY) / 2

  return {
    scale,
    x: canvasWidth / 2 - contentCenterX * scale,
    y: canvasHeight / 2 - contentCenterY * scale,
  }
}

/** Zoom toward a screen-space anchor (cursor or canvas center). */
export function zoomViewportAt(
  viewport: Viewport,
  factor: number,
  anchorX: number,
  anchorY: number,
): Viewport {
  const scale = clampViewportScale(viewport.scale * factor)
  const ratio = scale / viewport.scale
  return {
    scale,
    x: anchorX - (anchorX - viewport.x) * ratio,
    y: anchorY - (anchorY - viewport.y) * ratio,
  }
}

/** Pan so a diagram node sits near the center of the visible canvas area. */
export function viewportCenteringNode(
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
  boundsMinX: number,
  boundsMinY: number,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
): Pick<Viewport, 'x' | 'y'> {
  const centerX = nodeX + nodeWidth / 2
  const centerY = nodeY + nodeHeight / 2
  return {
    x: canvasWidth / 2 - (centerX - boundsMinX) * scale,
    y: canvasHeight / 2 - (centerY - boundsMinY) * scale,
  }
}

export interface FitViewportOptions {
  padding?: number
  minZoom?: number
  maxZoom?: number
}

/** DevUI-style fitView for a single node (padding ~0.3, zoom clamped 0.8–1.5). */
export function fitViewportToNode(
  nodeX: number,
  nodeY: number,
  nodeWidth: number,
  nodeHeight: number,
  boundsMinX: number,
  boundsMinY: number,
  canvasWidth: number,
  canvasHeight: number,
  options: FitViewportOptions = {},
): Viewport {
  const padding = options.padding ?? 0.3
  const minZoom = options.minZoom ?? 0.8
  const maxZoom = options.maxZoom ?? 1.5
  const padX = canvasWidth * padding
  const padY = canvasHeight * padding
  const availableWidth = Math.max(canvasWidth - padX * 2, 1)
  const availableHeight = Math.max(canvasHeight - padY * 2, 1)
  const scaleX = availableWidth / Math.max(nodeWidth, 1)
  const scaleY = availableHeight / Math.max(nodeHeight, 1)
  const scale = clampViewportScale(Math.max(Math.min(scaleX, scaleY, maxZoom), minZoom))
  return {
    ...viewportCenteringNode(
      nodeX,
      nodeY,
      nodeWidth,
      nodeHeight,
      boundsMinX,
      boundsMinY,
      canvasWidth,
      canvasHeight,
      scale,
    ),
    scale,
  }
}

/** Fit the full workflow bounds in view (DevUI uses padding ~0.2 on completion). */
export function fitViewportToBounds(
  bounds: { width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  options: FitViewportOptions = {},
): Viewport {
  const padding = options.padding ?? 0.2
  const maxZoom = options.maxZoom ?? 1.5
  const padX = canvasWidth * padding
  const padY = canvasHeight * padding
  const availableWidth = Math.max(canvasWidth - padX * 2, 1)
  const availableHeight = Math.max(canvasHeight - padY * 2, 1)
  const scaleX = availableWidth / Math.max(bounds.width, 1)
  const scaleY = availableHeight / Math.max(bounds.height, 1)
  const scale = clampViewportScale(Math.min(scaleX, scaleY, maxZoom))
  return {
    scale,
    x: (canvasWidth - bounds.width * scale) / 2,
    y: (canvasHeight - bounds.height * scale) / 2,
  }
}
