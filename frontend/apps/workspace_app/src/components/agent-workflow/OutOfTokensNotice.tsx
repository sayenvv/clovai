import { Coins, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BUY_CREDITS_URL } from '@/constants'

/** The run used up the user's tokens: buy credits, then continue from the step it paused at. */
export function OutOfTokensNotice({ message, busy = false, onContinue }: { message?: string; busy?: boolean; onContinue?: () => void }) {
  return (
    <div className="space-y-2 rounded-md border border-red-500/30 bg-red-500/[0.05] p-2.5 text-[12px]">
      <p className="font-medium text-foreground">Out of tokens</p>
      <p className="text-muted-foreground">{message || 'You have used all your tokens. Buy more credits to continue.'}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-7 gap-1 text-[11.5px]">
          <a href={BUY_CREDITS_URL} target="_blank" rel="noreferrer">
            <Coins className="h-3.5 w-3.5" /> Buy credits
          </a>
        </Button>
        {onContinue ? (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={onContinue}>
            <Play className="h-3.5 w-3.5" /> Continue
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** A refusal for want of tokens (HTTP 402 from a run), told apart from other errors. */
export const isOutOfTokens = (message: string) => /buy more credits|token allowance exhausted/i.test(message)
