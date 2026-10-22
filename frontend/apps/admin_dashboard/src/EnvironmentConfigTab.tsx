import { useEffect, useState } from 'react'
import { type AdminDocument } from './api'
import { useApplication } from './application'
import { asRecord, loadActiveConfig, saveSection } from './configDocument'

type Variable = { name: string; value: string }

const SECTION = 'environment'

/** The rows of the config's ``environment`` object, in name order. */
function rowsOf(document: AdminDocument): Variable[] {
  return Object.entries(asRecord(asRecord(document.document)[SECTION]))
    .map(([name, value]) => ({ name, value: typeof value === 'string' ? value : JSON.stringify(value) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The Environment tab: the active configuration's ``environment``, one row per variable. */
export function EnvironmentConfigTab() {
  const [config, setConfig] = useState<AdminDocument | null>(null)
  const [variables, setVariables] = useState<Variable[]>([])
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const { current } = useApplication()
  const aiIntegrationId = current?.ai_integration_id ?? ''

  useEffect(() => {
    let live = true
    if (!aiIntegrationId) return () => {
      live = false
    }
    loadActiveConfig(aiIntegrationId)
      .then((document) => {
        if (!live) return
        setConfig(document)
        setVariables(rowsOf(document))
      })
      .catch((reason: unknown) => {
        if (live) setError(reason instanceof Error ? reason.message : 'Could not load variables.')
      })
    return () => {
      live = false
    }
  }, [aiIntegrationId])

  function addVariable() {
    setError('')
    setStatus('')
    const key = name.trim()
    if (!key) {
      setError('Enter a variable name.')
      return
    }
    if (variables.some((item) => item.name === key)) {
      setError(`${key} is already listed.`)
      return
    }
    setVariables([...variables, { name: key, value: value.trim() || `\${${key}}` }])
    setName('')
    setValue('')
  }

  async function save() {
    if (!aiIntegrationId || !config) return
    setError('')
    setStatus('')
    const environment: Record<string, string> = {}
    for (const item of variables) {
      const key = item.name.trim()
      if (!key) {
        setError('Every variable needs a name.')
        return
      }
      if (key in environment) {
        setError(`${key} is listed more than once.`)
        return
      }
      environment[key] = item.value
    }
    try {
      const saved = await saveSection(config, aiIntegrationId, SECTION, environment)
      setConfig(saved)
      setVariables(rowsOf(saved))
      setStatus('Saved')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not save variables.')
    }
  }

  return (
    <>
      <p className="lede">
        Environment variables the template reads as <code>${'{'}NAME{'}'}</code>. A blank value falls back to the
        server&apos;s own environment.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="status">{status}</p> : null}
      <div className="toolbar">
        <input
          aria-label="Variable name"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          aria-label="Variable value"
          placeholder="${NAME}"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button" onClick={addVariable}>
          Add
        </button>
        <button type="button" onClick={save} disabled={!config}>
          Save
        </button>
      </div>
      <table className="variables">
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {variables.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td>
                <input
                  aria-label={`Name ${index + 1}`}
                  value={item.name}
                  onChange={(event) => {
                    const next = [...variables]
                    next[index] = { ...item, name: event.target.value }
                    setVariables(next)
                  }}
                />
              </td>
              <td>
                <input
                  aria-label={`Value ${index + 1}`}
                  value={item.value}
                  onChange={(event) => {
                    const next = [...variables]
                    next[index] = { ...item, value: event.target.value }
                    setVariables(next)
                  }}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="danger"
                  onClick={() => setVariables(variables.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
