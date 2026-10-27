import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-foreground/60" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        // The workspace's search field: a flat chrome-input well, no border or shadow
        className={cn(
          'h-7 rounded-[2px] border-0 bg-[hsl(var(--chrome-input))] pl-7 text-[11.5px] shadow-none focus-visible:ring-1 focus-visible:ring-primary/50',
          inputClassName,
        )}
      />
    </div>
  )
}
