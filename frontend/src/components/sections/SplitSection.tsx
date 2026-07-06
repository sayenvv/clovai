import { memo } from 'react'
import { ShieldCheck, Lock, FileCheck2, Fingerprint } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Icon } from '@/components/shared/Icon'
import { CtaButton } from '@/components/shared/CtaButton'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { SplitSection as SplitSectionConfig } from '@/types/config'

/** Decorative enterprise/security visual rendered with CSS only. */
const SecurityVisual = memo(function SecurityVisual() {
  const badges = [
    { icon: ShieldCheck, label: 'SOC 2 Type II' },
    { icon: Lock, label: 'AES-256 at rest' },
    { icon: FileCheck2, label: 'GDPR & DPA' },
    { icon: Fingerprint, label: 'SSO / SCIM' },
  ]
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-8 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.15),transparent_65%)] blur-2xl" />
      <div className="relative grid grid-cols-2 gap-4">
        {badges.map(({ icon: BadgeIcon, label }, index) => (
          <div
            key={label}
            className={cn(
              'flex flex-col items-center gap-3 rounded-2xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm',
              index % 2 === 1 && 'translate-y-6',
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BadgeIcon className="h-6 w-6" />
            </div>
            <span className="text-center text-xs font-semibold">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

function SplitSectionComponent({ section }: { section: SplitSectionConfig }) {
  return (
    <section id={section.id} className="section-padding scroll-mt-16">
      <div className="container">
        <div
          className={cn(
            'grid items-center gap-12 lg:grid-cols-2 lg:gap-20',
            section.imagePosition === 'left' && 'lg:[&>*:first-child]:order-2',
          )}
        >
          <div>
            <SectionHeading heading={section.heading} className="mb-6 md:mb-6" />
            <Reveal>
              <p className="text-base leading-relaxed text-muted-foreground">{section.description}</p>
              <div className="mt-8 flex flex-col gap-6">
                {section.bullets.map((bullet) => (
                  <div key={bullet.id} className="flex gap-4">
                    {bullet.icon && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                        <Icon name={bullet.icon} className="h-5 w-5 text-primary" aria-hidden />
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold">{bullet.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {bullet.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {section.cta && (
                <div className="mt-8">
                  <CtaButton cta={section.cta} size="lg" />
                </div>
              )}
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <SecurityVisual />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export default memo(SplitSectionComponent)
