import { memo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { WorkspaceMembersFacepile, useWorkspaceMembers } from '@/components/designer/WorkspaceMembersFacepile'
import { WorkspaceMembersPanel } from '@/components/designer/WorkspaceMembersPanel'
import { cn } from '@/utils/cn'

interface WorkspaceMembersTriggerProps {
  toolId: string
  onManageAccess?: () => void
  /** When set, opens the member list in a sidebar instead of a dialog. */
  onOpenSidebar?: () => void
}

/** Overlapping avatar facepile — click to see everyone in the workspace. */
export const WorkspaceMembersTrigger = memo(function WorkspaceMembersTrigger({
  toolId,
  onManageAccess,
  onOpenSidebar,
}: WorkspaceMembersTriggerProps) {
  const { total } = useWorkspaceMembers(toolId)
  const [open, setOpen] = useState(false)

  const handleClick = () => {
    if (onOpenSidebar) {
      onOpenSidebar()
      return
    }
    setOpen(true)
  }

  const handleManageAccess = onManageAccess
    ? () => {
        setOpen(false)
        onManageAccess()
      }
    : undefined

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`${total} member${total === 1 ? '' : 's'} in this workspace`}
        className={cn(
          'group flex items-center rounded-full p-0.5 transition-colors',
          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        <WorkspaceMembersFacepile toolId={toolId} />
      </button>

      {!onOpenSidebar && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm gap-0 overflow-hidden p-0 sm:rounded-xl">
            <DialogHeader className="border-b px-5 py-4">
              <DialogTitle className="text-base">People in this workspace</DialogTitle>
              <DialogDescription>
                {total} member{total === 1 ? '' : 's'} with access to this diagram.
              </DialogDescription>
            </DialogHeader>
            <WorkspaceMembersPanel
              toolId={toolId}
              onManageAccess={handleManageAccess}
              embedded
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
})
