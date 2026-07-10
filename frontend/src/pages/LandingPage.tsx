import { useMemo } from 'react'
import { useAppConfig } from '@/hooks/use-app-config'
import { PageRenderer } from '@/components/dynamic-renderer/PageRenderer'

/** The landing page is 100% JSON-driven: it simply resolves the page with
 *  an empty slug from the active configuration and hands it to the renderer. */
export default function LandingPage() {
  const config = useAppConfig()
  const page = useMemo(
    () => config.pages.find((p) => p.slug === '' && p.isVisible !== false),
    [config.pages],
  )

  if (!page) {
    return (
      <div className="container py-24 text-center text-muted-foreground">
        The active configuration does not define a landing page.
      </div>
    )
  }

  return (
    <div className="professional-home">
      <PageRenderer page={page} />
    </div>
  )
}
