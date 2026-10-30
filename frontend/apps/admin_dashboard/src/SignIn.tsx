import { useState } from 'react'
import { signIn } from './auth'

/** Shown where a page needs an admin: sign in with an admin account of the API. */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
      onSignedIn()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="panel signin"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h2>Admin sign-in</h2>
      <p className="meta">Credit usage is for admins. Sign in with an admin account.</p>
      <label className="field">
        Email
        <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label className="field">
        Password
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <div className="toolbar">
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
