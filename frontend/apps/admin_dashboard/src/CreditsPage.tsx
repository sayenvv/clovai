import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NeedsAdmin } from './api'
import { creditsOverview, formatTokens, usageTone, type CreditsOverview } from './credits'
import { SignIn } from './SignIn'

export const PERIODS = [7, 30, 90]

export function UsageBar({ percent, tone }: { percent: number; tone: 'ok' | 'warn' | 'over' }) {
  return (
    <div className="usage-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span className={`usage-fill ${tone}`} style={{ width: `${Math.min(100, Math.max(percent > 0 ? 2 : 0, percent))}%` }} />
    </div>
  )
}

function lastActive(at: string | null): string {
  if (!at) return '—'
  const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60000)
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`
  return new Date(at).toLocaleDateString()
}

/** Credits: every user's token allowance, how much of it they used, and what they spent in the period. */
export function CreditsPage() {
  const [days, setDays] = useState(30)
  const [query, setQuery] = useState('')
  const [data, setData] = useState<CreditsOverview | null>(null)
  const [error, setError] = useState('')
  const [needsAdmin, setNeedsAdmin] = useState(false)

  const load = useCallback(() => {
    setError('')
    creditsOverview(days, query)
      .then((overview) => {
        setData(overview)
        setNeedsAdmin(false)
      })
      .catch((reason: unknown) => {
        if (reason instanceof NeedsAdmin) setNeedsAdmin(true)
        else setError(reason instanceof Error ? reason.message : 'Could not load credit usage.')
      })
  }, [days, query])

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, query])

  if (needsAdmin) return <SignIn onSignedIn={load} />

  return (
    <>
      <h1>Credit usage</h1>
      <p className="meta">Each user's token allowance, how much of it is used, and what they spent in the period.</p>

      <div className="toolbar">
        <input aria-label="Search users" placeholder="Search by email or name" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Period" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              Last {value} days
            </option>
          ))}
        </select>
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      {data ? (
        <>
          <div className="stats">
            <div className="stat">
              <span>Users</span>
              <strong>{data.summary.users}</strong>
            </div>
            <div className="stat">
              <span>Tokens, last {data.days} days</span>
              <strong>{formatTokens(data.summary.periodTokens)}</strong>
            </div>
            <div className="stat warn">
              <span>At 90% or more</span>
              <strong>{data.summary.nearLimit}</strong>
            </div>
            <div className="stat over">
              <span>Out of tokens</span>
              <strong>{data.summary.exhausted}</strong>
            </div>
          </div>

          <table className="variables credits">
            <thead>
              <tr>
                <th>User</th>
                <th>Allowance used</th>
                <th>Left</th>
                <th>Tokens ({data.days}d)</th>
                <th>Runs</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => {
                const tone = usageTone(user)
                return (
                  <tr key={user.userId}>
                    <td>
                      <Link to={`/credits/${encodeURIComponent(user.userId)}`} className="user-link">
                        <strong>{user.fullName || user.email || user.userId}</strong>
                        <span>
                          {user.email || user.userId}
                          {user.accessRole === 'admin' ? ' · Admin' : ''}
                        </span>
                      </Link>
                    </td>
                    <td className="usage-cell">
                      <UsageBar percent={user.percentUsed} tone={tone} />
                      <span className={`usage-text ${tone}`}>
                        {formatTokens(user.tokensUsed)} of {formatTokens(user.tokenLimit)} · {user.percentUsed}%
                      </span>
                    </td>
                    <td className={tone === 'over' ? 'over-text' : ''}>{user.tokenLimit ? formatTokens(user.tokensRemaining) : '—'}</td>
                    <td>{formatTokens(user.periodTokens)}</td>
                    <td>{user.periodRuns}</td>
                    <td>{lastActive(user.lastUsedAt)}</td>
                  </tr>
                )
              })}
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="meta">
                    No users match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      ) : !error ? (
        <p className="meta">Loading…</p>
      ) : null}
    </>
  )
}
