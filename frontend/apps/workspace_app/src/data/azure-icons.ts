export interface AzureIconEntry {
  id: string
  label: string
  description: string
  category: string
  categoryLabel: string
  icon: string
  order: number
}

export interface AzureIconsManifest {
  version: number
  source: string
  syncedAt: string
  count: number
  icons: AzureIconEntry[]
}
