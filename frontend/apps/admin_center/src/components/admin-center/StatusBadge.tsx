import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

const TONES = {
  success: 'border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warning: 'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400',
  danger: 'border-transparent bg-destructive/10 text-destructive',
  info: 'border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400',
  violet: 'border-transparent bg-violet-500/10 text-violet-700 dark:text-violet-400',
  neutral: 'border-transparent bg-muted text-muted-foreground',
} as const

export function StatusBadge({
  label,
  tone = 'neutral',
  className,
}: {
  label: string
  tone?: keyof typeof TONES
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn('h-5 px-1.5 text-[10px] font-semibold capitalize', TONES[tone], className)}
    >
      {label}
    </Badge>
  )
}
