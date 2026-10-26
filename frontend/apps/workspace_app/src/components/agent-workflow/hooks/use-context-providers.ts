import { useEffect, useState } from 'react'
import { authorizedFetch } from '@/services/api-auth'
import { errorMessage } from '@/services/orchestration-api'

/** A context provider an admin offers (Admin Center → Context providers); its settings stay server-side. */
export interface OfferedContextProvider {
  id: string
  name: string
  description: string
  slot: 'memory' | 'knowledge'
}

// One request for the whole canvas: every agent card and the settings panel share it
let offered: Promise<OfferedContextProvider[]> | null = null
// The last list loaded, for code outside React (the workflow JSON is built synchronously)
let latest: OfferedContextProvider[] = []

function loadOffered(): Promise<OfferedContextProvider[]> {
  offered ??= authorizedFetch('/api/v1/context-providers').then(async (response) => {
    if (!response.ok) throw new Error(await errorMessage(response))
    latest = (await response.json()) as OfferedContextProvider[]
    return latest
  })
  offered.catch(() => {
    offered = null // try again next time
  })
  return offered
}

/** The active context providers agents may use; null while loading. */
export function useContextProviders(): { providers: OfferedContextProvider[] | null; error: string } {
  const [providers, setProviders] = useState<OfferedContextProvider[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    loadOffered()
      .then((rows) => live && setProviders(rows))
      .catch((reason: unknown) => live && setError(reason instanceof Error ? reason.message : 'Could not load context providers.'))
    return () => {
      live = false
    }
  }, [])
  return { providers, error }
}

/** The context providers loaded so far (empty until the canvas has fetched them once). */
export function knownContextProviders(): OfferedContextProvider[] {
  return latest
}

/** How many of the agent's context providers fill each slot. Ids no longer offered count as memory. */
export function contextProviderCounts(ids: string[] | undefined, providers: OfferedContextProvider[] | null) {
  const counts = { memory: 0, knowledge: 0 }
  for (const id of ids ?? []) {
    counts[providers?.find((provider) => provider.id === id)?.slot ?? 'memory'] += 1
  }
  return counts
}
