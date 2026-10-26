import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { currentAccount, signIn, signOut, SIGNED_OUT_EVENT, type AdminAccount } from '@/api/auth'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { APP_NAME, APP_TITLE } from '@/constants'

interface AdminAuth {
  account: AdminAccount
  signOut: () => void
}

const AdminAuthContext = createContext<AdminAuth | null>(null)

/** The signed-in admin. Only used inside `AdminAuthGate`, which renders nothing else before sign-in. */
export function useAdminAuth(): AdminAuth {
  const auth = useContext(AdminAuthContext)
  if (!auth) throw new Error('useAdminAuth is used outside AdminAuthGate')
  return auth
}

/**
 * Shows the sign-in screen until an admin is signed in, then the Admin Center. A non-admin
 * account is turned away, and an expired session returns here.
 */
export function AdminAuthGate({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AdminAccount | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let live = true
    currentAccount()
      .then((found) => live && setAccount(found?.accessRole === 'admin' ? found : null))
      .finally(() => live && setChecking(false))
    const onSignedOut = () => setAccount(null)
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => {
      live = false
      window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
    }
  }, [])

  const handleSignOut = useCallback(() => signOut(), [])

  if (checking) {
    return <div className="flex h-screen items-center justify-center bg-background text-[12px] text-muted-foreground">Loading…</div>
  }
  if (!account) return <SignInScreen onSignedIn={setAccount} />
  return <AdminAuthContext.Provider value={{ account, signOut: handleSignOut }}>{children}</AdminAuthContext.Provider>
}

function SignInScreen({ onSignedIn }: { onSignedIn: (account: AdminAccount) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      onSignedIn(await signIn(email, password))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <Logo size={LOGO_SIZE_WORKSPACE} rounded="md" />
          <div>
            <p className="text-[15px] font-semibold tracking-tight">{APP_TITLE}</p>
            <p className="text-[11px] text-muted-foreground">Sign in with your {APP_NAME} admin account</p>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="admin-email" className="text-[11.5px]">Email</Label>
            <Input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-password" className="text-[11.5px]">Password</Label>
            <Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">{error}</p>
          )}
          <Button type="submit" className="mt-1 h-9 gap-1.5 text-[12px] font-semibold" disabled={busy}>
            <Lock className="h-3.5 w-3.5" />
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </div>
  )
}
