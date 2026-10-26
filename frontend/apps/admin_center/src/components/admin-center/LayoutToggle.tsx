import { useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/utils/cn'

export type Layout = 'list' | 'grid'

/** A page's list/grid choice, remembered per page in this browser. */
export function useLayout(storageKey: string): [Layout, (next: Layout) => void] {
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      return window.localStorage.getItem(storageKey) === 'grid' ? 'grid' : 'list'
    } catch {
      return 'list'
    }
  })
  const choose = (next: Layout) => {
    setLayout(next)
    try {
      window.localStorage.setItem(storageKey, next)
    } catch {
      /* the choice just won't be remembered */
    }
  }
  return [layout, choose]
}

export function LayoutToggle({ value, onChange }: { value: Layout; onChange: (next: Layout) => void }) {
  const options: { layout: Layout; label: string; icon: typeof List }[] = [
    { layout: 'list', label: 'List view', icon: List },
    { layout: 'grid', label: 'Grid view', icon: LayoutGrid },
  ]
  return (
    <div className="flex rounded-md border border-border/70 bg-muted/40 p-0.5" role="group" aria-label="Layout">
      {options.map(({ layout, label, icon: Icon }) => (
        <button
          key={layout}
          type="button"
          onClick={() => onChange(layout)}
          aria-pressed={value === layout}
          aria-label={label}
          title={label}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            value === layout ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
