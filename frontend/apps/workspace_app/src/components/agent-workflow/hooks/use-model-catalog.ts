import { useCallback, useEffect, useState } from 'react'
import { fetchModelCatalog, type CatalogModelOption, type ModelCatalog } from '@/services/models-api'
import {
  MODEL_PROVIDERS,
  providerFromHints,
  type ModelProvider,
  type ModelProviderId,
} from '@/components/agent-workflow/model-providers'

// One request per page load, shared by every caller; `reload` refetches.
let pending: Promise<ModelCatalog> | null = null

function loadCatalog(force = false): Promise<ModelCatalog> {
  if (!pending || force) {
    pending = fetchModelCatalog().catch((error: unknown) => {
      pending = null
      throw error
    })
  }
  return pending
}

/** The application's model catalog (Admin center → models): which providers and models exist. */
export function useModelCatalog() {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((force = false) => {
    setError(null)
    loadCatalog(force)
      .then(setCatalog)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load models.'))
  }, [])

  useEffect(() => load(), [load])

  return { catalog, error, loading: catalog === null && error === null, reload: () => load(true) }
}

/** The catalog's providers that map onto a model client this app can run. */
function catalogEntriesFor(catalog: ModelCatalog, providerId: ModelProviderId) {
  return catalog.providers.filter(
    (entry) => providerFromHints(entry.type, entry.id, entry.label)?.id === providerId,
  )
}

/** Model clients the catalog offers, in the app's usual order. */
export function availableModelProviders(catalog: ModelCatalog | null): ModelProvider[] {
  if (!catalog) return []
  return MODEL_PROVIDERS.filter((provider) => catalogEntriesFor(catalog, provider.id).length > 0)
}

/** The models the catalog lists for a model client. */
export function catalogModelsFor(catalog: ModelCatalog | null, providerId: ModelProviderId | undefined): CatalogModelOption[] {
  if (!catalog || !providerId) return []
  const seen = new Set<string>()
  return catalogEntriesFor(catalog, providerId)
    .flatMap((entry) => entry.models)
    .filter((model) => (seen.has(model.id) ? false : (seen.add(model.id), true)))
}
