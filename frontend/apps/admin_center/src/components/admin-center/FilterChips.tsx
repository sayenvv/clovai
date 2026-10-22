import { cn } from '@/utils/cn'

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  label?: (value: T) => string
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((option) => {
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-lg font-medium capitalize transition-colors',
              size === 'sm' ? 'px-2 py-1 text-[10.5px]' : 'px-2.5 py-1.5 text-[11px]',
              active
                ? 'bg-primary font-semibold text-primary-foreground'
                : 'border border-border/70 text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {label ? label(option) : option}
          </button>
        )
      })}
    </div>
  )
}
