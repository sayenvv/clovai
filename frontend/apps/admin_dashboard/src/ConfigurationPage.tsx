import { NavLink } from 'react-router-dom'
import { ApplicationConfigTab } from './ApplicationConfigTab'
import { useApplication } from './application'
import { EnvironmentConfigTab } from './EnvironmentConfigTab'

export type ConfigurationTab = 'application' | 'environment'

const TABS: { tab: ConfigurationTab; label: string }[] = [
  { tab: 'application', label: 'Application' },
  { tab: 'environment', label: 'Environment' },
]

/** One page for the selected application's configuration, split into Application and Environment tabs. */
export function ConfigurationPage({ tab }: { tab: ConfigurationTab }) {
  const { current } = useApplication()
  return (
    <>
      <h1>Configuration</h1>
      {current ? (
        <p className="meta">
          {current.name}
          {current.location ? ` · ${current.location}` : ''} · {current.ai_integration_id}
        </p>
      ) : null}
      <nav className="tabs" aria-label="Configuration">
        {TABS.map((item) => (
          <NavLink key={item.tab} to={`/configuration/${item.tab}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      {/* key= remounts the tab when the application changes, so nothing carries over. */}
      {tab === 'application' ? (
        <ApplicationConfigTab key={current?.ai_integration_id} />
      ) : (
        <EnvironmentConfigTab key={current?.ai_integration_id} />
      )}
    </>
  )
}
