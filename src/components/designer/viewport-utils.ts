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
