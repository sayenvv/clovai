import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GenerateChatMessage } from '@/components/agent-workflow/GenerateWorkflowChat'

/** One Workflow AI conversation. */
export interface ChatSession {
  id: string
  title: string
  messages: GenerateChatMessage[]
  updatedAt: number
}

const STORAGE_KEY = 'eleven-nodes.workflow-ai.chats'
const MAX_SESSIONS = 50

function newSession(): ChatSession {
  return { id: `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title: '', messages: [], updatedAt: Date.now() }
}

function load(): ChatSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
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

/** Workflow AI conversations, kept in this browser. The active one is always present. */
export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = load()
    return stored.length > 0 ? stored : [newSession()]
  })
  const [activeId, setActiveId] = useState(() => sessions[0].id)

  useEffect(() => {
    try {
      // Empty chats aren't worth keeping.
      const kept = sessions.filter((session) => session.messages.length > 0).slice(0, MAX_SESSIONS)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
    } catch {
      // Storage full or blocked: the chats still live for this session.
    }
  }, [sessions])

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

  const ordered = useMemo(() => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt), [sessions])

  return { sessions: ordered, active, selectChat: setActiveId, newChat, deleteChat, setMessages }
}
