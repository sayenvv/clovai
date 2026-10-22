import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createApplication, errorMessage, listApplications, type Application } from '@/api/config'
import { STORAGE_KEYS } from '@/constants'

type ApplicationState = {
  applications: Application[]
  current: Application | null
  loading: boolean
  error: string
  select: (aiIntegrationId: string) => void
  create: (name: string, location: string) => Promise<void>
}

const ApplicationContext = createContext<ApplicationState | null>(null)

function readRemembered(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.application) ?? ''
  } catch {
    return ''
  }
}

/** The application every config page works on. The choice is remembered per browser. */
export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<Application[]>([])
  const [aiIntegrationId, setAiIntegrationId] = useState(readRemembered)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listApplications()
      .then((rows) => {
        setApplications(rows)
        setAiIntegrationId((current) =>
          rows.some((row) => row.ai_integration_id === current) ? current : rows[0]?.ai_integration_id || '',
        )
      })
      .catch((reason: unknown) => setError(errorMessage(reason, 'Could not load applications.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!aiIntegrationId) return
    try {
      window.localStorage.setItem(STORAGE_KEYS.application, aiIntegrationId)
    } catch {
      /* ignore */
    }
  }, [aiIntegrationId])

  const current = applications.find((item) => item.ai_integration_id === aiIntegrationId) ?? null

  async function create(name: string, location: string) {
    setError('')
    const created = await createApplication({ name, location })
    setApplications((rows) => [...rows, created].sort((left, right) => left.name.localeCompare(right.name)))
    setAiIntegrationId(created.ai_integration_id)
  }

  return (
    <ApplicationContext.Provider
      value={{ applications, current, loading, error, select: setAiIntegrationId, create }}
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
