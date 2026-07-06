import { memo, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { visibleSorted } from '@/utils/collection'
import { Icon } from '@/components/shared/Icon'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import { CtaButton } from '@/components/shared/CtaButton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { CtaButton as CtaButtonConfig, MegaMenuConfig, NavItem } from '@/types/config'

interface MobileMenuProps {
  items: NavItem[]
  megaMenu: MegaMenuConfig
  actions: CtaButtonConfig[]
  onNavigate: () => void
}

export const MobileMenu = memo(function MobileMenu({
  items,
  megaMenu,
  actions,
  onNavigate,
}: MobileMenuProps) {
  const grouped = useMemo(() => {
    const categories = visibleSorted(megaMenu.categories)
    return categories
      .map((category) => ({
        category,
        tools: visibleSorted(megaMenu.tools.filter((t) => t.category === category.id && t.isEnabled)),
      }))
      .filter((group) => group.tools.length > 0)
  }, [megaMenu])

  return (
    <nav className="container flex flex-col gap-1 py-4" aria-label="Mobile">
      {items.map((item) =>
        item.type === 'megaMenu' ? (
          <Accordion key={item.id} type="single" collapsible>
            <AccordionItem value={item.id} className="border-none">
              <AccordionTrigger className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent hover:no-underline">
                {item.label}
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                {grouped.map(({ category, tools }) => (
                  <div key={category.id} className="mb-3">
                    <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {category.title}
                    </p>
                    {tools.map((tool) => (
                      <Link
                        key={tool.id}
                        to={tool.route}
                        target="_blank"
                        rel="noopener"
                        onClick={onNavigate}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
                      >
                        <Icon name={tool.icon} className="h-4 w-4 text-primary" aria-hidden />
                        <span>{tool.title}</span>
                        <ConfigBadge badge={tool.badge} className="px-1.5 py-0 text-[10px]" />
                      </Link>
                    ))}
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : (
          <a
            key={item.id}
            href={item.href ?? '/'}
            onClick={onNavigate}
            className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
          >
            {item.label}
          </a>
        ),
      )}

      <div className="mt-3 flex flex-col gap-2 border-t pt-4">
        {actions.map((action) => (
          <CtaButton key={action.id} cta={action} className="w-full" />
        ))}
      </div>
    </nav>
  )
})
