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
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn('h-9 border-border/70 bg-background/70 pl-8 text-xs', inputClassName)}
      />
    </div>
  )
}
