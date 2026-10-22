import { useEffect, useState } from 'react'
import { useApplication } from './application'
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentSummary,
} from './api'

export function DocumentPage({
  title,
  description,
  collection,
}: {
  title: string
  description: string
  collection: 'configs' | 'templates'
}) {
  const [items, setItems] = useState<DocumentSummary[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [active, setActive] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const { current } = useApplication()
  const aiIntegrationId = current?.ai_integration_id ?? ''

  async function openDocument(id: string) {
    const row = await getDocument(collection, id, aiIntegrationId)
    setSelectedId(row.id)
    setName(row.name)
    setActive(row.is_active)
    setText(JSON.stringify(row.document, null, 2))
  }

  async function refresh(selectId?: string) {
    const rows = await listDocuments(collection, aiIntegrationId)
    setItems(rows)
    const next = selectId || rows.find((row) => row.is_active)?.id || rows[0]?.id || ''
    if (next) await openDocument(next)
    else {
      setSelectedId('')
      setName('')
      setActive(false)
      setText('')
    }
  }

  useEffect(() => {
    let live = true
    if (!aiIntegrationId) return () => {
      live = false
    }
    listDocuments(collection, aiIntegrationId)
      .then(async (rows) => {
        if (!live) return
        setItems(rows)
        const next = rows.find((row) => row.is_active)?.id || rows[0]?.id
        if (next) {
          const row = await getDocument(collection, next, aiIntegrationId)
          if (!live) return
          setSelectedId(row.id)
          setName(row.name)
          setActive(row.is_active)
          setText(JSON.stringify(row.document, null, 2))
        }
      })
      .catch((reason: unknown) => {
        if (live) setError(reason instanceof Error ? reason.message : 'Could not load documents.')
      })
    return () => {
      live = false
    }
  }, [collection, aiIntegrationId])

  async function save() {
    setError('')
    setStatus('')
    let document: unknown
    try {
      document = JSON.parse(text)
    } catch {
      setError('The document is not valid JSON.')
      return
    }
    if (document === null || typeof document !== 'object' || Array.isArray(document)) {
      setError('The document must be a JSON object.')
      return
    }
    try {
      const saved = selectedId
        ? await updateDocument(collection, selectedId, aiIntegrationId, { name, document, is_active: active })
        : await createDocument(collection, aiIntegrationId, { name: name || 'Untitled', document, is_active: active })
      setStatus('Saved')
      await refresh(saved.id)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not save the document.')
    }
  }

  async function createNew() {
    setError('')
    setStatus('')
    try {
      const created = await createDocument(collection, aiIntegrationId, {
        name: `New ${title.toLowerCase()}`,
        document: {},
        is_active: false,
      })
      await refresh(created.id)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not create the document.')
    }
  }

  async function remove() {
    if (!selectedId) return
    setError('')
    setStatus('')
    try {
      await deleteDocument(collection, selectedId, aiIntegrationId)
      await refresh()
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not delete the document.')
    }
  }

  return (
    <>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
      <div className="toolbar">
        <select
          value={selectedId}
          onChange={(event) => {
            setError('')
            setStatus('')
            openDocument(event.target.value).catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : 'Could not open the document.')
            })
          }}
        >
          {items.length === 0 ? <option value="">No saved documents</option> : null}
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.is_active ? ' (active)' : ''}
            </option>
          ))}
        </select>
        <button type="button" onClick={createNew}>
          New
        </button>
        <button type="button" onClick={save}>
          Save
        </button>
        <button type="button" className="danger" onClick={remove} disabled={!selectedId}>
          Delete
        </button>
      </div>
      <label className="field">
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Active
      </label>
      {error ? <p className="error">{error}</p> : null}
      {status ? <p className="status">{status}</p> : null}
      <textarea
        className="editor"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </>
  )
}
