import { useEffect, useState } from 'react'
import { listVariables, replaceVariables, type AdminDocument } from './api'
import { useApplication } from './application'
import { asRecord, loadActiveConfig, saveSection } from './configDocument'

export function ConfigSectionPage({
  title,
  description,
  section,
}: {
  title: string
  description: string
  section: 'systemConfig' | 'envConfig'
}) {
  const [current, setCurrent] = useState<AdminDocument | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const { current: application } = useApplication()
  const aiIntegrationId = application?.ai_integration_id ?? ''

  useEffect(() => {
    let live = true
    if (!aiIntegrationId) return () => {
      live = false
    }
    const load =
      section === 'envConfig'
        ? listVariables(aiIntegrationId).then((rows) => {
            if (!live) return
            setCurrent(null)
            setText(JSON.stringify(Object.fromEntries(rows.map((row) => [row.name, row.value])), null, 2))
          })
        : loadActiveConfig(aiIntegrationId).then((document) => {
            if (!live) return
            setCurrent(document)
            setText(JSON.stringify(asRecord(asRecord(document.document)[section]), null, 2))
          })
    load
      .catch((reason: unknown) => {
        if (live) setError(reason instanceof Error ? reason.message : 'Could not load the configuration.')
      })
    return () => {
      live = false
    }
  }, [section, aiIntegrationId])

  async function save() {
    if (!aiIntegrationId) return
    setError('')
    setStatus('')
    let value: unknown
    try {
      value = JSON.parse(text)
    } catch {
      setError('This section is not valid JSON.')
      return
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      setError('This section must be a JSON object.')
      return
    }
    try {
      if (section === 'envConfig') {
        const variables = Object.entries(value as Record<string, unknown>).map(([name, item]) => ({
          name,
          value: typeof item === 'string' ? item : JSON.stringify(item),
        }))
        const saved = await replaceVariables(aiIntegrationId, variables)
        setText(JSON.stringify(Object.fromEntries(saved.map((row) => [row.name, row.value])), null, 2))
      } else if (current) {
        const saved = await saveSection(current, section, value)
        setCurrent(saved)
        setText(JSON.stringify(asRecord(asRecord(saved.document)[section]), null, 2))
      }
      setStatus('Saved')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not save this section.')
    }
  }

  return (
    <>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
      {application ? (
        <p className="meta">
          {application.name}
          {application.location ? ` · ${application.location}` : ''} · {application.ai_integration_id}
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="status">{status}</p> : null}
      <div className="toolbar">
        <button type="button" onClick={save} disabled={!aiIntegrationId || (section === 'systemConfig' && !current)}>
          Save
        </button>
      </div>
      <textarea
        className="editor"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </>
  )
}
