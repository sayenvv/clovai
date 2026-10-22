import type { z } from 'zod'
import type {
  appConfigSchema,
  accordionSectionSchema,
  badgeSchema,
  cardSchema,
  cardsGridSectionSchema,
  configRecordSchema,
  ctaButtonSchema,
  ctaSectionSchema,
  footerColumnSchema,
  footerSchema,
  formFieldSchema,
  formSectionSchema,
  heroSectionSchema,
  linkSchema,
  megaMenuSchema,
  navbarSchema,
  navItemSchema,
  pageSchema,
  paletteItemSchema,
  pricingPlanSchema,
  pricingSectionSchema,
  sectionSchema,
  splitSectionSchema,
  stepsSectionSchema,
  tabsSectionSchema,
  testimonialsSectionSchema,
  themeSchema,
  toolCategorySchema,
  toolDesignerSchema,
  toolGridSectionSchema,
  toolSchema,
} from '@/schemas/config.schema'

/** All configuration types are inferred from the Zod schemas so the
 *  runtime validation contract and static types can never drift apart. */

export type Badge = z.infer<typeof badgeSchema>
export type CtaButton = z.infer<typeof ctaButtonSchema>
export type Link = z.infer<typeof linkSchema>

export type Tool = z.infer<typeof toolSchema>
export type ToolCategory = z.infer<typeof toolCategorySchema>
export type PaletteItem = z.infer<typeof paletteItemSchema>
export type PaletteShape = PaletteItem['shape']
export type PaletteColor = PaletteItem['color']
export type ToolDesigner = z.infer<typeof toolDesignerSchema>
export type MegaMenuConfig = z.infer<typeof megaMenuSchema>

export type NavItem = z.infer<typeof navItemSchema>
export type NavbarConfig = z.infer<typeof navbarSchema>
export type FooterColumn = z.infer<typeof footerColumnSchema>
export type FooterConfig = z.infer<typeof footerSchema>

export type Card = z.infer<typeof cardSchema>
export type PricingPlan = z.infer<typeof pricingPlanSchema>
export type FormField = z.infer<typeof formFieldSchema>

export type HeroSection = z.infer<typeof heroSectionSchema>
export type CardsGridSection = z.infer<typeof cardsGridSectionSchema>
export type ToolGridSection = z.infer<typeof toolGridSectionSchema>
export type StepsSection = z.infer<typeof stepsSectionSchema>
export type TabsSection = z.infer<typeof tabsSectionSchema>
export type AccordionSection = z.infer<typeof accordionSectionSchema>
export type PricingSection = z.infer<typeof pricingSectionSchema>
export type TestimonialsSection = z.infer<typeof testimonialsSectionSchema>
export type SplitSection = z.infer<typeof splitSectionSchema>
export type CtaSection = z.infer<typeof ctaSectionSchema>
export type FormSection = z.infer<typeof formSectionSchema>

export type Section = z.infer<typeof sectionSchema>
export type SectionType = Section['type']
export type SectionHeading = NonNullable<HeroSection['heading']>

export type PageConfig = z.infer<typeof pageSchema>
export type ThemeConfig = z.infer<typeof themeSchema>
export type AppConfig = z.infer<typeof appConfigSchema>

/** A configuration as stored in the database, with versioning metadata. */
export type ConfigRecord = z.infer<typeof configRecordSchema>

export type ConfigRecordSummary = Omit<ConfigRecord, 'config'>
