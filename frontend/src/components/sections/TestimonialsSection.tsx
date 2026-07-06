import { memo, useMemo } from 'react'
import { Star } from 'lucide-react'
import { byOrder } from '@/utils/collection'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { TestimonialsSection as TestimonialsSectionConfig } from '@/types/config'

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function TestimonialsSectionComponent({ section }: { section: TestimonialsSectionConfig }) {
  const items = useMemo(() => byOrder(section.items), [section.items])

  return (
    <section id={section.id} className="section-padding scroll-mt-16">
      <div className="container">
        <SectionHeading heading={section.heading} />
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.08} className="h-full">
              <figure className="flex h-full flex-col rounded-2xl border bg-card p-7 shadow-sm transition-shadow hover:shadow-md">
                {typeof item.rating === 'number' && (
                  <div className="mb-4 flex gap-0.5" aria-label={`${item.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={starIndex}
                        className={
                          starIndex < (item.rating ?? 0)
                            ? 'h-4 w-4 fill-amber-400 text-amber-400'
                            : 'h-4 w-4 text-muted'
                        }
                        aria-hidden
                      />
                    ))}
                  </div>
                )}
                <blockquote className="flex-1 text-sm leading-relaxed text-foreground/90">
                  “{item.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t pt-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials(item.author)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{item.author}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.role}
                      {item.company && ` · ${item.company}`}
                    </div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export default memo(TestimonialsSectionComponent)
