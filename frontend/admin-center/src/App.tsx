import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useApplication } from './application'
import { ConfigSectionPage } from './ConfigSectionPage'
import { DocumentPage } from './DocumentPage'
import { VariablesPage } from './VariablesPage'

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
          <NavLink to="/" end>
            Configuration
          </NavLink>
          <NavLink to="/application">Application config</NavLink>
          <NavLink to="/environment">Environment config</NavLink>
          <NavLink to="/variables">Variables</NavLink>
          <NavLink to="/template">Template</NavLink>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route
            path="/"
            element={
              <DocumentPage
                key="orch-config"
                title="Configuration"
                description="Saved copies of the orch config. The active one is the configuration document."
                collection="configs"
              />
            }
          />
          <Route
            path="/application"
            element={
              <ConfigSectionPage
                title="Application config"
                description="System config for the active configuration: models, runtime, limits, and the other application defaults."
                section="systemConfig"
              />
            }
          />
          <Route
            path="/environment"
            element={
              <ConfigSectionPage
                title="Environment config"
                description="Environment variables for this application, stored in the variables table. Add names on the Variables tab."
                section="envConfig"
              />
            }
          />
          <Route path="/variables" element={<VariablesPage />} />
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
