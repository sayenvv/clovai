/** Preset swatches + custom picker for shape and connector styling. */
export const COLOR_PRESETS = [
  '#ffffff',
  '#f4f4f5',
  '#e4e4e7',
  '#a1a1aa',
  '#71717a',
  '#3f3f46',
  '#18181b',
  '#000000',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const

export interface DiagramColorOverrides {
  fillColor?: string
  borderColor?: string
}

export interface ResolvedDiagramColors {
  fill: string
  border: string
  text: string
}

export function defaultNodeColors(isDark: boolean): ResolvedDiagramColors {
  return {
    fill: isDark ? '#09090b' : '#ffffff',
    border: isDark ? '#52525b' : '#d4d4d8',
    text: isDark ? '#fafafa' : '#18181b',
  }
}

export function defaultEdgeColors(isDark: boolean): ResolvedDiagramColors {
  return {
    fill: isDark ? '#18181b' : '#ffffff',
    border: isDark ? '#a1a1aa' : '#71717a',
    text: isDark ? '#fafafa' : '#18181b',
  }
}

export function resolveNodeColors(
  overrides: DiagramColorOverrides | undefined,
  isDark: boolean,
): ResolvedDiagramColors {
  const defaults = defaultNodeColors(isDark)
  return {
    fill: overrides?.fillColor ?? defaults.fill,
    border: overrides?.borderColor ?? defaults.border,
    text: defaults.text,
  }
}

export function resolveEdgeColors(
  overrides: DiagramColorOverrides | undefined,
  isDark: boolean,
): ResolvedDiagramColors {
  const defaults = defaultEdgeColors(isDark)
  return {
    fill: overrides?.fillColor ?? defaults.fill,
    border: overrides?.borderColor ?? defaults.border,
    text: defaults.text,
  }
}

export function normalizeHexColor(value: string): string {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#(.)(.)(.)$/) ?? []
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return trimmed
}
