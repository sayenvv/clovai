/** Shared layout constants and persisted panel config for agent workflow. */

export const SIDE_PANEL_COLLAPSED_WIDTH = 56
export const BOTTOM_PANEL_COLLAPSED_HEIGHT = 36

export interface PersistedPanelConfig {
  sizeKey: string
  collapsedKey: string
  defaultSize: number
  /** When no saved preference exists, start collapsed. */
  defaultCollapsed?: boolean
  responsiveDefault?: (viewportWidth: number) => number
  min: number
  max?: number
}

export const EDITOR_LEFT_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-agent-workflow-left-panel-width',
  collapsedKey: 'eleven-nodes-agent-workflow-left-panel-collapsed-v2',
  defaultSize: 260,
  defaultCollapsed: true,
  min: 220,
  max: 420,
}

export const EDITOR_RIGHT_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-agent-workflow-right-panel-width',
  // v2: the panel now shows Insights by default; the old key held "collapsed" for everyone
  collapsedKey: 'eleven-nodes-agent-workflow-right-panel-collapsed-v2',
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
    const stored = localStorage.getItem(config.collapsedKey)
    if (stored === null) return Boolean(config.defaultCollapsed)
    return stored === 'true'
  } catch {
    return Boolean(config.defaultCollapsed)
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

/** App builder, template mode: the settings on the left and the design assistant on the right. */
export const APP_BUILDER_SETTINGS_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-app-builder-settings-width',
  collapsedKey: 'eleven-nodes-app-builder-settings-collapsed',
  defaultSize: 320,
  responsiveDefault: (viewportWidth) => Math.round(viewportWidth * 0.22),
  min: 260,
  max: 460,
}

export const APP_BUILDER_ASSISTANT_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-app-builder-assistant-width',
  collapsedKey: 'eleven-nodes-app-builder-assistant-collapsed',
  defaultSize: 340,
  responsiveDefault: (viewportWidth) => Math.round(viewportWidth * 0.24),
  min: 280,
  max: 560,
}

/** App builder, code mode: the project's files on the left and the builder chat on the right. */
export const APP_BUILDER_FILES_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-app-builder-files-width',
  collapsedKey: 'eleven-nodes-app-builder-files-collapsed',
  defaultSize: 240,
  min: 180,
  max: 400,
}

export const APP_BUILDER_CHAT_PANEL: PersistedPanelConfig = {
  sizeKey: 'eleven-nodes-app-builder-chat-width',
  collapsedKey: 'eleven-nodes-app-builder-chat-collapsed',
  defaultSize: 400,
  responsiveDefault: (viewportWidth) => Math.round(viewportWidth * 0.3),
  min: 320,
  max: 680,
}
