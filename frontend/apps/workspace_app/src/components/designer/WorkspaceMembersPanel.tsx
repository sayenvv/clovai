import { memo, useMemo } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import {
  memberDisplayName,
  memberInitials,
  useShareSettings,
  workspaceMemberCount,
  type ShareMember,
} from '@/components/designer/share-settings'

interface WorkspaceMembersPanelProps {
  toolId: string
  onManageAccess?: () => void
  /** Hide panel header when nested inside a dialog or sidebar shell title. */
  hideHeader?: boolean
  /** Compact layout for dialog embedding. */
  embedded?: boolean
}

interface MemberRowData {
  id: string
  name: string
  email: string
  seed: string
  initials: string
  role: string
  isOnline?: boolean
}

function MemberRow({ member }: { member: MemberRowData }) {
  return (
    <li className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <UserAvatar
        seed={member.seed}
        initials={member.initials}
        name={member.name}
        size="md"
        ringClassName="ring-1 ring-border"
        showOnline={member.isOnline}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
        {member.role}
      </span>
    </li>
  )
}

export const WorkspaceMembersPanel = memo(function WorkspaceMembersPanel({
  toolId,
  onManageAccess,
  hideHeader = false,
  embedded = false,
}: WorkspaceMembersPanelProps) {
  const { settings } = useShareSettings(toolId)
  const total = workspaceMemberCount(settings)

  const memberRows = useMemo<MemberRowData[]>(
    () => [
      {
        id: 'owner',
        name: 'You',
        email: 'you@workspace',
        seed: 'you',
        initials: 'Y',
        role: 'owner',
        isOnline: true,
      },
      ...settings.members.map((member: ShareMember) => ({
        id: member.id,
        name: memberDisplayName(member.email),
        email: member.email,
        seed: member.email,
        initials: memberInitials(member.email),
        role: member.role,
        isOnline: true,
      })),
    ],
    [settings.members],
  )

  return (
    <div className={cn('flex min-h-0 flex-col', embedded ? 'max-h-80' : 'h-full')}>
      {!hideHeader && !embedded && (
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Collaborators</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {total} member{total === 1 ? '' : 's'} with access to this workflow.
          </p>
        </div>
      )}

      <ul className={cn('min-h-0 flex-1 overflow-y-auto', embedded ? 'px-5' : 'px-4')}>
        {memberRows.map((member) => (
          <MemberRow key={member.id} member={member} />
        ))}
        {settings.members.length === 0 && (
          <li className="py-8 text-center text-xs text-muted-foreground">
            No collaborators yet. Invite teammates to review and edit this workflow.
          </li>
        )}
      </ul>

      {onManageAccess && (
        <div className={cn('shrink-0 border-t border-border p-4', embedded && 'px-5')}>
          <Button type="button" variant="outline" className="w-full gap-2" onClick={onManageAccess}>
            <UserPlus className="h-4 w-4" />
            Invite people
          </Button>
        </div>
      )}
    </div>
  )
})
