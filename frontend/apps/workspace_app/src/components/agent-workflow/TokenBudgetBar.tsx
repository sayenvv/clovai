import { memo, useEffect, useSyncExternalStore } from 'react'
import { creditsFor, ensureTokenUsage, readTokenUsage, subscribeTokenUsage, tokenUsageLevel } from '@/services/token-usage-store'
import { BUY_CREDITS_URL } from '@/constants'
import { cn } from '@/utils/cn'

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}k`
  return value < 10 ? String(Number(value.toFixed(1))) : Math.round(value).toLocaleString()
}

/**
 * The user's allowance in credits, read from local storage.
 *
 * Runs update the stored figures as their usage events arrive, so `/me` is
 * only read when nothing is stored for this account yet.
 */
export const TokenBudgetBar = memo(function TokenBudgetBar() {
  const subscription = useSyncExternalStore(subscribeTokenUsage, readTokenUsage, () => null)

  useEffect(() => {
    void ensureTokenUsage()
  }, [])

  if (!subscription || subscription.tokenLimit <= 0) return null

  const usedRatio = Math.min(1, subscription.tokensUsed / subscription.tokenLimit)
  const credits = (tokens: number) => formatCount(creditsFor(tokens, subscription))
  // Colour only signals a problem: amber from 90% used, red from 95%
  const { level: usage, percent } = tokenUsageLevel(subscription)
  const level = usage === 'exhausted' ? 'critical' : usage

  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Credits</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">{credits(subscription.tokensUsed)}</span>
          {' '}of {credits(subscription.tokenLimit)} used · {percent}%
        </span>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Credits used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            level === 'critical' ? 'bg-red-600' : level === 'warning' ? 'bg-amber-600' : 'bg-foreground/80',
          )}
          style={{ width: `${usedRatio > 0 ? Math.max(2, usedRatio * 100) : 0}%` }}
        />
      </div>
      <p
        className={cn(
          'mt-1.5 text-[10.5px] tabular-nums',
          level === 'critical' ? 'text-red-600 dark:text-red-400' : level === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
        )}
      >
        {level !== 'normal' ? (
          <>
            {subscription.tokensRemaining > 0 ? `${percent}% used, ${credits(subscription.tokensRemaining)} left. ` : 'No credits left: runs are paused. '}
            <a href={BUY_CREDITS_URL} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
              Buy credits
            </a>
          </>
        ) : (
          `${credits(subscription.tokensRemaining)} credits remaining this period`
        )}
      </p>
    </div>
  )
})
