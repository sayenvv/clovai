import { useEffect, useState } from 'react'
import { getSession } from '@/services/project-auth-store'
import {
  getPublishedDashboardStats,
  listPublishedInstances,
  type PublishedWorkflowInstance,
} from '@/services/published-instances-store'

export function usePublishedInstances() {
  const session = getSession()
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
