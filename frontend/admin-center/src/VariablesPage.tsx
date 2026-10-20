import { useEffect, useState } from 'react'
import { listVariables, replaceVariables } from './api'
import { useApplication } from './application'

type Variable = { name: string; value: string }

export function VariablesPage() {
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
    listVariables(aiIntegrationId)
      .then((rows) => {
        if (!live) return
        setVariables(rows.map((row) => ({ name: row.name, value: row.value })))
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
    if (!aiIntegrationId) return
    setError('')
    setStatus('')
    const envConfig: Record<string, string> = {}
    for (const item of variables) {
      const key = item.name.trim()
      if (!key) {
        setError('Every variable needs a name.')
        return
      }
      if (key in envConfig) {
        setError(`${key} is listed more than once.`)
        return
      }
      envConfig[key] = item.value
    }
    try {
      const saved = await replaceVariables(aiIntegrationId, variables.map((item) => ({
        name: item.name.trim(),
        value: item.value,
      })))
      setVariables(saved.map((row) => ({ name: row.name, value: row.value })))
      setStatus('Saved')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not save variables.')
    }
  }

  return (
    <>
      <h1>Variables</h1>
      <p className="lede">
        Environment variables for this application. Adding one saves it in the variables table.
      </p>
      {current ? (
        <p className="meta">
          {current.name}
          {current.location ? ` · ${current.location}` : ''} · {current.ai_integration_id}
        </p>
      ) : null}
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
        <button type="button" onClick={save} disabled={!aiIntegrationId}>
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
