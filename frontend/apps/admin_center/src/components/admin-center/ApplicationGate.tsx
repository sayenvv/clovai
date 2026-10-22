import type { ReactNode } from 'react'
import { EmptyHint } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { useApplication } from '@/hooks/use-application'

/** Renders its children once an application is selected; otherwise says why the page is empty. */
export function ApplicationGate({ children }: { children: ReactNode }) {
  const { current, loading, error } = useApplication()
  if (current) return <>{children}</>
  return (
    <PremiumCard>
      <EmptyHint
        title={loading ? 'Loading applications…' : error ? "Couldn't load applications" : 'No application selected'}
        hint={loading ? 'One moment.' : error || 'Create an application from the switcher in the sidebar.'}
        className="m-4 border-0 bg-transparent"
      />
    </PremiumCard>
  )
}
