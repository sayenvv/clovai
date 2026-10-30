import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NeedsAdmin } from './api'
import { PERIODS, UsageBar } from './CreditsPage'
import { SOURCE_LABELS, addCredits, formatTokens, usageTone, userCredits, type UserCreditDetail } from './credits'
import { SignIn } from './SignIn'

// The smallest top-up an admin can add, as the API allows
const MIN_CREDITS = 100

/** One user's credits: their allowance (and adding to it), tokens per day, by source, by workflow, recent runs. */
export function CreditUserPage() {
  const { userId = '' } = useParams()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<UserCreditDetail | null>(null)
  const [error, setError] = useState('')
  const [needsAdmin, setNeedsAdmin] = useState(false)
  const [amount, setAmount] = useState('')
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    setError('')
    userCredits(userId, days)
      .then((detail) => {
        setData(detail)
        setNeedsAdmin(false)
      })
      .catch((reason: unknown) => {
        if (reason instanceof NeedsAdmin) setNeedsAdmin(true)
        else setError(reason instanceof Error ? reason.message : 'Could not load this user.')
      })
  }, [userId, days])

  useEffect(load, [load])

  async function add() {
    const tokens = Math.round(Number(amount))
    if (!Number.isFinite(tokens) || tokens < MIN_CREDITS) return
    setAdding(true)
    setNotice('')
    try {
      const updated = await addCredits(userId, tokens)
      setData((previous) => (previous ? { ...previous, ...updated } : previous))
      setAmount('')
      setNotice(`Added ${formatTokens(tokens)} tokens. The new allowance is ${formatTokens(updated.tokenLimit)}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add credits.')
    } finally {
      setAdding(false)
    }
  }

  if (needsAdmin) return <SignIn onSignedIn={load} />
  if (!data) return error ? <p className="error">{error}</p> : <p className="meta">Loading…</p>

  const tone = usageTone(data)
  const peak = Math.max(1, ...data.daily.map((day) => day.tokens))
  const periodTotal = data.sources.reduce((sum, source) => sum + source.tokens, 0)

  return (
    <>
      <p className="meta">
        <Link to="/credits">← Credit usage</Link>
      </p>
      <h1>{data.fullName || data.email || data.userId}</h1>
      <p className="meta">
        {data.email || data.userId}
        {data.accessRole === 'admin' ? ' · Admin' : ''}
      </p>

      <section className="panel">
        <h2>Allowance</h2>
        <UsageBar percent={data.percentUsed} tone={tone} />
        <p className={`usage-text ${tone}`}>
          {formatTokens(data.tokensUsed)} of {formatTokens(data.tokenLimit)} used · {data.percentUsed}% ·{' '}
          {data.tokensRemaining > 0 ? `${formatTokens(data.tokensRemaining)} left` : 'no tokens left: runs are paused'}
        </p>
        <form
          className="toolbar"
          onSubmit={(event) => {
            event.preventDefault()
            void add()
          }}
        >
          <input
            type="number"
            min={MIN_CREDITS}
            step={1}
            aria-label="Tokens to add"
            placeholder="Tokens to add, from 100"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <button type="submit" disabled={adding || !(Number(amount) >= MIN_CREDITS)}>
            {adding ? 'Adding…' : 'Add credits'}
          </button>
        </form>
        {notice ? <p className="status">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <div className="toolbar">
        <select aria-label="Period" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {PERIODS.map((value) => (
            <option key={value} value={value}>
              Last {value} days
            </option>
          ))}
        </select>
        <span className="meta">{formatTokens(periodTotal)} tokens in this period</span>
      </div>

      <section className="panel">
        <h2>Tokens per day</h2>
        {data.daily.length ? (
          <div className="daily" aria-label="Tokens per day">
            {data.daily.map((day) => (
              <div key={day.date} className="daily-bar" title={`${day.date}: ${day.tokens.toLocaleString()} tokens, ${day.calls} calls`}>
                <span style={{ height: `${Math.max(2, (day.tokens / peak) * 100)}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <p className="meta">No usage in this period.</p>
        )}
      </section>

      <div className="columns">
        <section className="panel">
          <h2>By source</h2>
          <table className="variables">
            <tbody>
              {data.sources.map((source) => (
                <tr key={source.source}>
                  <td>{SOURCE_LABELS[source.source] ?? source.source}</td>
                  <td>{formatTokens(source.tokens)}</td>
                  <td className="meta">{periodTotal ? Math.round((source.tokens / periodTotal) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2>Top workflows</h2>
          <table className="variables">
            <tbody>
              {data.workflows.map((workflow) => (
                <tr key={`${workflow.workflowId}-${workflow.workflow}`}>
                  <td>{workflow.workflow}</td>
                  <td>{formatTokens(workflow.tokens)}</td>
                  <td className="meta">{workflow.runs} runs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h2>Recent runs</h2>
        <table className="variables">
          <thead>
            <tr>
              <th>When</th>
              <th>Workflow</th>
              <th>Source</th>
              <th>Tokens</th>
              <th>Model calls</th>
            </tr>
          </thead>
          <tbody>
            {data.recentRuns.map((run) => (
              <tr key={`${run.runId}-${run.source}`}>
                <td>{new Date(run.at).toLocaleString()}</td>
                <td>{run.workflow || '—'}</td>
                <td>{SOURCE_LABELS[run.source] ?? run.source}</td>
                <td>{formatTokens(run.tokens)}</td>
                <td>{run.calls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
