import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  ConnectionsUnavailableError,
  createModelConnection,
  deleteModelConnection,
  listModelConnections,
  updateModelConnection,
  type ModelConnection,
  type ModelConnectionInput,
} from '@/services/model-connections-api'

interface ConnectionsState {
  connections: ModelConnection[]
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'
  error: string | null
}

// One shared list for every panel; reloaded after each change.
let state: ConnectionsState = { connections: [], status: 'idle', error: null }
const listeners = new Set<() => void>()
function setState(next: Partial<ConnectionsState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

async function load() {
  setState({ status: 'loading', error: null })
  try {
    setState({ connections: await listModelConnections(), status: 'ready' })
  } catch (reason) {
    if (reason instanceof ConnectionsUnavailableError) setState({ status: 'unavailable', connections: [] })
    else setState({ status: 'error', error: reason instanceof Error ? reason.message : 'Could not load connections.' })
  }
}

/** The user's saved model connections, with create / update / delete. */
export function useModelConnections() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )

  useEffect(() => {
    if (state.status === 'idle') void load()
  }, [])

  const save = useCallback(async (input: ModelConnectionInput, id?: string) => {
    const saved = id ? await updateModelConnection(id, input) : await createModelConnection(input)
    await load()
    return saved
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteModelConnection(id)
    await load()
  }, [])

  return { ...snapshot, reload: load, save, remove }
}
