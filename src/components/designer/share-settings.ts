import { useCallback, useEffect, useState } from 'react'
import { STORAGE_KEYS } from '@/constants'

export type MemberRole = 'owner' | 'editor' | 'viewer'
export type LinkAccess = 'restricted' | 'view' | 'edit'

export interface ShareMember {
  id: string
  email: string
  role: MemberRole
}

export interface ShareSettings {
  linkAccess: LinkAccess
  liveCollab: boolean
  showCursors: boolean
  members: ShareMember[]
}

/** Default collaborators shown until the user customizes the member list. */
export const DEFAULT_WORKSPACE_MEMBERS: ShareMember[] = [
  { id: 'member-sarah', email: 'sarah.chen@company.com', role: 'editor' },
  { id: 'member-marcus', email: 'marcus.johnson@company.com', role: 'editor' },
  { id: 'member-priya', email: 'priya.patel@company.com', role: 'viewer' },
]

export const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  linkAccess: 'restricted',
  liveCollab: true,
  showCursors: true,
  members: DEFAULT_WORKSPACE_MEMBERS,
}

export const SHARE_SETTINGS_EVENT = 'clovai-share-settings-updated'

export function loadShareSettings(toolId: string): ShareSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.shareSettings(toolId))
    if (!raw) return DEFAULT_SHARE_SETTINGS
    const parsed = { ...DEFAULT_SHARE_SETTINGS, ...JSON.parse(raw) } as ShareSettings
    if (parsed.members.length === 0) {
      const next = { ...parsed, members: DEFAULT_WORKSPACE_MEMBERS }
      localStorage.setItem(STORAGE_KEYS.shareSettings(toolId), JSON.stringify(next))
      return next
    }
    return parsed
  } catch {
    return DEFAULT_SHARE_SETTINGS
  }
}

export function saveShareSettings(toolId: string, settings: ShareSettings) {
  localStorage.setItem(STORAGE_KEYS.shareSettings(toolId), JSON.stringify(settings))
  window.dispatchEvent(new Event(SHARE_SETTINGS_EVENT))
}

export function memberAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 42% 42%)`
}

export function memberInitials(email: string): string {
  const local = email.split('@')[0] ?? email
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export function memberDisplayName(email: string): string {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/** Workspace members shown in the header: you plus everyone invited. */
export function workspaceMemberCount(settings: ShareSettings): number {
  return 1 + settings.members.length
}

export function useShareSettings(toolId: string) {
  const [settings, setSettings] = useState<ShareSettings>(() => loadShareSettings(toolId))

  useEffect(() => {
    const reload = () => setSettings(loadShareSettings(toolId))
    window.addEventListener(SHARE_SETTINGS_EVENT, reload)
    window.addEventListener('storage', reload)
    return () => {
      window.removeEventListener(SHARE_SETTINGS_EVENT, reload)
      window.removeEventListener('storage', reload)
    }
  }, [toolId])

  const updateSettings = useCallback(
    (patch: Partial<ShareSettings> | ((previous: ShareSettings) => ShareSettings)) => {
      setSettings((previous) => {
        const next =
          typeof patch === 'function' ? patch(previous) : { ...previous, ...patch }
        saveShareSettings(toolId, next)
        return next
      })
    },
    [toolId],
  )

  return { settings, updateSettings }
}
