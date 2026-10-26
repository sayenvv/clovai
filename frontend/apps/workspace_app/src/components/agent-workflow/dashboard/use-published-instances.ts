import { useEffect, useState } from 'react'
import { useSession } from '@/hooks/use-session'
import {
  getPublishedDashboardStats,
  listPublishedInstances,
  type PublishedWorkflowInstance,
} from '@/services/published-instances-store'

export function usePublishedInstances() {
  // Re-renders when the session changes (sign-in, switching account, restored from the server)
  const session = useSession()
  const [instances, setInstances] = useState<PublishedWorkflowInstance[]>(() =>
    listPublishedInstances(session?.accountId),
  )

  useEffect(() => {
    const sync = () => setInstances(listPublishedInstances(session?.accountId))
    sync()
    window.addEventListener('eleven-nodes-published-instances', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('eleven-nodes-published-instances', sync)
      window.removeEventListener('storage', sync)
    }
  }, [session?.accountId])

  const overview = getPublishedDashboardStats(session?.accountId)

  return { session, instances, overview }
}
