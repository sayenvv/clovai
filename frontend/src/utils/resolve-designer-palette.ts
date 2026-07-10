import { defaultAppConfig } from '@/config/default-config'
import { FALLBACK_PALETTE } from '@/components/designer/diagram-types'
import type { PaletteItem, Tool } from '@/types/config'

/** Returns the base flowchart palette for a tool (without runtime Azure icons). */
export function resolveDesignerPalette(
  tool: Tool | undefined,
  toolRouteSuffix: string,
): { palette: PaletteItem[]; isToolSpecific: boolean } {
  const defaultTool = defaultAppConfig.megaMenu.tools.find(
    (candidate) => candidate.route === `/tools/${toolRouteSuffix}`,
  )
  const defaultPalette = defaultTool?.designer?.palette
  const activePalette = tool?.designer?.palette

  if (!defaultPalette?.length) {
    return {
      palette: activePalette?.length ? activePalette : FALLBACK_PALETTE,
      isToolSpecific: Boolean(activePalette?.length),
    }
  }

  const defaultVersion = defaultTool?.designer?.paletteVersion ?? 0
  const activeVersion = tool?.designer?.paletteVersion ?? 0
  const isStale =
    !activePalette?.length ||
    activePalette.length < defaultPalette.length ||
    activeVersion < defaultVersion

  if (isStale) {
    return { palette: defaultPalette, isToolSpecific: true }
  }

  return { palette: activePalette, isToolSpecific: true }
}

export function mergePaletteWithAzure(base: PaletteItem[], azureItems: PaletteItem[]): PaletteItem[] {
  const flowchartItems = base.filter((item) => !item.id.startsWith('fc-azure-'))
  return [...flowchartItems, ...azureItems]
}

export function mergePaletteWithCloudProviders(
  base: PaletteItem[],
  cloudItems: PaletteItem[],
): PaletteItem[] {
  const providerIds = /^(fc-azure-|fc-gcp-|fc-aws-)/
  return [...base.filter((item) => !providerIds.test(item.id)), ...cloudItems]
}
