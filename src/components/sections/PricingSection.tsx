import { memo, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import { byOrder } from '@/utils/collection'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import { CtaButton } from '@/components/shared/CtaButton'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { PricingPlan, PricingSection as PricingSectionConfig } from '@/types/config'

const PlanCard = memo(function PlanCard({
  plan,
  yearly,
  index,
}: {
  plan: PricingPlan
  yearly: boolean
  index: number
}) {
  const price = yearly && plan.price.yearly ? plan.price.yearly : plan.price.monthly

  return (
    <Reveal delay={index * 0.08} className="h-full">
      <div
        className={cn(
          'relative flex h-full flex-col rounded-2xl border bg-card p-7 shadow-sm transition-shadow hover:shadow-md',
          plan.isFeatured &&
            'border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/30',
        )}
      >
        {plan.badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <ConfigBadge badge={plan.badge} className="shadow-md" />
          </div>
        )}
        <h3 className="font-semibold">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
        <div className="mt-5 flex items-baseline gap-1.5">
          <span className="text-4xl font-extrabold tracking-tight">{price}</span>
          {plan.price.suffix && (
            <span className="text-sm text-muted-foreground">{plan.price.suffix}</span>
          )}
        </div>
        <ul className="mt-6 flex flex-1 flex-col gap-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3 w-3 text-primary" aria-hidden />
              </span>
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-7">
          <CtaButton cta={plan.cta} className="w-full" />
        </div>
      </div>
    </Reveal>
  )
})

function PricingSectionComponent({ section }: { section: PricingSectionConfig }) {
  const [yearly, setYearly] = useState(true)
  const plans = useMemo(() => byOrder(section.plans), [section.plans])
  const hasYearly = plans.some((plan) => plan.price.yearly)

  return (
    <section id={section.id} className="section-padding scroll-mt-16 bg-muted/30">
      <div className="container">
        <SectionHeading heading={section.heading} />

        {hasYearly && (
          <div className="mb-10 flex items-center justify-center gap-3">
            <Label htmlFor="billing-toggle" className={cn(!yearly && 'text-foreground', yearly && 'text-muted-foreground')}>
              Monthly
            </Label>
            <Switch id="billing-toggle" checked={yearly} onCheckedChange={setYearly} />
            <Label htmlFor="billing-toggle" className={cn(yearly && 'text-foreground', !yearly && 'text-muted-foreground')}>
              Yearly <span className="ml-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Save 25%</span>
            </Label>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} yearly={yearly} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default memo(PricingSectionComponent)
