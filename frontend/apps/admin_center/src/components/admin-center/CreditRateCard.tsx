import { useEffect, useState } from 'react'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { readPlatformSettings, savePlatformSettings, type PlatformSettings } from '@/api/platform-settings'

/** Tokens one credit buys: users see their allowance and what runs cost in credits at this rate. */
export function CreditRateCard() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    readPlatformSettings()
      .then((loaded) => {
        setSettings(loaded)
        setValue(String(loaded.tokensPerCredit))
      })
      .catch((error: unknown) => setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) }))
  }, [])

  const rate = Number(value)
  const valid = Number.isInteger(rate) && rate >= 1 && rate <= 10_000_000
  const changed = settings !== null && rate !== settings.tokensPerCredit

  const save = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const saved = await savePlatformSettings({ tokensPerCredit: rate })
      setSettings(saved)
      setStatus({ tone: 'ok', text: 'Saved. Users see the new rate on their next request.' })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PremiumCard className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Credits</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Usage is counted in tokens and shown to users in credits. Changing the rate changes every user's balance at once.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tokens-per-credit" className="text-xs">
          Tokens per credit
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="tokens-per-credit"
            type="number"
            min={1}
            max={10_000_000}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-9 w-40 text-sm tabular-nums"
            disabled={settings === null}
            aria-invalid={!valid}
          />
          <Button size="sm" className="h-8 text-[11.5px] font-semibold" disabled={!valid || !changed || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {valid ? `1 credit = ${rate.toLocaleString()} tokens. ` : 'A whole number from 1 to 10,000,000. '}
          {settings?.sources.tokensPerCredit === 'environment' ? 'Currently the server default (TOKENS_PER_CREDIT).' : null}
        </p>
        {status ? <p className={status.tone === 'error' ? 'text-[11px] text-destructive' : 'text-[11px] text-emerald-600'}>{status.text}</p> : null}
      </div>
    </PremiumCard>
  )
}
