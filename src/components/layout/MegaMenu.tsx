import { memo, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { visibleSorted } from '@/utils/collection'
import { Icon } from '@/components/shared/Icon'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import { CtaButton } from '@/components/shared/CtaButton'
import type { MegaMenuConfig, Tool } from '@/types/config'

interface MegaMenuProps {
  config: MegaMenuConfig
  onNavigate?: () => void
}

const ToolItem = memo(function ToolItem({ tool, onNavigate }: { tool: Tool; onNavigate?: () => void }) {
  const inner = (
    <>
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background shadow-sm transition-colors',
          tool.isEnabled && 'group-hover/item:border-primary/40 group-hover/item:text-primary',
        )}
      >
        <Icon name={tool.icon} className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{tool.title}</span>
          <ConfigBadge badge={tool.badge} className="px-1.5 py-0 text-[10px]" />
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
      </div>
    </>
  )

  if (!tool.isEnabled) {
    return (
      <div className="group/item flex cursor-not-allowed items-start gap-3 rounded-lg p-2 opacity-55">
        {inner}
      </div>
    )
  }

  return (
    <Link
      to={tool.route}
      target="_blank"
      rel="noopener"
      onClick={onNavigate}
      className="group/item flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-accent"
    >
      {inner}
    </Link>
  )
})

/** Tools mega menu — categories, tools and the featured panel all come
 *  from JSON configuration. */
export const MegaMenu = memo(function MegaMenu({ config, onNavigate }: MegaMenuProps) {
  const grouped = useMemo(() => {
    const categories = visibleSorted(config.categories)
    return categories
      .map((category) => ({
        category,
        tools: visibleSorted(config.tools.filter((tool) => tool.category === category.id)),
      }))
      .filter((group) => group.tools.length > 0)
  }, [config])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="w-[880px] max-w-[92vw] overflow-hidden rounded-2xl border bg-popover shadow-2xl shadow-black/10 dark:shadow-black/40"
    >
      <div className="grid grid-cols-[1fr_260px]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 p-6">
          {grouped.map(({ category, tools }) => (
            <div key={category.id}>
              <div className="mb-2 flex items-center gap-2 px-2">
                {category.icon && <Icon name={category.icon} className="h-3.5 w-3.5 text-primary" aria-hidden />}
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category.title}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {tools.map((tool) => (
                  <ToolItem key={tool.id} tool={tool} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {config.featured && (
          <aside className="flex flex-col justify-between border-l bg-primary/5 p-6">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand">
                <Icon name={config.featured.icon} className="h-5 w-5" aria-hidden />
              </div>
              <h4 className="mt-4 text-sm font-semibold">{config.featured.title}</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {config.featured.description}
              </p>
            </div>
            <div className="mt-6" onClick={onNavigate}>
              <CtaButton cta={config.featured.cta} size="sm" className="w-full" />
            </div>
          </aside>
        )}
      </div>
    </motion.div>
  )
})
