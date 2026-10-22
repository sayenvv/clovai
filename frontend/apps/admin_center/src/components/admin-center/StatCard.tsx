import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { cn } from '@/utils/cn'

type Tone = 'primary' | 'success' | 'warning' | 'violet'

const TONES: Record<Tone, string> = {
  primary: 'bg-red-500/10 text-red-600 dark:text-red-300',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
}

interface StatCardProps {
  label: string
  value: string
  delta?: number
  hint?: string
  icon: LucideIcon
  tone?: Tone
}

/** A KPI tile, matching the workspace console's stat cards. */
export function StatCard({ label, value, delta, hint, icon: Icon, tone = 'primary' }: StatCardProps) {
  const positive = (delta ?? 0) >= 0

  return (
    <PremiumCard className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', TONES[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 truncate text-lg font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {typeof delta === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[10.5px] font-semibold tabular-nums',
              positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
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
