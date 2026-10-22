import { useEffect, useState } from 'react'
import { type AdminDocument } from './api'
import { useApplication } from './application'
import { asRecord, loadActiveConfig, saveSection } from './configDocument'

/** The Application tab: the active configuration's ``systemConfig`` as editable JSON. */
export function ApplicationConfigTab() {
  const section = 'systemConfig'
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
    setError('')
    setStatus('')
    loadActiveConfig(aiIntegrationId)
      .then((document) => {
        if (!live) return
        setCurrent(document)
        setText(JSON.stringify(asRecord(asRecord(document.document)[section]), null, 2))
      })
      .catch((reason: unknown) => {
        if (live) setError(reason instanceof Error ? reason.message : 'Could not load the configuration.')
      })
    return () => {
      live = false
    }
  }, [aiIntegrationId])

  async function save() {
    if (!current) return
    setError('')
    setStatus('')
    let value: unknown
    try {
      value = JSON.parse(text)
    } catch {
      setError('The application config is not valid JSON.')
      return
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      setError('The application config must be a JSON object.')
      return
    }
    try {
      const saved = await saveSection(current, aiIntegrationId, section, value)
      setCurrent(saved)
      setText(JSON.stringify(asRecord(asRecord(saved.document)[section]), null, 2))
      setStatus('Saved')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not save the application config.')
    }
  }

  return (
    <>
      <p className="lede">Models, runtime, limits and the other application defaults the template reads.</p>
      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="status">{status}</p> : null}
      <div className="toolbar">
        <button type="button" onClick={save} disabled={!current}>
          Save
        </button>
      </div>
      <textarea
        className="editor"
        aria-label="Application config"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </>
  )
}
