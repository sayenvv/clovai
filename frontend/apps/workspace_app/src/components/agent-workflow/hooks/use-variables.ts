import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  VariablesUnavailableError,
  createVariable,
  deleteVariable,
  listVariables,
  updateVariable,
  type EnvVariable,
  type EnvVariableInput,
} from '@/services/variables-api'

interface VariablesState {
  variables: EnvVariable[]
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'
  error: string | null
}

// One shared list for every panel; reloaded after each change.
let state: VariablesState = { variables: [], status: 'idle', error: null }
const listeners = new Set<() => void>()
function setState(next: Partial<VariablesState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

async function load() {
  setState({ status: 'loading', error: null })
  try {
    setState({ variables: await listVariables(), status: 'ready' })
  } catch (reason) {
    if (reason instanceof VariablesUnavailableError) setState({ status: 'unavailable', variables: [] })
    else setState({ status: 'error', error: reason instanceof Error ? reason.message : 'Could not load variables.' })
  }
}

/** The user's environment variables, with create / update / delete. */
export function useVariables() {
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

  const save = useCallback(async (input: EnvVariableInput, id?: string) => {
    const saved = id ? await updateVariable(id, input) : await createVariable(input)
    await load()
    return saved
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteVariable(id)
    await load()
  }, [])

  return { ...snapshot, reload: load, save, remove }
}
