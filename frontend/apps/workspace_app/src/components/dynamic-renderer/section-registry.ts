import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { Section, SectionType } from '@/types/config'

/**
 * Maps every JSON section `type` to its component. All sections are
 * lazy-loaded so a page only downloads the section code it actually uses.
 *
 * Adding a new section type = add a schema variant + one entry here.
 */

type AnySectionComponent = ComponentType<{ section: Section }>

/** Registers a lazily-loaded section component. The cast is safe because the
 *  registry key (the section's discriminant) guarantees each component only
 *  ever receives its own section variant at runtime. */
function register<T extends Section>(
  loader: () => Promise<{ default: ComponentType<{ section: T }> }>,
): LazyExoticComponent<AnySectionComponent> {
  return lazy(loader) as unknown as LazyExoticComponent<AnySectionComponent>
}

export const sectionRegistry: Record<SectionType, LazyExoticComponent<AnySectionComponent>> = {
  hero: register(() => import('@/components/sections/HeroSection')),
  cardsGrid: register(() => import('@/components/sections/CardsGridSection')),
  toolGrid: register(() => import('@/components/sections/ToolGridSection')),
  steps: register(() => import('@/components/sections/StepsSection')),
  tabs: register(() => import('@/components/sections/TabsSection')),
  accordion: register(() => import('@/components/sections/AccordionSection')),
  pricing: register(() => import('@/components/sections/PricingSection')),
  testimonials: register(() => import('@/components/sections/TestimonialsSection')),
  split: register(() => import('@/components/sections/SplitSection')),
  cta: register(() => import('@/components/sections/CtaSection')),
  form: register(() => import('@/components/sections/FormSection')),
}
