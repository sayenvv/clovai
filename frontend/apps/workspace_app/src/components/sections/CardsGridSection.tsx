import { memo, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { visibleSorted } from '@/utils/collection'
import { Icon } from '@/components/shared/Icon'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { Card as CardConfig, CardsGridSection as CardsGridSectionConfig } from '@/types/config'

const columnClasses: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

const FeatureCard = memo(function FeatureCard({ card, index }: { card: CardConfig; index: number }) {
  const body = (
    <div className="group relative h-full rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start justify-between">
        {card.icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon name={card.icon} className="h-5 w-5" aria-hidden />
          </div>
        )}
        <ConfigBadge badge={card.badge} />
      </div>
      <h3 className="mt-4 font-semibold">{card.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
    </div>
  )

  return (
    <Reveal delay={Math.min(index * 0.06, 0.3)}>
      {card.href ? (
        <Link to={card.href} className="block h-full">
          {body}
        </Link>
      ) : (
        body
      )}
    </Reveal>
  )
})

function CardsGridSectionComponent({ section }: { section: CardsGridSectionConfig }) {
  const cards = useMemo(() => visibleSorted(section.cards), [section.cards])

  return (
    <section id={section.id} className="section-padding scroll-mt-16">
      <div className="container">
        <SectionHeading heading={section.heading} />
        <div className={cn('grid grid-cols-1 gap-5', columnClasses[section.columns])}>
          {cards.map((card, index) => (
            <FeatureCard key={card.id} card={card} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default memo(CardsGridSectionComponent)
