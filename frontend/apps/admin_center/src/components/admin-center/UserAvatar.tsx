import { initials } from '@/utils/format'
import { cn } from '@/utils/cn'

const SIZES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
  lg: 'h-12 w-12 text-sm',
} as const

export function UserAvatar({
  name,
  size = 'md',
  variant = 'soft',
  online,
  className,
}: {
  name: string
  size?: keyof typeof SIZES
  variant?: 'soft' | 'brand'
  online?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZES[size],
        variant === 'brand'
          ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
          : 'bg-primary/10 text-primary',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
      {online && (
        <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-card bg-emerald-500" />
      )}
    </span>
  )
}
