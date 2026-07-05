import { createContext, useContext, type ReactNode } from 'react'
import type { AppConfig } from '@/types/config'

const AppConfigContext = createContext<AppConfig | null>(null)

/** Provides the resolved active configuration to the whole tree so
 *  individual components never deal with loading/error states. */
export function AppConfigProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>
}

export function useAppConfig(): AppConfig {
  const config = useContext(AppConfigContext)
  if (!config) {
    throw new Error('useAppConfig must be used within an AppConfigProvider')
  }
  return config
}
