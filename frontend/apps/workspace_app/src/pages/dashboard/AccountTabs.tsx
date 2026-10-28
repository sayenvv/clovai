import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Loader2, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/components/agent-workflow/FormField'
import { PageIntro, SettingsCard } from '@/components/agent-workflow/dashboard/dashboard-ui'
import { ROUTES } from '@/constants'
import { useSession } from '@/hooks/use-session'
import { useTheme } from '@/hooks/use-theme'
import { useAutoSave } from '@/hooks/use-auto-save'
import { Switch } from '@/components/ui/switch'
import { AccountUnavailableError, deleteAccount, renameWorkspace, updateProfile } from '@/services/account-api'
import { PROJECT_ROLES, changeAccountPassword, logout, type ProjectRole } from '@/services/project-auth-store'
import { cn } from '@/utils/cn'

function failure(reason: unknown, fallback: string) {
  if (reason instanceof AccountUnavailableError) toast.message(reason.message)
  else toast.error(reason instanceof Error ? reason.message : fallback)
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U'
  )
}

/** Name, role and email. */
export function ProfileTab() {
  const session = useSession()
  const [fullName, setFullName] = useState(session?.fullName ?? '')
  const [role, setRole] = useState<ProjectRole>(session?.role ?? 'developer')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFullName(session?.fullName ?? '')
    setRole(session?.role ?? 'developer')
  }, [session?.fullName, session?.role])

  if (!session) return null
  const dirty = fullName.trim() !== session.fullName || role !== session.role

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile({ fullName: fullName.trim(), role })
      toast.success('Profile saved')
    } catch (reason) {
      failure(reason, 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageIntro eyebrow="Account" title="Profile" description="How you appear across your workspace." />

      <SettingsCard
        title="Your details"
        description="Your name is shown on workflows you create and on shared models and variables."
        footer={
          <>
            <p className="text-[11.5px] text-muted-foreground">Your email is your sign-in and can’t be changed here.</p>
            <Button type="button" size="sm" disabled={!dirty || !fullName.trim() || saving} onClick={() => void save()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
            {initialsOf(fullName || session.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">{fullName || session.email}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{session.email}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(event) => setRole(event.target.value as ProjectRole)}>
              {PROJECT_ROLES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Email">
          <Input value={session.email} readOnly disabled />
        </Field>
      </SettingsCard>
    </div>
  )
}

/** Workspace name, type and id. */
export function WorkspaceTab() {
  const session = useSession()
  const [name, setName] = useState(session?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => setName(session?.displayName ?? ''), [session?.displayName])

  if (!session) return null

  const save = async () => {
    setSaving(true)
    try {
      await renameWorkspace(session.workspaceId, name.trim())
      toast.success('Workspace renamed')
    } catch (reason) {
      failure(reason, 'Could not rename the workspace.')
    } finally {
      setSaving(false)
    }
  }

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(session.workspaceId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy to the clipboard.')
    }
  }

  return (
    <div className="space-y-5">
      <PageIntro eyebrow="Account" title="Workspace" description="The workspace your workflows, agents and runs live in." />

      <SettingsCard
        title="Workspace name"
        description="Shown in the editor and on everything shared with your workspace."
        footer={
          <>
            <p className="text-[11.5px] text-muted-foreground">Up to 48 characters.</p>
            <Button
              type="button"
              size="sm"
              disabled={!name.trim() || name.trim() === session.displayName || saving}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </Button>
          </>
        }
      >
        <Field label="Name">
          <Input value={name} maxLength={48} onChange={(event) => setName(event.target.value)} />
        </Field>
      </SettingsCard>

      <SettingsCard title="Details" description="Use the workspace ID when talking to support or calling the API.">
        <dl className="divide-y divide-border/70 rounded-[3px] border border-border/70">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-[12px] text-muted-foreground">Type</dt>
            <dd className="text-[12.5px] font-medium text-foreground">
              {session.accountType === 'company' ? 'Team workspace' : 'Personal workspace'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-[12px] text-muted-foreground">Workspace ID</dt>
            <dd className="flex min-w-0 items-center gap-1.5">
              <code className="truncate font-mono text-[12px] text-foreground">{session.workspaceId}</code>
              <button
                type="button"
                onClick={() => void copyId()}
                aria-label="Copy workspace ID"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              </button>
            </dd>
          </div>
        </dl>
      </SettingsCard>
    </div>
  )
}

/** Light or dark, shared with the editor. */
export function AppearanceTab() {
  const { theme, toggleTheme } = useTheme()
  const [autoSave, setAutoSave] = useAutoSave()
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ] as const

  return (
    <div className="space-y-5">
      <PageIntro eyebrow="Preferences" title="Appearance" description="How the dashboard and the editor look and behave on this device." />

      <SettingsCard title="Theme" description="Applies to the dashboard and the editor alike.">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
          {options.map(({ value, label, icon: Icon }) => {
            const active = theme === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => (active ? undefined : toggleTheme())}
                className={cn(
                  'group overflow-hidden rounded-[3px] border text-left transition-shadow',
                  active ? 'border-foreground/60 ring-2 ring-foreground/15' : 'border-border/70 hover:border-foreground/30',
                )}
              >
                {/* A miniature workspace in that theme. */}
                <span className={cn('flex h-24 gap-1.5 p-2', value === 'dark' ? 'bg-[#0f0f0f]' : 'bg-[#efeff1]')}>
                  <span className={cn('w-5 rounded-md', value === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white')} />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <span className={cn('h-3 rounded', value === 'dark' ? 'bg-[#1a1a1a]' : 'bg-white')} />
                    <span className={cn('flex-1 rounded-md', value === 'dark' ? 'bg-[#171717]' : 'bg-white')} />
                  </span>
                </span>
                <span className="flex items-center gap-2 border-t border-border/70 bg-card px-3 py-2">
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 text-[12.5px] font-medium text-foreground">{label}</span>
                  {active ? <Check className="size-3.5 text-foreground" /> : null}
                </span>
              </button>
            )
          })}
        </div>
        <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Monitor className="size-3.5" />
          Saved in this browser.
        </p>
      </SettingsCard>

      <SettingsCard title="Editor" description="How the workflow editor keeps your work.">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-[12.5px] font-medium text-foreground">Auto-save</span>
            <span className="block text-[11.5px] text-muted-foreground">
              Save the open workflow a couple of seconds after each change, without pressing Save.
            </span>
          </span>
          <Switch checked={autoSave} onCheckedChange={setAutoSave} aria-label="Auto-save" />
        </label>
      </SettingsCard>
    </div>
  )
}

/** Password, sign out and account deletion. */
export function SecurityTab() {
  const session = useSession()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (!session) return null

  const changePassword = async () => {
    setSaving(true)
    const result = await changeAccountPassword(currentPassword, password, confirm)
    setSaving(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setCurrentPassword('')
    setPassword('')
    setConfirm('')
    toast.success('Password changed')
  }

  const signOut = () => {
    logout()
    navigate(ROUTES.home)
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
      navigate(ROUTES.home)
    } catch (reason) {
      failure(reason, 'Could not delete your account.')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageIntro eyebrow="Account" title="Security" description="Your password and the sessions signed in to your account." />

      <SettingsCard
        title="Password"
        description="Use at least 8 characters. You stay signed in on this device. Signed up with Google and never set one? Leave the current password empty."
        footer={
          <>
            <p className="text-[11.5px] text-muted-foreground">
              {confirm && password !== confirm ? 'Passwords don’t match.' : 'Signed in as ' + session.email}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={password.length < 8 || password !== confirm || saving}
              onClick={() => void changePassword()}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Change password
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password">
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <span className="hidden sm:block" />
          <Field label="New password">
            <Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field label="Confirm password">
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Sign out"
        description="End your session in this browser. Your workflows stay saved."
        footer={
          <>
            <span />
            <Button type="button" size="sm" variant="outline" onClick={signOut}>
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </>
        }
      />

      <SettingsCard
        tone="danger"
        title="Delete account"
        description="Permanently delete your account, your workspace and everything in it, including saved models and variables. This can’t be undone."
        footer={
          <>
            <p className="text-[11.5px] text-muted-foreground">Type your email to confirm.</p>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={confirmEmail.trim().toLowerCase() !== session.email.toLowerCase() || deleting}
              onClick={() => void remove()}
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Delete account
            </Button>
          </>
        }
      >
        <Field label="Email">
          <Input value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} placeholder={session.email} />
        </Field>
      </SettingsCard>
    </div>
  )
}
