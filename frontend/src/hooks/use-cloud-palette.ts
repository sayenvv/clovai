import { useEffect, useState } from 'react'
import type { PaletteItem } from '@/types/config'

type CloudManifest = {
  count: number
  icons: Array<{
    id: string
    label: string
    description: string
    categoryLabel: string
    icon: string
    order: number
  }>
}

const PROVIDERS = [
  { id: 'gcp', label: 'Google Cloud', color: 'cyan' as const },
  { id: 'aws', label: 'AWS', color: 'amber' as const },
]

let cache: PaletteItem[] | null = null

export function useCloudPalette(enabled: boolean) {
  const [items, setItems] = useState<PaletteItem[]>(cache ?? [])
  const [loading, setLoading] = useState(enabled && !cache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || cache) return
    let cancelled = false
    setLoading(true)

    Promise.all(
      PROVIDERS.map(async (provider) => {
        const response = await fetch(`/cloud-icons/${provider.id}/manifest.json`)
        if (!response.ok) throw new Error(`${provider.label} manifest HTTP ${response.status}`)
        const manifest = (await response.json()) as CloudManifest
        return manifest.icons.map((entry) => ({
          id: entry.id,
          label: entry.label,
          description: entry.description,
          shape: 'service' as const,
          icon: entry.icon,
          color: provider.color,
          group: `${provider.label} · ${entry.categoryLabel}`,
          order: entry.order,
        }))
      }),
    )
      .then((collections) => {
        if (cancelled) return
        const combined = collections.flat()
        cache = combined
        setItems(combined)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : 'Failed to load cloud icons')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [enabled])

  return { items, count: items.length, loading, error }
}
