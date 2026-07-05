import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, GitBranch, Database, Boxes, Sparkles } from 'lucide-react'
import { Icon } from '@/components/shared/Icon'
import { CtaButton } from '@/components/shared/CtaButton'
import type { HeroSection as HeroSectionConfig } from '@/types/config'

/** Decorative diagram mockup rendered with pure CSS — no image assets. */
const HeroVisual = memo(function HeroVisual() {
  const prefersReducedMotion = useReducedMotion()
  const float = prefersReducedMotion
    ? {}
    : { animate: { y: [0, -8, 0] }, transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' as const } }

  return (
    <div className="relative mx-auto mt-16 w-full max-w-4xl" aria-hidden>
      <div className="absolute -inset-x-8 -top-16 h-64 bg-brand-gradient-soft blur-3xl" />
      <div className="relative rounded-2xl border bg-card/80 p-6 shadow-2xl shadow-primary/10 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 border-b pb-4">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <div className="ml-4 flex items-center gap-2 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            checkout-flow.clov — designed on the Clovai canvas
          </div>
        </div>

        <div className="relative grid grid-cols-3 items-center gap-6 py-10 sm:gap-10">
          <svg className="absolute inset-0 h-full w-full text-border" aria-hidden>
            <line x1="30%" y1="50%" x2="45%" y2="50%" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="63%" y1="50%" x2="78%" y2="50%" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
          </svg>

          {[
            { icon: GitBranch, label: 'Checkout UI', tone: 'from-primary/15 to-primary/5 text-primary' },
            { icon: Boxes, label: 'Payments API', tone: 'from-rose-600/15 to-rose-600/5 text-rose-600' },
            { icon: Database, label: 'Ledger DB', tone: 'from-red-600/15 to-red-600/5 text-red-600' },
          ].map(({ icon: NodeIcon, label, tone }, index) => (
            <motion.div
              key={label}
              {...float}
              transition={{ ...float.transition, delay: index * 0.6 }}
              className="relative z-10 flex flex-col items-center gap-3"
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border bg-gradient-to-b shadow-lg sm:h-20 sm:w-20 ${tone}`}
              >
                <NodeIcon className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium shadow-sm">
                {label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
})

interface HeroSectionProps {
  section: HeroSectionConfig
}

function HeroSectionComponent({ section }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_55%)]"
        aria-hidden
      />
      <div className="container relative pb-20 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          {section.announcement && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <a
                href={section.announcement.href ?? '#'}
                className="group inline-flex items-center gap-2 rounded-full border bg-muted/50 py-1 pl-3 pr-2 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                {section.announcement.icon && (
                  <Icon name={section.announcement.icon} className="h-3.5 w-3.5 text-primary" aria-hidden />
                )}
                {section.announcement.label}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </a>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl"
          >
            {section.title} {section.highlight && <span className="text-gradient">{section.highlight}</span>}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg"
          >
            {section.subtitle}
          </motion.p>

          {section.ctas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              {section.ctas.map((cta) => (
                <CtaButton key={cta.id} cta={cta} size="lg" />
              ))}
            </motion.div>
          )}
        </div>

        {section.showVisual && <HeroVisual />}

        {section.stats.length > 0 && (
          <motion.dl
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-8 border-t pt-10 sm:grid-cols-4"
          >
            {section.stats.map((stat) => (
              <div key={stat.id} className="text-center">
                <dd className="text-2xl font-bold tracking-tight md:text-3xl">{stat.value}</dd>
                <dt className="mt-1 text-xs text-muted-foreground md:text-sm">{stat.label}</dt>
              </div>
            ))}
          </motion.dl>
        )}
      </div>
    </section>
  )
}

export default memo(HeroSectionComponent)
