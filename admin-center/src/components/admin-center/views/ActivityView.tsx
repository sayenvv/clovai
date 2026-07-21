import { useMemo, useState } from 'react'
import { PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { StatusBadge } from '@/components/admin-center/StatusBadge'
import { ADMIN_ACTIVITY, type AdminActivityEvent } from '@/components/admin-center/mock-data'

const ACTIVITY_TONE: Record<
  AdminActivityEvent['type'],
  'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral'
> = {
  signup: 'info',
  login: 'neutral',
  workflow: 'violet',
  run: 'success',
  security: 'danger',
  invite: 'warning',
}

const FILTERS: Array<'all' | AdminActivityEvent['type']> = [
  'all',
  'run',
  'workflow',
  'invite',
  'security',
  'login',
  'signup',
]

export function ActivityView() {
  const [type, setType] = useState<(typeof FILTERS)[number]>('all')

  const events = useMemo(
    () => (type === 'all' ? ADMIN_ACTIVITY : ADMIN_ACTIVITY.filter((event) => event.type === type)),
    [type],
  )

  return (
    <>
      <PageHeader
        title="Activity"
        description="Audit trail of sign-ins, workflow runs, and security events."
      />
      <PageBody className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={
                type === value
                  ? 'rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold capitalize text-primary-foreground'
                  : 'rounded-lg border border-border/70 px-2.5 py-1.5 text-[11px] font-medium capitalize text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }
            >
              {value}
            </button>
          ))}
        </div>

        <PremiumCard className="p-5">
          <ol className="relative space-y-0 border-l border-dashed border-border/80 pl-5">
            {events.map((event) => (
              <li key={event.id} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[1.41rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={event.type} tone={ACTIVITY_TONE[event.type]} />
                  <span className="text-[10.5px] text-muted-foreground">{event.at}</span>
                </div>
                <p className="mt-1.5 text-[13px] font-medium text-foreground">{event.summary}</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {event.actor}
                  {event.detail ? ` · ${event.detail}` : ''}
                </p>
              </li>
            ))}
          </ol>
        </PremiumCard>
      </PageBody>
    </>
  )
}
