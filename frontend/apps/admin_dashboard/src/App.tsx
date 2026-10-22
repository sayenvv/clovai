import { useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useApplication } from './application'
import { ConfigurationPage } from './ConfigurationPage'
import { DocumentPage } from './DocumentPage'

export function App() {
  const { applications, current, error, select, create } = useApplication()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [createError, setCreateError] = useState('')

  async function addApplication() {
    setCreateError('')
    try {
      await create(name, location)
      setName('')
      setLocation('')
    } catch (reason: unknown) {
      setCreateError(reason instanceof Error ? reason.message : 'Could not create the application.')
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand">
          Admin Center
          <span>Eleven Nodes</span>
        </p>
        <label className="app-switch">
          Application
          <select
            aria-label="Application"
            value={current?.ai_integration_id ?? ''}
            onChange={(event) => select(event.target.value)}
          >
            {applications.map((item) => (
              <option key={item.ai_integration_id} value={item.ai_integration_id}>
                {item.name}
                {item.location ? ` · ${item.location}` : ''}
              </option>
            ))}
          </select>
          {current ? <span className="app-id">{current.ai_integration_id}</span> : null}
        </label>
        <form
          className="app-create"
          onSubmit={(event) => {
            event.preventDefault()
            void addApplication()
          }}
        >
          <input
            aria-label="Application name"
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            aria-label="Location"
            placeholder="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
          <button type="submit">Add application</button>
        </form>
        {createError || error ? <p className="error">{createError || error}</p> : null}
        <nav className="nav">
          <NavLink to="/configuration">Configuration</NavLink>
          <NavLink to="/template">Template</NavLink>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/configuration/application" replace />} />
          <Route path="/configuration" element={<Navigate to="/configuration/application" replace />} />
          <Route path="/configuration/application" element={<ConfigurationPage tab="application" />} />
          <Route path="/configuration/environment" element={<ConfigurationPage tab="environment" />} />
          {/* Old addresses, kept so bookmarks still land on the right tab. */}
          <Route path="/application" element={<Navigate to="/configuration/application" replace />} />
          <Route path="/environment" element={<Navigate to="/configuration/environment" replace />} />
          <Route path="/variables" element={<Navigate to="/configuration/environment" replace />} />
          <Route
            path="/template"
            element={
              <DocumentPage
                key="orchestration-template"
                title="Orchestration template"
                description="Saved copies of the orchestration template. The active one is the template document."
                collection="templates"
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}
