import { useEffect, useSyncExternalStore } from 'react'
import { Gauge } from 'lucide-react'
import { BUY_CREDITS_URL } from '@/constants'
import { ensureTokenUsage, readTokenUsage, subscribeTokenUsage, tokenUsageLevel } from '@/services/token-usage-store'
import { cn } from '@/utils/cn'

/**
 * The status bar's credit quota, live as runs report what they use: the share used, amber from 90%, red from 95%,
 * and "Quota reached" when it is all used. It opens the page to buy credits.
 */
export function TokenQuotaStatus() {
  const usage = useSyncExternalStore(subscribeTokenUsage, readTokenUsage, () => null)
  useEffect(() => {
    void ensureTokenUsage()
  }, [])
  if (!usage || usage.tokenLimit <= 0) return null
  const { level, percent } = tokenUsageLevel(usage)
  const label = level === 'exhausted' ? 'Quota reached' : `Credits ${percent}%`
  return (
    <a
      href={BUY_CREDITS_URL}
      target="_blank"
      rel="noreferrer"
      title={level === 'exhausted' ? 'Quota reached: runs are paused. Buy credits' : `${percent}% of your credits used. Buy credits`}
      className={cn(
        'flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 tabular-nums transition-colors hover:bg-accent hover:text-foreground',
        level === 'warning' && 'text-amber-700 dark:text-amber-300',
        (level === 'critical' || level === 'exhausted') && 'font-medium text-red-600 dark:text-red-400',
      )}
    >
      <Gauge className="h-3.5 w-3.5" />
      <span>{label}</span>
    </a>
  )
}
