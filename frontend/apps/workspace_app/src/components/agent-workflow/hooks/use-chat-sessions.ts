import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GenerateChatMessage } from '@/components/agent-workflow/GenerateWorkflowChat'
import { useSession } from '@/hooks/use-session'
import { ASSISTANT_CHAT_IDLE_MINUTES } from '@/constants'

/** One Workflow AI conversation. */
export interface ChatSession {
  id: string
  title: string
  messages: GenerateChatMessage[]
  updatedAt: number
}

/** Fired while the assistant works on a request (each streamed step), so a long run never counts as idle. */
export const ASSISTANT_ACTIVITY_EVENT = 'eleven-nodes-assistant-activity'

// Chats are kept per account: one browser can be used by several people
const STORAGE_PREFIX = 'eleven-nodes.workflow-ai.chats'
// The list from before chats were per account; nobody can tell whose it was, so it is removed
const UNSCOPED_KEY = STORAGE_PREFIX
const MAX_SESSIONS = 50

const storageKey = (accountId: string | undefined) => (accountId ? `${STORAGE_PREFIX}:${accountId}` : null)

function newSession(): ChatSession {
  return { id: `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title: '', messages: [], updatedAt: Date.now() }
}

function load(key: string | null): ChatSession[] {
  if (!key) return []
  try {
    window.localStorage.removeItem(UNSCOPED_KEY)
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** The chat's title: its first message, shortened. */
function titleFor(messages: GenerateChatMessage[]): string {
  const first = messages.find((message) => message.role === 'user')?.content.trim() ?? ''
  return first.length > 48 ? `${first.slice(0, 47)}…` : first
}

/** The signed-in account's Workflow AI conversations, kept in this browser. The active one is always present. */
export function useChatSessions() {
  const key = storageKey(useSession()?.accountId)
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = load(key)
    return stored.length > 0 ? stored : [newSession()]
  })
  const [activeId, setActiveId] = useState(() => sessions[0].id)
  /** When the user last opened a chat themselves: a chat they reopen counts as active again. */
  const [selectedAt, setSelectedAt] = useState(() => Date.now())
  /** The last streamed step of a running request. */
  const workingAt = useRef(0)
  /** When the user last left this browser tab/window. */
  const awayAt = useRef<number | null>(null)
  // Whose chats are on screen; a different account loads its own instead
  const [loadedKey, setLoadedKey] = useState(key)

  if (loadedKey !== key) {
    const stored = load(key)
    const next = stored.length > 0 ? stored : [newSession()]
    setLoadedKey(key)
    setSessions(next)
    setActiveId(next[0].id)
  }

  useEffect(() => {
    // Only into the account the chats belong to (never while another account's are being loaded)
    if (!key || loadedKey !== key) return
    try {
      // Empty chats aren't worth keeping.
      const kept = sessions.filter((session) => session.messages.length > 0).slice(0, MAX_SESSIONS)
      window.localStorage.setItem(key, JSON.stringify(kept))
    } catch {
      // Storage full or blocked: the chats still live for this session.
    }
  }, [sessions, key, loadedKey])

  const active = useMemo(
    () => sessions.find((session) => session.id === activeId) ?? sessions[0],
    [sessions, activeId],
  )

  const setMessages = useCallback(
    (updater: (previous: GenerateChatMessage[]) => GenerateChatMessage[]) => {
      setSessions((previous) =>
        previous.map((session) => {
          if (session.id !== activeId) return session
          const messages = updater(session.messages)
          return { ...session, messages, title: session.title || titleFor(messages), updatedAt: Date.now() }
        }),
      )
    },
    [activeId],
  )

  const newChat = useCallback(() => {
    // Reuse the open chat when it is still empty.
    if (active.messages.length === 0) return
    const session = newSession()
    setSessions((previous) => [session, ...previous])
    setActiveId(session.id)
  }, [active])

  const deleteChat = useCallback(
    (id: string) => {
      setSessions((previous) => {
        const rest = previous.filter((session) => session.id !== id)
        const next = rest.length > 0 ? rest : [newSession()]
        if (id === activeId) setActiveId(next[0].id)
        return next
      })
    },
    [activeId],
  )

  const selectChat = useCallback((id: string) => {
    setActiveId(id)
    setSelectedAt(Date.now())
  }, [])

  // Only count idle time while the user is away from this browser tab/window. Keeping the canvas and chat open
  // should not rotate the conversation; returning after a long absence starts a new server-side conversation.
  useEffect(() => {
    const limit = ASSISTANT_CHAT_IDLE_MINUTES * 60_000
    const isAway = () => document.visibilityState !== 'visible' || !document.hasFocus()
    const check = () => {
      if (isAway()) {
        awayAt.current ??= Date.now()
        return
      }

      const awaySince = awayAt.current
      awayAt.current = null
      if (awaySince === null || active.messages.length === 0) return
      if (Date.now() - Math.max(awaySince, active.updatedAt, selectedAt, workingAt.current) < limit) return

      const session = newSession()
      setSessions((previous) => [session, ...previous])
      setActiveId(session.id)
      setSelectedAt(Date.now())
    }
    if (isAway()) awayAt.current ??= Date.now()
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
      else awayAt.current ??= Date.now()
    }
    const onWork = () => {
      workingAt.current = Date.now()
    }
    window.addEventListener(ASSISTANT_ACTIVITY_EVENT, onWork)
    window.addEventListener('blur', check)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(ASSISTANT_ACTIVITY_EVENT, onWork)
      window.removeEventListener('blur', check)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, selectedAt])

  const ordered = useMemo(() => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt), [sessions])

  return { sessions: ordered, active, selectChat, newChat, deleteChat, setMessages }
}
