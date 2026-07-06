import { memo, useMemo } from 'react'
import { byOrder } from '@/utils/collection'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { AccordionSection as AccordionSectionConfig } from '@/types/config'

function AccordionSectionComponent({ section }: { section: AccordionSectionConfig }) {
  const items = useMemo(() => byOrder(section.items), [section.items])

  return (
    <section id={section.id} className="section-padding scroll-mt-16">
      <div className="container max-w-3xl">
        <SectionHeading heading={section.heading} />
        <Reveal>
          <Accordion type="single" collapsible className="rounded-xl border bg-card px-6 shadow-sm">
            {items.map((item, index) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className={index === items.length - 1 ? 'border-none' : undefined}
              >
                <AccordionTrigger className="text-sm font-medium md:text-base">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}

export default memo(AccordionSectionComponent)
