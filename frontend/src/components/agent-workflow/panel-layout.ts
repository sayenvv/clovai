/** Shared layout constants and persisted panel config for agent workflow. */

export const SIDE_PANEL_COLLAPSED_WIDTH = 44
export const BOTTOM_PANEL_COLLAPSED_HEIGHT = 36

export interface PersistedPanelConfig {
  sizeKey: string
  collapsedKey: string
  defaultSize: number
  responsiveDefault?: (viewportWidth: number) => number
  min: number
  max?: number
}

export const EDITOR_LEFT_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-agent-workflow-left-panel-width',
  collapsedKey: 'eleven-nodes-agent-workflow-left-panel-collapsed',
  defaultSize: 260,
  min: 220,
  max: 420,
}

export const EDITOR_RIGHT_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-agent-workflow-right-panel-width',
  collapsedKey: 'eleven-nodes-agent-workflow-right-panel-collapsed',
  defaultSize: 340,
  responsiveDefault: (viewportWidth) => Math.round(viewportWidth * 0.28),
  min: 320,
  max: 560,
}

export const EDITOR_BOTTOM_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-agent-workflow-panel-height',
  collapsedKey: 'eleven-nodes-agent-workflow-panel-collapsed',
  defaultSize: 260,
  min: 140,
  max: 560,
}

function clampPanelSize(config: PersistedPanelConfig, size: number): number {
  const max = config.max ?? Number.POSITIVE_INFINITY
  return Math.min(max, Math.max(config.min, size))
}

export function getPanelDefaultSize(config: PersistedPanelConfig): number {
  if (typeof window === 'undefined' || !config.responsiveDefault) {
    return clampPanelSize(config, config.defaultSize)
  }
  return clampPanelSize(config, config.responsiveDefault(window.innerWidth))
}

export function readStoredSize(config: PersistedPanelConfig): number {
  try {
    const stored = localStorage.getItem(config.sizeKey)
    const defaultSize = getPanelDefaultSize(config)
    if (!stored) return defaultSize
    const parsed = Number.parseInt(stored, 10)
    if (Number.isNaN(parsed)) return defaultSize
    return clampPanelSize(config, parsed)
  } catch {
    return getPanelDefaultSize(config)
  }
}

export function readStoredCollapsed(config: PersistedPanelConfig): boolean {
  try {
    return localStorage.getItem(config.collapsedKey) === 'true'
  } catch {
    return false
  }
}

export function persistPanelSize(config: PersistedPanelConfig, size: number, collapsed: boolean) {
  if (collapsed) return
  try {
    localStorage.setItem(config.sizeKey, String(size))
  } catch {
    // ignore
  }
}

export function persistPanelCollapsed(config: PersistedPanelConfig, collapsed: boolean) {
  try {
    localStorage.setItem(config.collapsedKey, String(collapsed))
  } catch {
    // ignore
  }
}
