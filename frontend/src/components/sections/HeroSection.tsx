import { memo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Bot, GitBranch, Sparkles, Wrench } from 'lucide-react'
import { Icon } from '@/components/shared/Icon'
import { CtaButton } from '@/components/shared/CtaButton'
import { APP_NAME } from '@/constants'
import type { HeroSection as HeroSectionConfig } from '@/types/config'

/** Decorative product mock — agent workflow + flowchart on one canvas. */
const HeroVisual = memo(function HeroVisual() {
  const prefersReducedMotion = useReducedMotion()
  const float = prefersReducedMotion
    ? {}
    : { animate: { y: [0, -6, 0] }, transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' as const } }

  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl" aria-hidden>
      <div className="absolute -inset-x-8 -top-20 h-72 bg-brand-gradient-soft blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border bg-card/90 shadow-brand backdrop-blur-sm">
        <div className="flex items-center gap-1.5 border-b px-5 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <div className="ml-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
              <Bot className="h-3 w-3 text-primary" />
              agent-pipeline
            </span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
              <GitBranch className="h-3 w-3 text-primary" />
              onboarding-flow
            </span>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          <div className="relative border-b p-6 md:border-b-0 md:border-r">
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Agent workflow
            </p>
            <div className="relative flex flex-col items-stretch gap-3">
              <svg className="pointer-events-none absolute left-8 top-10 h-[calc(100%-2.5rem)] w-px text-border" aria-hidden>
                <line x1="0" y1="0" x2="0" y2="100%" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
              {[
                { icon: Bot, label: 'Researcher', meta: 'Agent' },
                { icon: Wrench, label: 'Search API', meta: 'Tool' },
                { icon: Bot, label: 'Planner', meta: 'Agent · approval' },
              ].map(({ icon: NodeIcon, label, meta }, index) => (
                <motion.div
                  key={label}
                  {...float}
                  transition={{ ...float.transition, delay: index * 0.35 }}
                  className="relative z-10 flex items-center gap-3 rounded-xl border bg-background/80 px-3 py-2.5 shadow-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <NodeIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{label}</span>
                    <span className="block text-[11px] text-muted-foreground">{meta}</span>
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative p-6">
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Flowchart
            </p>
            <div className="relative grid grid-cols-3 items-center gap-3 py-2">
              <svg className="absolute inset-0 h-full w-full text-border" aria-hidden>
                <line x1="28%" y1="50%" x2="40%" y2="50%" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                <line x1="60%" y1="50%" x2="72%" y2="50%" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
              </svg>
              {[
                { label: 'Start', shape: 'rounded-full' },
                { label: 'Decision', shape: 'rounded-lg rotate-0' },
                { label: 'Done', shape: 'rounded-full' },
              ].map(({ label, shape }, index) => (
                <motion.div
                  key={label}
                  {...float}
                  transition={{ ...float.transition, delay: 0.2 + index * 0.4 }}
                  className="relative z-10 flex flex-col items-center gap-2"
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center border bg-gradient-to-b from-primary/15 to-primary/5 text-primary shadow-sm sm:h-16 sm:w-16 ${shape}`}
                  >
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium shadow-sm">
                    {label}
                  </span>
                </motion.div>
              ))}
            </div>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Same canvas model — different tools
            </p>
          </div>
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
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,hsl(var(--border)/0.55)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.55)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
        aria-hidden
      />
      <div className="container relative pb-20 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl"
          >
            {APP_NAME}
          </motion.p>

          {section.announcement && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-5"
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
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl md:text-5xl"
          >
            {section.title}{' '}
            {section.highlight && <span className="text-gradient">{section.highlight}</span>}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg"
          >
            {section.subtitle}
          </motion.p>

          {section.ctas.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.26 }}
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
