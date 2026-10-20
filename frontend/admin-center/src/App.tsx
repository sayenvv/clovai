import { NavLink, Route, Routes } from 'react-router-dom'
import { ConfigSectionPage } from './ConfigSectionPage'
import { DocumentPage } from './DocumentPage'
import { VariablesPage } from './VariablesPage'

export function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand">
          Admin Center
          <span>Eleven Nodes</span>
        </p>
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
                description="Environment config for the active configuration. Variable names are added on the Variables tab."
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
