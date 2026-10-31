import { useEffect, useSyncExternalStore } from 'react'
import { Gauge } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { creditsFor, ensureTokenUsage, readTokenUsage, subscribeTokenUsage, tokenUsageLevel } from '@/services/token-usage-store'
import { cn } from '@/utils/cn'

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}k`
  return value < 10 ? String(Number(value.toFixed(1))) : Math.round(value).toLocaleString()
}

/**
 * The status bar's credit quota, live as runs report what they use: the share used, amber from 90%, red from 95%,
 * and "Quota reached" when it is all used. It opens the usage details.
 */
export function TokenQuotaStatus() {
  const usage = useSyncExternalStore(subscribeTokenUsage, readTokenUsage, () => null)
  useEffect(() => {
    void ensureTokenUsage()
  }, [])
  if (!usage || usage.tokenLimit <= 0) return null
  const { level, percent } = tokenUsageLevel(usage)
  const credits = (tokens: number) => formatCount(creditsFor(tokens, usage))
  const usedRatio = Math.min(1, usage.tokensUsed / usage.tokenLimit)
  const tone =
    level === 'warning' ? 'text-amber-700 dark:text-amber-300' : level === 'critical' || level === 'exhausted' ? 'text-red-600 dark:text-red-400' : ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Credit usage"
          className={cn(
            'flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 tabular-nums transition-colors hover:bg-accent hover:text-foreground',
            tone,
            (level === 'critical' || level === 'exhausted') && 'font-medium',
          )}
        >
          <Gauge className="h-3.5 w-3.5" />
          <span>{level === 'exhausted' ? 'Quota reached' : `Credits ${percent}%`}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-64 rounded-md p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Credits</span>
          <span className={cn('text-[11px] font-medium tabular-nums', tone || 'text-muted-foreground')}>{percent}% used</span>
        </div>
        <p className="mt-1.5 text-sm tabular-nums text-foreground">
          <span className="font-semibold">{credits(usage.tokensUsed)}</span>
          <span className="text-muted-foreground"> of {credits(usage.tokenLimit)} used</span>
        </p>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Credits used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500',
              level === 'critical' || level === 'exhausted' ? 'bg-red-600' : level === 'warning' ? 'bg-amber-600' : 'bg-foreground/80',
            )}
            style={{ width: `${usedRatio > 0 ? Math.max(2, usedRatio * 100) : 0}%` }}
          />
        </div>
        <dl className="mt-3 space-y-1 text-[12px]">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Left</dt>
            <dd className="tabular-nums text-foreground">{credits(usage.tokensRemaining)} credits</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Allowance</dt>
            <dd className="tabular-nums text-foreground">{credits(usage.tokenLimit)} credits</dd>
          </div>
        </dl>
        <p className={cn('mt-3 border-t pt-2 text-[11px] leading-4', tone || 'text-muted-foreground')}>
          {level === 'exhausted'
            ? 'All credits are used: assistant and workflow runs pause until more are added.'
            : 'Assistant and workflow runs use credits; they pause when none are left.'}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
