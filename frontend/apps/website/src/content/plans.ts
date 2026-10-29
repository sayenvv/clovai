/**
 * Plans and prices. PLACEHOLDERS: set the real prices, limits and features before launch; the page renders
 * whatever is here. `monthly` is per seat per month; yearly billing takes `yearlyDiscount` off.
 */

export type Plan = {
  id: string
  name: string
  tagline: string
  monthly: number | null // null: priced on request
  unit?: string
  cta: string
  ctaHref: 'tryNow' | 'contact'
  featured?: boolean
  includes: string[]
}

export const yearlyDiscount = 0.2

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Starter',
    tagline: 'For trying ideas and personal workflows.',
    monthly: 0,
    cta: 'Start free',
    ctaHref: 'tryNow',
    includes: ['1 user', '3 workflows', '500 runs a month', 'The AI assistant', 'Bring your own model client', 'Community support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For builders who run workflows every day.',
    monthly: 29,
    unit: 'per user / month',
    cta: 'Start with Pro',
    ctaHref: 'tryNow',
    featured: true,
    includes: ['Unlimited workflows', '10,000 runs a month', 'Human approvals', 'Run traces kept 30 days', 'Your own model clients', 'Email support'],
  },
  {
    id: 'team',
    name: 'Team',
    tagline: 'For teams sharing workflows and models.',
    monthly: 79,
    unit: 'per user / month',
    cta: 'Start with Team',
    ctaHref: 'tryNow',
    includes: ['Everything in Pro', 'Shared workspace', 'Admin Center: models, tools, assistant', 'Roles for approvals', 'Run traces kept 90 days', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For organisations with security and scale needs.',
    monthly: null,
    cta: 'Talk to us',
    ctaHref: 'contact',
    includes: ['Everything in Team', 'Single sign-on', 'Private deployment', 'Audit export', 'Custom limits and retention', 'Dedicated support and SLA'],
  },
]

/** The comparison table: one row per capability, one value per plan id (true, false or a label). */
export const COMPARISON: Array<{ group: string; rows: Array<[label: string, values: Record<string, boolean | string>]> }> = [
  {
    group: 'Building',
    rows: [
      ['Workflows', { free: '3', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' }],
      ['AI assistant with visible reasoning', { free: true, pro: true, team: true, enterprise: true }],
      ['Draft review on the canvas', { free: true, pro: true, team: true, enterprise: true }],
      ['Shared workspace', { free: false, pro: false, team: true, enterprise: true }],
    ],
  },
  {
    group: 'Running',
    rows: [
      ['Runs a month', { free: '500', pro: '10,000', team: '50,000', enterprise: 'Custom' }],
      ['Human approvals', { free: false, pro: true, team: true, enterprise: true }],
      ['Trace retention', { free: '7 days', pro: '30 days', team: '90 days', enterprise: 'Custom' }],
    ],
  },
  {
    group: 'Models and admin',
    rows: [
      ['Your own model clients', { free: true, pro: true, team: true, enterprise: true }],
      ['Admin Center', { free: false, pro: false, team: true, enterprise: true }],
      ['Single sign-on', { free: false, pro: false, team: false, enterprise: true }],
      ['Private deployment', { free: false, pro: false, team: false, enterprise: true }],
    ],
  },
]

/** Billing questions. PLACEHOLDERS too: they state policy, so confirm each one before launch. */
export const PRICING_FAQ = [
  ['Do I pay for model usage here?', 'Runs use your model clients, so model usage is billed by your provider on your own account. Plans cover the workspace, runs and storage.'],
  ['Can I change plans later?', 'Yes. Move up or down at any time; changes are prorated to the day.'],
  ['Is there a free trial of Pro?', 'Starter is free for as long as you like, and covers the full assistant, so you can try the product before choosing a plan.'],
  ['Can we run it in our own cloud?', 'Yes, on Enterprise. Talk to us about private deployments.'],
]
