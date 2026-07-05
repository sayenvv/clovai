import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const badgeSchema = z.object({
  label: z.string(),
  variant: z.enum(['default', 'secondary', 'outline', 'success', 'warning', 'gradient']).default('default'),
})

export const ctaButtonSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string(),
  variant: z.enum(['default', 'secondary', 'outline', 'ghost', 'gradient']).default('default'),
  icon: z.string().optional(),
  iconPosition: z.enum(['left', 'right']).default('right'),
  isExternal: z.boolean().default(false),
})

export const linkSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string(),
  icon: z.string().optional(),
  badge: badgeSchema.optional(),
  isExternal: z.boolean().default(false),
})

/* ------------------------------------------------------------------ */
/* Tools & Mega Menu                                                   */
/* ------------------------------------------------------------------ */

/** A shape available in a tool's canvas designer palette. */
export const paletteItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  shape: z.enum([
    'terminator',
    'process',
    'decision',
    'input-output',
    'database',
    'document',
    'connector',
    'note',
    'rectangle',
    'circle',
    'ellipse',
    'hexagon',
    'trapezoid',
    'triangle',
    'delay',
    'off-page',
    'manual-input',
    'text',
    'swimlane-pool',
    'swimlane-lane',
    'swimlane-vertical',
    'subprocess',
    'parallel-gateway',
    'or-gate',
    'event',
    'data-store',
    'display',
    'annotation',
    'multi-document',
    'card',
    'internal-storage',
  ]),
  color: z.enum(['emerald', 'blue', 'amber', 'violet', 'cyan', 'rose', 'slate']).default('blue'),
  /** Optional group name used to cluster shapes in the palette. */
  group: z.string().optional(),
  order: z.number().int().default(0),
})

export const toolDesignerSchema = z.object({
  palette: z.array(paletteItemSchema),
  /** Bump when the bundled palette changes so cached configs can migrate. */
  paletteVersion: z.number().int().default(1),
})

export const toolSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  route: z.string(),
  category: z.string(),
  badge: badgeSchema.optional(),
  isVisible: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  order: z.number().int().default(0),
  designer: toolDesignerSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const toolCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().default(0),
  isVisible: z.boolean().default(true),
})

export const megaMenuSchema = z.object({
  categories: z.array(toolCategorySchema),
  tools: z.array(toolSchema),
  featured: z
    .object({
      title: z.string(),
      description: z.string(),
      icon: z.string(),
      cta: ctaButtonSchema,
    })
    .optional(),
})

/* ------------------------------------------------------------------ */
/* Navbar & Footer                                                     */
/* ------------------------------------------------------------------ */

export const navItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string().optional(),
  type: z.enum(['link', 'megaMenu']).default('link'),
  order: z.number().int().default(0),
  isVisible: z.boolean().default(true),
})

export const navbarSchema = z.object({
  logo: z.object({
    text: z.string(),
    icon: z.string().default('workflow'),
    href: z.string().default('/'),
  }),
  items: z.array(navItemSchema),
  actions: z.array(ctaButtonSchema).default([]),
  sticky: z.boolean().default(true),
})

export const footerColumnSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().int().default(0),
  links: z.array(linkSchema),
})

export const footerSchema = z.object({
  description: z.string(),
  columns: z.array(footerColumnSchema),
  socials: z.array(linkSchema).default([]),
  legalLinks: z.array(linkSchema).default([]),
  copyright: z.string(),
})

/* ------------------------------------------------------------------ */
/* Section building blocks                                             */
/* ------------------------------------------------------------------ */

const sectionBase = {
  id: z.string(),
  isVisible: z.boolean().default(true),
  order: z.number().int().default(0),
  heading: z
    .object({
      eyebrow: z.string().optional(),
      title: z.string(),
      highlight: z.string().optional(),
      subtitle: z.string().optional(),
      align: z.enum(['left', 'center']).default('center'),
    })
    .optional(),
}

export const cardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  image: z.string().optional(),
  href: z.string().optional(),
  badge: badgeSchema.optional(),
  order: z.number().int().default(0),
  isVisible: z.boolean().default(true),
})

export const heroSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('hero'),
  announcement: z
    .object({ label: z.string(), href: z.string().optional(), icon: z.string().optional() })
    .optional(),
  title: z.string(),
  highlight: z.string().optional(),
  subtitle: z.string(),
  ctas: z.array(ctaButtonSchema).default([]),
  stats: z
    .array(z.object({ id: z.string(), value: z.string(), label: z.string() }))
    .default([]),
  showVisual: z.boolean().default(true),
})

export const cardsGridSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('cardsGrid'),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  cards: z.array(cardSchema),
})

export const toolGridSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('toolGrid'),
  source: z.enum(['megaMenu', 'inline']).default('megaMenu'),
  categoryFilter: z.array(z.string()).optional(),
  limit: z.number().int().optional(),
  tools: z.array(toolSchema).default([]),
  cta: ctaButtonSchema.optional(),
})

export const stepsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('steps'),
  steps: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      icon: z.string().optional(),
      order: z.number().int().default(0),
    }),
  ),
})

export const tabsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('tabs'),
  tabs: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      icon: z.string().optional(),
      title: z.string(),
      description: z.string(),
      image: z.string().optional(),
      bullets: z.array(z.string()).default([]),
      order: z.number().int().default(0),
    }),
  ),
})

export const accordionSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('accordion'),
  items: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      answer: z.string(),
      order: z.number().int().default(0),
    }),
  ),
})

export const pricingPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.object({
    monthly: z.string(),
    yearly: z.string().optional(),
    suffix: z.string().optional(),
  }),
  features: z.array(z.string()),
  cta: ctaButtonSchema,
  isFeatured: z.boolean().default(false),
  badge: badgeSchema.optional(),
  order: z.number().int().default(0),
})

export const pricingSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('pricing'),
  plans: z.array(pricingPlanSchema),
})

export const testimonialsSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('testimonials'),
  items: z.array(
    z.object({
      id: z.string(),
      quote: z.string(),
      author: z.string(),
      role: z.string(),
      company: z.string().optional(),
      avatar: z.string().optional(),
      rating: z.number().min(0).max(5).optional(),
      order: z.number().int().default(0),
    }),
  ),
})

export const splitSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('split'),
  title: z.string(),
  description: z.string(),
  bullets: z
    .array(z.object({ id: z.string(), icon: z.string().optional(), title: z.string(), description: z.string() }))
    .default([]),
  cta: ctaButtonSchema.optional(),
  imagePosition: z.enum(['left', 'right']).default('right'),
  visual: z.enum(['security', 'diagram', 'dashboard']).default('security'),
})

export const ctaSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('cta'),
  title: z.string(),
  subtitle: z.string().optional(),
  ctas: z.array(ctaButtonSchema),
})

export const formFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'textarea', 'select']).default('text'),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  order: z.number().int().default(0),
})

export const formSectionSchema = z.object({
  ...sectionBase,
  type: z.literal('form'),
  fields: z.array(formFieldSchema),
  submitLabel: z.string().default('Submit'),
  successMessage: z.string().default('Thanks! We will be in touch.'),
})

export const sectionSchema = z.discriminatedUnion('type', [
  heroSectionSchema,
  cardsGridSectionSchema,
  toolGridSectionSchema,
  stepsSectionSchema,
  tabsSectionSchema,
  accordionSectionSchema,
  pricingSectionSchema,
  testimonialsSectionSchema,
  splitSectionSchema,
  ctaSectionSchema,
  formSectionSchema,
])

/* ------------------------------------------------------------------ */
/* Pages, theme, root config                                           */
/* ------------------------------------------------------------------ */

export const pageSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().optional(),
  isVisible: z.boolean().default(true),
  sections: z.array(sectionSchema),
})

export const themeSchema = z.object({
  defaultMode: z.enum(['light', 'dark', 'system']).default('system'),
  radius: z.string().default('0.625rem'),
  primaryHue: z.number().min(0).max(360).default(250),
})

export const appConfigSchema = z.object({
  meta: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
    /** Increment when bundled JSON modules change; triggers store migration. */
    configBundleVersion: z.number().int().optional(),
  }),
  theme: themeSchema,
  navbar: navbarSchema,
  megaMenu: megaMenuSchema,
  footer: footerSchema,
  pages: z.array(pageSchema),
})

/* ------------------------------------------------------------------ */
/* Stored configuration record (DB envelope)                           */
/* ------------------------------------------------------------------ */

export const configRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  config: appConfigSchema,
})

/* ------------------------------------------------------------------ */
/* Validation helper                                                   */
/* ------------------------------------------------------------------ */

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationResult {
  success: boolean
  data?: z.infer<typeof appConfigSchema>
  issues: ValidationIssue[]
}

export function validateAppConfig(input: unknown): ValidationResult {
  const result = appConfigSchema.safeParse(input)
  if (result.success) {
    return { success: true, data: result.data, issues: [] }
  }
  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
      message: issue.message,
    })),
  }
}
