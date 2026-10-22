import { memo, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { sectionRegistry } from './section-registry'
import type { Section } from '@/types/config'

function SectionFallback() {
  return (
    <div className="container py-16">
      <Skeleton className="mx-auto mb-4 h-8 w-64" />
      <Skeleton className="mx-auto mb-10 h-4 w-96 max-w-full" />
      <div className="grid gap-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/** Renders a single JSON section via the registry, isolated behind its
 *  own error boundary so one bad section never takes down the page. */
export const SectionRenderer = memo(function SectionRenderer({ section }: { section: Section }) {
  if (section.isVisible === false) return null

  const Component = sectionRegistry[section.type]
  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(`[SectionRenderer] Unknown section type "${section.type}" (id: ${section.id})`)
    }
    return null
  }

  return (
    <ErrorBoundary label={`section "${section.id}"`}>
      <Suspense fallback={<SectionFallback />}>
        <Component section={section} />
      </Suspense>
    </ErrorBoundary>
  )
})
