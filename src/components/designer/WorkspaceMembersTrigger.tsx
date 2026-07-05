import { memo, useMemo, useState } from 'react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/utils/cn'
import {
  memberDisplayName,
  memberInitials,
  useShareSettings,
  workspaceMemberCount,
  type ShareMember,
} from './share-settings'

const MAX_VISIBLE = 4

interface WorkspaceMembersTriggerProps {
  toolId: string
  onManageAccess?: () => void
}

interface FacepileMember {
  id: string
  name: string
  email: string
  seed: string
  initials: string
  isOwner?: boolean
  isOnline?: boolean
}

function MemberRow({ member }: { member: FacepileMember & { role: string } }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <UserAvatar
        seed={member.seed}
        initials={member.initials}
        name={member.name}
        size="md"
        ringClassName="ring-1 ring-border"
        showOnline={member.isOnline}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.name}</p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
        {member.role}
      </span>
    </li>
  )
}

/** Overlapping avatar facepile — click to see everyone in the workspace. */
export const WorkspaceMembersTrigger = memo(function WorkspaceMembersTrigger({
  toolId,
  onManageAccess,
}: WorkspaceMembersTriggerProps) {
  const { settings } = useShareSettings(toolId)
  const [open, setOpen] = useState(false)

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

  const visible = allMembers.slice(0, MAX_VISIBLE)
  const overflow = allMembers.length - visible.length
  const total = workspaceMemberCount(settings)

  const memberRows = useMemo(
    () =>
      allMembers.map((member) => ({
        ...member,
        role: member.isOwner
          ? 'owner'
          : (settings.members.find((m) => m.id === member.id)?.role ?? 'member'),
      })),
    [allMembers, settings.members],
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${total} member${total === 1 ? '' : 's'} in this workspace`}
        className="group flex items-center rounded-full p-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="flex items-center pl-0.5">
          {visible.map((member, index) => (
            <span
              key={member.id}
              style={{ zIndex: visible.length - index }}
              className={cn(index > 0 && '-ml-2')}
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
          {overflow > 0 && (
            <span
              style={{ zIndex: 0 }}
              className="-ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background"
            >
              +{overflow}
            </span>
          )}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm gap-0 p-0 sm:rounded-xl">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-base">People in this workspace</DialogTitle>
            <DialogDescription>
              {total} member{total === 1 ? '' : 's'} with access to this diagram.
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-80 divide-y px-5">
            {memberRows.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </ul>

          {onManageAccess && (
            <div className="border-t px-5 py-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setOpen(false)
                  onManageAccess()
                }}
              >
                Invite people
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
})
