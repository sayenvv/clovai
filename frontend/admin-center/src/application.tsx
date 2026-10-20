import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createApplication, listApplications, type Application } from './api'

type ApplicationState = {
  applications: Application[]
  current: Application | null
  error: string
  select: (aiIntegrationId: string) => void
  create: (name: string, location: string) => Promise<void>
}

const ApplicationContext = createContext<ApplicationState | null>(null)

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<Application[]>([])
  const [aiIntegrationId, setAiIntegrationId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    listApplications()
      .then((rows) => {
        setApplications(rows)
        setAiIntegrationId((current) => current || rows[0]?.ai_integration_id || '')
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not load applications.')
      })
  }, [])

  const current = applications.find((item) => item.ai_integration_id === aiIntegrationId) ?? null

  async function create(name: string, location: string) {
    setError('')
    const created = await createApplication({
      name,
      location,
    })
    setApplications((rows) => [...rows, created].sort((left, right) => left.name.localeCompare(right.name)))
    setAiIntegrationId(created.ai_integration_id)
  }

  return (
    <ApplicationContext.Provider
      value={{
        applications,
        current,
        error,
        select: setAiIntegrationId,
        create,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  )
}

export function useApplication(): ApplicationState {
  const value = useContext(ApplicationContext)
  if (!value) throw new Error('ApplicationProvider is missing')
  return value
}
