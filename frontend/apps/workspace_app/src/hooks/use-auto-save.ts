import { useCallback, useSyncExternalStore } from 'react'
import { STORAGE_KEYS } from '@/constants'

/** Whether the editor saves the workflow by itself after each change; a preference of this browser, off by default. */
const listeners = new Set<() => void>()

function readAutoSave(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.autoSave) === 'on'
  } catch {
    return false
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changing it
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.autoSave) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useAutoSave(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, readAutoSave, () => false)
  const setEnabled = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEYS.autoSave, next ? 'on' : 'off')
    } catch {
      // storage unavailable: the setting lasts until reload at most
    }
    listeners.forEach((listener) => listener())
  }, [])
  return [enabled, setEnabled]
}
