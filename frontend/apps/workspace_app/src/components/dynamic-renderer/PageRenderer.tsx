import { memo, useEffect, useMemo } from 'react'
import { visibleSorted } from '@/utils/collection'
import { SectionRenderer } from './SectionRenderer'
import type { PageConfig } from '@/types/config'

/** Renders an entire page purely from its JSON configuration. */
export const PageRenderer = memo(function PageRenderer({ page }: { page: PageConfig }) {
  const sections = useMemo(() => visibleSorted(page.sections), [page.sections])

  useEffect(() => {
    document.title = page.title
  }, [page.title])

  return (
    <>
      {sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </>
  )
})
