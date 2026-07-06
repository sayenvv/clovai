export const CODE_EXPORT_PREVIEW_BANNER =
  'Preview sample generated from your diagram — full API integration coming in a future update.'

export const CODE_PANEL_WIDTH = {
  min: 280,
  max: 720,
  default: 360,
} as const

export const MIN_VIEWPORT_SCALE = 0.4
export const MAX_VIEWPORT_SCALE = 2.5

export function clampViewportScale(scale: number): number {
  return Math.min(MAX_VIEWPORT_SCALE, Math.max(MIN_VIEWPORT_SCALE, scale))
}
