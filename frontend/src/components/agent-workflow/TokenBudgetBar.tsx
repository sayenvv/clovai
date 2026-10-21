import { memo, useEffect, useState } from 'react'
import { authorizedFetch } from '@/services/api-auth'
import { cn } from '@/utils/cn'

interface SubscriptionSnapshot {
  tokenLimit: number
  tokensUsed: number
  tokensRemaining: number
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

export const TokenBudgetBar = memo(function TokenBudgetBar({ refreshKey = 0 }: { refreshKey?: number }) {
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    authorizedFetch('/api/v1/auth/me')
      .then(async (response) => {
        if (!response.ok) return null
        const body = (await response.json()) as { subscription?: SubscriptionSnapshot }
        return body.subscription ?? null
      })
      .then((next) => {
        if (!cancelled) setSubscription(next)
      })
      .catch(() => {
        if (!cancelled) setSubscription(null)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (!subscription || subscription.tokenLimit <= 0) return null

  const usedRatio = Math.min(1, subscription.tokensUsed / subscription.tokenLimit)
  const remainingRatio = 1 - usedRatio

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-foreground">Token allowance</span>
        <span className="text-muted-foreground">
          {formatCount(subscription.tokensRemaining)} left · {formatCount(subscription.tokenLimit)} total
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            remainingRatio < 0.1 ? 'bg-red-500' : remainingRatio < 0.25 ? 'bg-amber-500' : 'bg-emerald-500',
          )}
          style={{ width: `${Math.max(4, remainingRatio * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {formatCount(subscription.tokensUsed)} used this period. Limits come from your subscription; the runtime fills them when a workflow runs.
      </p>
    </div>
  )
})
