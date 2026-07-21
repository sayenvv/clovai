import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { cn } from '@/utils/cn'

type Tone = 'primary' | 'success' | 'warning' | 'violet'

const TONES: Record<Tone, string> = {
  primary: 'from-primary/15 to-primary/0 text-primary',
  success: 'from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400',
  warning: 'from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-400',
  violet: 'from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-400',
}

interface StatCardProps {
  label: string
  value: string
  delta?: number
  hint?: string
  icon: LucideIcon
  tone?: Tone
}

export function StatCard({ label, value, delta, hint, icon: Icon, tone = 'primary' }: StatCardProps) {
  const positive = (delta ?? 0) >= 0

  return (
    <PremiumCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-border/60',
            TONES[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {typeof delta === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold',
              positive
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
    </PremiumCard>
  )
}
