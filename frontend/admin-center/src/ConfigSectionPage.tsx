import { useEffect, useState } from 'react'
import { asRecord, loadActiveConfig, saveSection } from './configDocument'
import type { AdminDocument } from './api'

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

  useEffect(() => {
    let live = true
    loadActiveConfig()
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
  }, [section])

  async function save() {
    if (!current) return
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
      const saved = await saveSection(current, section, value)
      setCurrent(saved)
      setText(JSON.stringify(asRecord(asRecord(saved.document)[section]), null, 2))
      setStatus('Saved')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not save this section.')
    }
  }

  return (
    <>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
      {current ? <p className="meta">Active configuration: {current.name}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="status">{status}</p> : null}
      <div className="toolbar">
        <button type="button" onClick={save} disabled={!current}>
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
