import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/utils/cn'
import { visibleSorted } from '@/utils/collection'
import { useAppConfig } from '@/hooks/use-app-config'
import { Input } from '@/components/ui/input'
import { ToolCard } from '@/components/sections/ToolGridSection'
import { Icon } from '@/components/shared/Icon'
import { APP_NAME } from '@/constants'

/** Full tools directory with client-side search and category filtering,
 *  driven entirely by the mega menu JSON configuration. */
export default function ToolsPage() {
  const { megaMenu } = useAppConfig()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    document.title = `All Tools — ${APP_NAME}`
  }, [])

  const categories = useMemo(() => visibleSorted(megaMenu.categories), [megaMenu.categories])

  const tools = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return visibleSorted(megaMenu.tools).filter((tool) => {
      if (activeCategory && tool.category !== activeCategory) return false
      if (!normalized) return true
      return (
        tool.title.toLowerCase().includes(normalized) ||
        tool.description.toLowerCase().includes(normalized)
      )
    })
  }, [megaMenu.tools, query, activeCategory])

  return (
    <div className="container py-14 md:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Available <span className="text-gradient">tools</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          Agent Workflow Automation and Diagram Generator are live today. More diagram modules will join this list as they ship.
        </p>
        <div className="relative mx-auto mt-8 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools..."
            className="pl-9"
            aria-label="Search tools"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            activeCategory === null
              ? 'border-primary bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
          )}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id === activeCategory ? null : category.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              activeCategory === category.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {category.icon && <Icon name={category.icon} className="h-3.5 w-3.5" aria-hidden />}
            {category.title}
          </button>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool, index) => (
          <ToolCard key={tool.id} tool={tool} index={index} />
        ))}
      </div>

      {tools.length === 0 && (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          No tools match “{query}”. Try a different search.
        </p>
      )}
    </div>
  )
}
