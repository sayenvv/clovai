import { memo, useMemo } from 'react'
import { byOrder } from '@/utils/collection'
import { Icon } from '@/components/shared/Icon'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { StepsSection as StepsSectionConfig } from '@/types/config'

function StepsSectionComponent({ section }: { section: StepsSectionConfig }) {
  const steps = useMemo(() => byOrder(section.steps), [section.steps])

  return (
    <section id={section.id} className="section-padding scroll-mt-16">
      <div className="container">
        <SectionHeading heading={section.heading} />
        <div className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          <div
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            aria-hidden
          />
          {steps.map((step, index) => (
            <Reveal key={step.id} delay={index * 0.12} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border bg-background shadow-md">
                  {step.icon ? (
                    <Icon name={step.icon} className="h-6 w-6 text-primary" aria-hidden />
                  ) : (
                    <span className="text-lg font-bold text-primary">{index + 1}</span>
                  )}
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export default memo(StepsSectionComponent)
