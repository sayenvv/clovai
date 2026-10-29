import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Minus } from 'lucide-react'
import { ButtonLink } from '@/components/ButtonLink'
import { Heading } from '@/components/Heading'
import { Reveal } from '@/components/Reveal'
import { COMPARISON, PLANS, PRICING_FAQ, yearlyDiscount, type Plan } from '@/content/plans'
import { site } from '@/config'

type Billing = 'monthly' | 'yearly'

function price(plan: Plan, billing: Billing): string {
  if (plan.monthly === null) return 'Custom'
  // Yearly prices round to whole dollars a month
  const value = billing === 'yearly' ? Math.round(plan.monthly * (1 - yearlyDiscount)) : plan.monthly
  return `$${value}`
}

function BillingToggle({ billing, onChange }: { billing: Billing; onChange: (billing: Billing) => void }) {
  return (
    <div className="glass relative inline-flex rounded-full p-1" role="radiogroup" aria-label="Billing period">
      {(['monthly', 'yearly'] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={billing === option}
          onClick={() => onChange(option)}
          className={`relative z-10 flex h-9 items-center gap-2 rounded-full px-5 text-[13.5px] font-medium transition-colors ${billing === option ? 'text-white' : 'text-bone-muted hover:text-bone'}`}
        >
          {billing === option ? (
            <motion.span layoutId="billing" className="absolute inset-0 -z-10 rounded-full bg-bone" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
          ) : null}
          {option === 'monthly' ? 'Monthly' : 'Yearly'}
          {option === 'yearly' ? (
            <span className={`rounded-full px-1.5 py-px text-[11px] ${billing === option ? 'bg-white/15 text-white' : 'bg-done/10 text-done'}`}>
              −{Math.round(yearlyDiscount * 100)}%
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

function PlanCard({ plan, billing, index }: { plan: Plan; billing: Billing; index: number }) {
  const href = plan.ctaHref === 'contact' ? site.contact : site.tryNow
  return (
    <Reveal delay={index * 0.07} className="h-full">
      <div
        className={`relative flex h-full flex-col rounded-2xl p-7 ${
          plan.featured
            ? 'bg-gradient-to-b from-forest-700 to-forest text-white shadow-[0_40px_90px_-40px_rgba(11,36,25,0.8)]'
            : 'glass'
        }`}
      >
        {plan.featured ? (
          <span className="absolute -top-3 left-7 rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-forest shadow-[0_0_0_1px_rgba(23,23,23,0.1),0_4px_10px_-4px_rgba(0,0,0,0.3)]">
            Most popular
          </span>
        ) : null}
        <p className={`text-[15px] font-semibold ${plan.featured ? 'text-white' : 'text-bone'}`}>{plan.name}</p>
        <p className={`mt-1.5 min-h-[2.75rem] text-[14px] leading-snug ${plan.featured ? 'text-white/65' : 'text-bone-muted'}`}>{plan.tagline}</p>
        <div className="mt-6 flex h-14 items-end gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={price(plan, billing)}
              initial={{ y: 18, opacity: 0, filter: 'blur(4px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: -18, opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={`text-[44px] font-semibold leading-none tracking-[-0.04em] ${plan.featured ? 'text-white' : 'text-bone'}`}
            >
              {price(plan, billing)}
            </motion.span>
          </AnimatePresence>
          {plan.monthly ? <span className={`pb-1 text-[13px] ${plan.featured ? 'text-white/60' : 'text-bone-faint'}`}>{plan.unit}</span> : null}
        </div>
        <p className={`mt-1 h-5 text-[12.5px] ${plan.featured ? 'text-white/55' : 'text-bone-faint'}`}>
          {plan.monthly && billing === 'yearly' ? 'billed yearly' : plan.monthly === 0 ? 'free forever' : ''}
        </p>
        <ButtonLink href={href} variant={plan.featured ? 'white' : 'glass'} arrow className="mt-6 w-full">
          {plan.cta}
        </ButtonLink>
        <ul className="mt-7 space-y-3 text-[14px]">
          {plan.includes.map((item) => (
            <li key={item} className="flex gap-2.5">
              <Check className={`mt-0.5 size-4 shrink-0 ${plan.featured ? 'text-white/80' : 'text-forest-700'}`} strokeWidth={2.5} aria-hidden />
              <span className={plan.featured ? 'text-white/85' : 'text-bone-soft'}>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  )
}

function Value({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-4 text-forest-700" strokeWidth={2.5} aria-label="Included" />
  if (value === false) return <Minus className="mx-auto size-4 text-bone-faint" aria-label="Not included" />
  return <span className="text-bone-soft">{value}</span>
}

export function Pricing() {
  const [billing, setBilling] = useState<Billing>('yearly')
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-36 sm:pt-44">
        <div className="page relative">
          <Heading eyebrow="Pricing" title={<>Simple plans. <em>Grow when you’re ready.</em></>} lead="Start free. Upgrade when your workflows become part of how you work." />
          <Reveal delay={0.2} className="mt-10 flex justify-center">
            <BillingToggle billing={billing} onChange={setBilling} />
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan, index) => (
              <PlanCard key={plan.id} plan={plan} billing={billing} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="page">
          <Heading eyebrow="Compare" title={<>Every plan, side by <em>side</em></>} />
          <Reveal className="mt-12">
            <div className="glass overflow-x-auto rounded-2xl">
              <table className="w-full min-w-[44rem] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-ink/[0.07]">
                    <th className="w-[34%] px-6 py-5 font-medium text-bone-muted">Plan</th>
                    {PLANS.map((plan) => (
                      <th key={plan.id} className="px-4 py-5 text-center font-semibold text-bone">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                {COMPARISON.map((group) => (
                  <tbody key={group.group}>
                    <tr>
                      <td colSpan={PLANS.length + 1} className="bg-ink/[0.025] px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-faint">
                        {group.group}
                      </td>
                    </tr>
                    {group.rows.map(([label, values]) => (
                      <tr key={label} className="border-t border-ink/[0.05]">
                        <td className="px-6 py-4 text-bone-soft">{label}</td>
                        {PLANS.map((plan) => (
                          <td key={plan.id} className="px-4 py-4 text-center">
                            <Value value={values[plan.id]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="pb-24 pt-8">
        <div className="page grid gap-6 md:grid-cols-2">
          {PRICING_FAQ.map(([question, answer], index) => (
            <Reveal key={question} delay={index * 0.05}>
              <div className="glass h-full rounded-3xl p-7">
                <p className="font-semibold text-bone">{question}</p>
                <p className="mt-2 leading-relaxed text-bone-muted">{answer}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}
