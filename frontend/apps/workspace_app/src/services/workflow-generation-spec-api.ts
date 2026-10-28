import { authorizedFetch } from '@/services/api-auth'
import type { PublishedGenerationSpec } from '@/types/workflow-generation-spec'

/** The generation spec the canvas follows: the latest one published in the Admin Center, else the built-in one. */
export async function fetchGenerationSpec(): Promise<PublishedGenerationSpec> {
  const response = await authorizedFetch('/api/v1/workflow-generation-spec')
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null
    throw new Error(
      typeof body?.detail === 'string' ? body.detail : `Could not load the workflow generation spec (${response.status})`,
    )
  }
  return (await response.json()) as PublishedGenerationSpec
}

const SPEC_TTL_MS = 60 * 1000
let cachedSpec: { at: number; spec: Promise<PublishedGenerationSpec> } | null = null

/** The generation spec for code outside React (saving, running), re-read at most once a minute. */
export function getGenerationSpec(): Promise<PublishedGenerationSpec> {
  if (!cachedSpec || Date.now() - cachedSpec.at > SPEC_TTL_MS) {
    const spec = fetchGenerationSpec()
    cachedSpec = { at: Date.now(), spec }
    spec.catch(() => {
      cachedSpec = null
    })
  }
  return cachedSpec.spec
}
