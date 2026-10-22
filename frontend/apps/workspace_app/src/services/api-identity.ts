import { STORAGE_KEYS } from '@/constants'

interface StoredProjectSession {
  accountId: string
  email: string
  fullName: string
  role: string
  workspaceId: string
  displayName: string
  accountType: string
}

/** Attach the browser session identity used to provision database ownership rows. */
export function projectIdentityHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.projectSession)
    if (!raw) return {}
    const session = JSON.parse(raw) as Partial<StoredProjectSession>
    if (!session.accountId || !session.email) return {}

    return {
      'X-User-Id': session.accountId,
      'X-User-Email': session.email,
      'X-User-Name': encodeURIComponent(session.fullName ?? session.email),
      'X-User-Role': session.role ?? 'developer',
      'X-Workspace-Name': encodeURIComponent(session.displayName ?? 'Workspace'),
      'X-Account-Type': session.accountType ?? 'individual',
    }
  } catch {
    return {}
  }
}
