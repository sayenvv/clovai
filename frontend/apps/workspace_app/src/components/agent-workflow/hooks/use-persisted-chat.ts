import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useSession } from '@/hooks/use-session'

// A long chat keeps its latest messages; older ones are dropped so storage never fills up
const MAX_MESSAGES = 80
const PREFIX = 'eleven-nodes.assistant-chat'

interface StoredChat<T> {
  conversationId: string
  messages: T[]
}

function storageKey(accountId: string | undefined, scope: string | undefined): string | null {
  return accountId && scope ? `${PREFIX}:${accountId}:${scope}` : null
}

function load<T>(key: string | null): StoredChat<T> {
  try {
    const raw = key ? localStorage.getItem(key) : null
    const parsed = raw ? (JSON.parse(raw) as StoredChat<T>) : null
    if (parsed && typeof parsed.conversationId === 'string' && Array.isArray(parsed.messages)) return parsed
  } catch {
    // Unreadable or blocked storage: start fresh
  }
  return { conversationId: crypto.randomUUID(), messages: [] }
}

/**
 * An assistant chat that survives leaving the page and reloading: its messages and its server-side conversation id,
 * kept in this browser per account and `scope` (such as one deployment's app). Without a scope it lives only while
 * the component does.
 *
 * Returns:
 *   The messages, their setter, the conversation id to send with each request, and `reset` for a new chat.
 */
export function usePersistedChat<T>(scope?: string): {
  messages: T[]
  setMessages: Dispatch<SetStateAction<T[]>>
  conversationId: string
  reset: () => void
} {
  const key = storageKey(useSession()?.accountId, scope)
  const [chat, setChat] = useState<StoredChat<T>>(() => load<T>(key))
  const [loadedKey, setLoadedKey] = useState(key)

  // Another account or scope: show its own chat
  if (loadedKey !== key) {
    setLoadedKey(key)
    setChat(load<T>(key))
  }

  useEffect(() => {
    if (!key || loadedKey !== key) return
    try {
      if (chat.messages.length) localStorage.setItem(key, JSON.stringify({ ...chat, messages: chat.messages.slice(-MAX_MESSAGES) }))
      else localStorage.removeItem(key)
    } catch {
      // Storage full or blocked: the chat still lives while the page is open
    }
  }, [chat, key, loadedKey])

  const setMessages = useCallback<Dispatch<SetStateAction<T[]>>>(
    (update) => setChat((previous) => ({ ...previous, messages: typeof update === 'function' ? (update as (value: T[]) => T[])(previous.messages) : update })),
    [],
  )
  const reset = useCallback(() => setChat({ conversationId: crypto.randomUUID(), messages: [] }), [])

  return { messages: chat.messages, setMessages, conversationId: chat.conversationId, reset }
}
