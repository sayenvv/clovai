import { memo, useMemo } from 'react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { cn } from '@/utils/cn'
import {
  memberDisplayName,
  memberInitials,
  useShareSettings,
  workspaceMemberCount,
  type ShareMember,
} from '@/components/designer/share-settings'

const DEFAULT_MAX_VISIBLE = 4

export interface FacepileMember {
  id: string
  name: string
  email: string
  seed: string
  initials: string
  isOwner?: boolean
  isOnline?: boolean
}

export function useWorkspaceMembers(toolId: string) {
  const { settings } = useShareSettings(toolId)

  const allMembers = useMemo<FacepileMember[]>(
    () => [
      {
        id: 'owner',
        name: 'You',
        email: 'you@workspace',
        seed: 'you',
        initials: 'Y',
        isOwner: true,
        isOnline: true,
      },
      ...settings.members.map((member: ShareMember) => ({
        id: member.id,
        name: memberDisplayName(member.email),
        email: member.email,
        seed: member.email,
        initials: memberInitials(member.email),
        isOnline: true,
      })),
    ],
    [settings.liveCollab, settings.members],
  )

  const total = workspaceMemberCount(settings)

  return { settings, allMembers, total }
}

interface WorkspaceMembersFacepileProps {
  toolId: string
  maxVisible?: number
  className?: string
  /** Show +N overflow chip when more members exist. */
  showOverflow?: boolean
  /** Stack avatars vertically for narrow rails. */
  orientation?: 'horizontal' | 'vertical'
}

/** Overlapping avatar group — same visual as the workspace header facepile. */
export const WorkspaceMembersFacepile = memo(function WorkspaceMembersFacepile({
  toolId,
  maxVisible = DEFAULT_MAX_VISIBLE,
  className,
  showOverflow = true,
  orientation = 'horizontal',
}: WorkspaceMembersFacepileProps) {
  const { allMembers } = useWorkspaceMembers(toolId)
  const visible = allMembers.slice(0, maxVisible)
  const overflow = allMembers.length - visible.length
  const vertical = orientation === 'vertical'

  return (
    <span
      className={cn(
        vertical ? 'inline-flex flex-col items-center pt-0.5' : 'inline-flex items-center pl-0.5',
        className,
      )}
    >
      {visible.map((member, index) => (
        <span
          key={member.id}
          style={{ zIndex: visible.length - index }}
          className={cn(index > 0 && (vertical ? '-mt-2' : '-ml-2'))}
        >
          <UserAvatar
            seed={member.seed}
            initials={member.initials}
            name={member.name}
            size="xs"
            showOnline={member.isOnline}
          />
        </span>
      ))}
      {showOverflow && overflow > 0 && (
        <span
          style={{ zIndex: 0 }}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background',
            vertical ? '-mt-2' : '-ml-2',
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
})
