import { memo, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { visibleSorted } from '@/utils/collection'
import { useAppConfig } from '@/hooks/use-app-config'
import { Icon } from '@/components/shared/Icon'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import { CtaButton } from '@/components/shared/CtaButton'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Reveal } from '@/components/shared/Reveal'
import type { Tool, ToolGridSection as ToolGridSectionConfig } from '@/types/config'

export const ToolCard = memo(function ToolCard({ tool, index = 0 }: { tool: Tool; index?: number }) {
  const card = (
    <div className="group relative h-full overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-gradient-to-b from-muted/80 to-muted/30 shadow-sm transition-colors group-hover:border-primary/40 group-hover:text-primary">
          <Icon name={tool.icon} className="h-5 w-5" aria-hidden />
        </div>
        <div className="flex items-center gap-2">
          <ConfigBadge badge={tool.badge} className="px-2 py-0 text-[10px]" />
          {tool.isEnabled && (
            <ArrowUpRight
              className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden
            />
          )}
        </div>
      </div>
      <h3 className="mt-4 text-sm font-semibold">{tool.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {tool.description}
      </p>
    </div>
  )

  return (
    <Reveal delay={Math.min(index * 0.05, 0.3)} className="h-full">
      {tool.isEnabled ? (
        <Link to={tool.route} target="_blank" rel="noopener" className="block h-full">
          {card}
        </Link>
      ) : (
        <div className="h-full cursor-not-allowed opacity-60">{card}</div>
      )}
    </Reveal>
  )
})

function ToolGridSectionComponent({ section }: { section: ToolGridSectionConfig }) {
  const { megaMenu } = useAppConfig()

  const tools = useMemo(() => {
    const source = section.source === 'inline' ? section.tools : megaMenu.tools
    let list = visibleSorted(source)
    if (section.categoryFilter?.length) {
      list = list.filter((tool) => section.categoryFilter?.includes(tool.category))
    }
    if (section.limit) list = list.slice(0, section.limit)
    return list
  }, [section, megaMenu.tools])

  return (
    <section id={section.id} className="section-padding scroll-mt-16 bg-muted/30">
      <div className="container">
        <SectionHeading heading={section.heading} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool, index) => (
            <ToolCard key={tool.id} tool={tool} index={index} />
          ))}
        </div>
        {section.cta && (
          <div className="mt-10 flex justify-center">
            <CtaButton cta={section.cta} size="lg" />
          </div>
        )}
      </div>
    </section>
  )
}

export default memo(ToolGridSectionComponent)
