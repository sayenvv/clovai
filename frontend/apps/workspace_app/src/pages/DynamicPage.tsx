import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAppConfig } from '@/hooks/use-app-config'
import { PageRenderer } from '@/components/dynamic-renderer/PageRenderer'

/** Catch-all route: any page added to the JSON configuration under a slug
 *  becomes reachable at /:slug without touching React code. */
export default function DynamicPage() {
  const { slug = '' } = useParams()
  const config = useAppConfig()

  const page = useMemo(
    () => config.pages.find((p) => p.slug === slug && p.isVisible !== false),
    [config.pages, slug],
  )

  if (!page) return <Navigate to="/404" replace />

  return <PageRenderer page={page} />
}
