import { memo, useCallback, useMemo, useState } from 'react'
import { Check, Link2, Mail, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCopyToClipboard } from '@/hooks/use-clipboard'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { cn } from '@/utils/cn'
import {
  isValidEmail,
  memberInitials,
  useShareSettings,
  type LinkAccess,
  type MemberRole,
  type ShareMember,
} from './share-settings'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentTitle: string
  toolId: string
}

/** Share link, collaboration toggles, and member invites for a diagram workspace. */
export const ShareDialog = memo(function ShareDialog({
  open,
  onOpenChange,
  documentTitle,
  toolId,
}: ShareDialogProps) {
  const { copied, copy } = useCopyToClipboard()
  const { settings, updateSettings } = useShareSettings(toolId)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Exclude<MemberRole, 'owner'>>('editor')

  const shareUrl = useMemo(
    () => (typeof window !== 'undefined' ? window.location.href : ''),
    [open],
  )

  const handleCopyLink = useCallback(() => {
    void copy(shareUrl, 'Link copied to clipboard')
  }, [copy, shareUrl])

  const handleInvite = useCallback(() => {
    const email = inviteEmail.trim().toLowerCase()
    if (!isValidEmail(email)) {
      toast.error('Enter a valid email address')
      return
    }
    if (settings.members.some((member) => member.email === email)) {
      toast.error('This person is already invited')
      return
    }

    const member: ShareMember = {
      id: `member-${Date.now()}`,
      email,
      role: inviteRole,
    }
    updateSettings({ members: [...settings.members, member] })
    setInviteEmail('')
    toast.success(`Invitation sent to ${email}`)
  }, [inviteEmail, inviteRole, settings.members, updateSettings])

  const updateMemberRole = useCallback(
    (memberId: string, role: MemberRole) => {
      updateSettings({
        members: settings.members.map((member) =>
          member.id === memberId ? { ...member, role } : member,
        ),
      })
    },
    [settings.members, updateSettings],
  )

  const removeMember = useCallback(
    (memberId: string) => {
      updateSettings({ members: settings.members.filter((member) => member.id !== memberId) })
      toast.success('Member removed')
    },
    [settings.members, updateSettings],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:rounded-xl">
        <DialogHeader className="space-y-1 border-b px-6 py-4">
          <DialogTitle>Share & collaborate</DialogTitle>
          <DialogDescription>
            Invite teammates and control access to <span className="font-medium">{documentTitle}</span>.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="share" className="px-6 pb-6 pt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="share">
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Share
            </TabsTrigger>
            <TabsTrigger value="collab">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Collaborate
            </TabsTrigger>
            <TabsTrigger value="invite">
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Invite
            </TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-link">Share link</Label>
              <div className="flex gap-2">
                <Input id="share-link" readOnly value={shareUrl} className="font-mono text-xs" />
                <Button type="button" variant="outline" className="shrink-0" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="link-access">Anyone with the link</Label>
              <Select
                id="link-access"
                value={settings.linkAccess}
                onChange={(event) =>
                  updateSettings({ linkAccess: event.target.value as LinkAccess })
                }
              >
                <option value="restricted">Restricted — only invited members</option>
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </Select>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Link sharing is saved locally for now. Cloud sync and permission enforcement will
              arrive with team workspaces.
            </p>
          </TabsContent>

          <TabsContent value="collab" className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="live-collab">Live collaboration</Label>
                <p className="text-xs text-muted-foreground">
                  Let invited editors work on this diagram at the same time.
                </p>
              </div>
              <Switch
                id="live-collab"
                checked={settings.liveCollab}
                onCheckedChange={(checked) => updateSettings({ liveCollab: checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="show-cursors">Show live cursors</Label>
                <p className="text-xs text-muted-foreground">
                  Display who is viewing or editing each page.
                </p>
              </div>
              <Switch
                id="show-cursors"
                checked={settings.showCursors}
                disabled={!settings.liveCollab}
                onCheckedChange={(checked) => updateSettings({ showCursors: checked })}
              />
            </div>

            <div
              className={cn(
                'rounded-lg border border-dashed px-3 py-3 text-xs leading-relaxed text-muted-foreground',
                settings.liveCollab && 'border-primary/30 bg-primary/5 text-foreground/80',
              )}
            >
              {settings.liveCollab
                ? 'Collaboration mode is on. Real-time sync will connect once team workspaces launch.'
                : 'Turn on live collaboration to prepare this diagram for multi-user editing.'}
            </div>
          </TabsContent>

          <TabsContent value="invite" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Invite by email</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="name@company.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleInvite()
                  }}
                />
                <Select
                  aria-label="Invite role"
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(event.target.value as Exclude<MemberRole, 'owner'>)
                  }
                  className="w-28 shrink-0"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Button type="button" className="shrink-0" onClick={handleInvite}>
                  <Mail className="h-4 w-4" />
                  Invite
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>People with access</Label>
              <ul className="divide-y rounded-lg border">
                <li className="flex items-center gap-3 px-3 py-2.5">
                  <UserAvatar seed="you" initials="Y" name="You" size="md" ringClassName="ring-1 ring-border" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">You</p>
                    <p className="truncate text-xs text-muted-foreground">Owner</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Owner</span>
                </li>

                {settings.members.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                    <UserAvatar
                      seed={member.email}
                      initials={memberInitials(member.email)}
                      name={member.email}
                      size="md"
                      ringClassName="ring-1 ring-border"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.email}</p>
                      <p className="truncate text-xs capitalize text-muted-foreground">
                        {member.role}
                      </p>
                    </div>
                    <Select
                      aria-label={`Role for ${member.email}`}
                      value={member.role}
                      onChange={(event) =>
                        updateMemberRole(member.id, event.target.value as MemberRole)
                      }
                      className="w-24 shrink-0"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${member.email}`}
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}

                {settings.members.length === 0 && (
                  <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No collaborators yet — invite someone by email above.
                  </li>
                )}
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
})
