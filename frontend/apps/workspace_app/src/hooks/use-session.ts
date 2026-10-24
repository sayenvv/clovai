import { useEffect, useState } from 'react'
import { getSession, type ProjectSession } from '@/services/project-auth-store'

/** The signed-in session, kept current when it changes (profile edits, sign out). */
export function useSession(): ProjectSession | null {
  const [session, setSession] = useState<ProjectSession | null>(getSession)
  useEffect(() => {
    const sync = () => setSession(getSession())
    window.addEventListener('eleven-nodes-project-session', sync)
    return () => window.removeEventListener('eleven-nodes-project-session', sync)
  }, [])
  return session
}
