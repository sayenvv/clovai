import { memo } from 'react'
import { cn } from '@/utils/cn'
import type { SectionHeading as SectionHeadingConfig } from '@/types/config'
import { Reveal } from './Reveal'

/** Standard eyebrow / title / subtitle block used by every section. */
export const SectionHeading = memo(function SectionHeading({
  heading,
  className,
}: {
  heading?: SectionHeadingConfig
  className?: string
}) {
  if (!heading) return null
  const centered = heading.align !== 'left'

  return (
    <Reveal
      className={cn('mb-12 max-w-2xl md:mb-16', centered ? 'mx-auto text-center' : 'text-left', className)}
    >
      {heading.eyebrow && (
        <span className="mb-3 inline-block rounded-full border bg-muted/50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          {heading.eyebrow}
        </span>
      )}
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
        {heading.title}{' '}
        {heading.highlight && <span className="text-gradient">{heading.highlight}</span>}
      </h2>
      {heading.subtitle && (
        <p className="mt-4 text-base text-muted-foreground md:text-lg">{heading.subtitle}</p>
      )}
    </Reveal>
  )
})
