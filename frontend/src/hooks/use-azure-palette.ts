import { useEffect, useState } from 'react'
import type { PaletteItem } from '@/types/config'
import type { AzureIconsManifest } from '@/data/azure-icons'

const MANIFEST_URL = '/cloud-icons/azure/manifest.json'

let cachedManifest: AzureIconsManifest | null = null
let manifestPromise: Promise<AzureIconsManifest> | null = null

function manifestToPaletteItems(manifest: AzureIconsManifest): PaletteItem[] {
  return manifest.icons.map((entry) => ({
    id: entry.id,
    label: entry.label,
    description: entry.description,
    shape: 'service' as const,
    icon: entry.icon,
    color: 'blue' as const,
    group: entry.categoryLabel,
    order: entry.order,
  }))
}

export function loadAzureIconsManifest(): Promise<AzureIconsManifest> {
  if (cachedManifest) return Promise.resolve(cachedManifest)
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Azure manifest HTTP ${res.status}`)
        return res.json() as Promise<AzureIconsManifest>
      })
      .then((manifest) => {
        cachedManifest = manifest
        return manifest
      })
      .catch((error) => {
        manifestPromise = null
        throw error
      })
  }
  return manifestPromise
}

export function useAzurePalette(enabled: boolean) {
  const [items, setItems] = useState<PaletteItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setItems([])
      setCount(0)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    loadAzureIconsManifest()
      .then((manifest) => {
        if (cancelled) return
        setItems(manifestToPaletteItems(manifest))
        setCount(manifest.count)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setItems([])
        setCount(0)
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Failed to load Azure icons')
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { items, count, loading, error }
}

/** Normalize for fuzzy search: lowercase, strip spaces/punctuation. */
export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[\s/_-]+/g, '')
}

export function paletteItemMatchesQuery(item: PaletteItem, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true
  const haystack = normalizeSearchText(
    `${item.label} ${item.description ?? ''} ${item.group ?? ''} ${item.id}`,
  )
  return haystack.includes(normalizedQuery)
}
