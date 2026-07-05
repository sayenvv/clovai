import { memo } from 'react'
import { CtaButton } from '@/components/shared/CtaButton'
import { Reveal } from '@/components/shared/Reveal'
import type { CtaSection as CtaSectionConfig } from '@/types/config'

function CtaSectionComponent({ section }: { section: CtaSectionConfig }) {
  return (
    <section id={section.id} className="scroll-mt-16 py-20">
      <div className="container">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-red-800 via-primary to-rose-900 px-8 py-16 text-center shadow-2xl shadow-primary/25 md:py-20">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_45%)]"
              aria-hidden
            />
            <h2 className="relative mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="relative mx-auto mt-4 max-w-xl text-sm text-white/80 md:text-base">
                {section.subtitle}
              </p>
            )}
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              {section.ctas.map((cta) => (
                <CtaButton
                  key={cta.id}
                  cta={cta}
                  size="lg"
                  className={
                    cta.variant === 'outline'
                      ? 'border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white'
                      : 'bg-white from-white to-white text-primary shadow-none hover:bg-white/90 hover:brightness-100'
                  }
                />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default memo(CtaSectionComponent)
