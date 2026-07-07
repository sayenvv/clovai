/** Shared layout constants and persisted panel config for agent workflow. */

export const SIDE_PANEL_COLLAPSED_WIDTH = 44
export const BOTTOM_PANEL_COLLAPSED_HEIGHT = 36

export interface PersistedPanelConfig {
  sizeKey: string
  collapsedKey: string
  defaultSize: number
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
  min: 280,
  max: 560,
}

export const EDITOR_BOTTOM_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-agent-workflow-panel-height',
  collapsedKey: 'eleven-nodes-agent-workflow-panel-collapsed',
  defaultSize: 260,
  min: 140,
  max: 560,
}

export function readStoredSize(config: PersistedPanelConfig): number {
  try {
    const stored = localStorage.getItem(config.sizeKey)
    if (!stored) return config.defaultSize
    const parsed = Number.parseInt(stored, 10)
    if (Number.isNaN(parsed) || parsed < config.min) return config.defaultSize
    if (config.max !== undefined && parsed > config.max) return config.defaultSize
    return parsed
  } catch {
    return config.defaultSize
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
