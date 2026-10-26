import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, RefreshCw } from 'lucide-react'
import type { Diagram } from '@/components/designer/diagram-types'
import { findOrchestrations } from '@/components/agent-workflow/orchestration-patterns'
import { listAgentNodes } from '@/components/agent-workflow/tool-agent-mapping'
import { fetchMonitoredWorkflows, type MonitoredWorkflow } from '@/services/activity-api'
import { cn } from '@/utils/cn'

const DAYS = 7
// Blues from light to deep, for the agent donut
const DONUT = ['hsl(var(--primary))', 'hsl(var(--info))', 'hsl(20 85% 30%)', 'hsl(var(--primary) / 0.45)', 'hsl(var(--muted-foreground) / 0.5)']

/** 12.3k / 1.2M style numbers, as the reference's KPI. */
function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(value)
}

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`
  return `${Math.round(minutes / 1440)}d ago`
}

/** A card as in the reference: thin border, a grip and a bold title, then compact content. */
function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      <h3 className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-foreground">
        <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Small spaced caps, the reference's label style. */
const Caps = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn('text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground', className)}>{children}</span>
)

interface Recommendation {
  level: 'high' | 'medium' | 'low'
  area: string
  text: string
}

/** What to fix, worked out from the canvas and the runs. */
function recommendations(diagram: Diagram, workflow: MonitoredWorkflow | undefined): Recommendation[] {
  const items: Recommendation[] = []
  const agents = listAgentNodes(diagram).filter((node) => node.agent && node.agent.agentType !== 'tool')
  for (const node of agents) {
    const agent = node.agent!
    if (!agent.modelConnectionId && !agent.model) items.push({ level: 'high', area: 'Model', text: `${node.label} has no model` })
    if (!agent.instructions?.trim()) items.push({ level: 'high', area: 'Prompt', text: `${node.label} has no instructions` })
  }
  for (const orchestration of findOrchestrations(diagram)) {
    if (orchestration.participantIds.length === 0) {
      const label = diagram.nodes.find((node) => node.id === orchestration.orchestratorId)?.label ?? 'Orchestrator'
      items.push({ level: 'high', area: 'Team', text: `${label} has no team connected` })
    }
  }
  if (workflow && workflow.runs.failed > 0) {
    const share = Math.round((workflow.runs.failed / Math.max(workflow.runs.total, 1)) * 100)
    items.push({ level: share >= 25 ? 'high' : 'medium', area: 'Reliability', text: `${workflow.runs.failed} of ${workflow.runs.total} runs failed (${share}%)` })
  }
  if (workflow && workflow.runs.avgDurationMs && workflow.runs.avgDurationMs > 120_000) {
    items.push({ level: 'medium', area: 'Speed', text: `Runs take ${Math.round(workflow.runs.avgDurationMs / 1000)}s on average` })
  }
  const unused = (workflow?.agents ?? []).filter((agent) => agent.calls === 0)
  if (workflow && workflow.runs.total > 0 && unused.length > 0) {
    items.push({ level: 'low', area: 'Design', text: `${unused.length} agent${unused.length === 1 ? '' : 's'} never called` })
  }
  return items
}

/**
 * The workflow's insights, beside the canvas when nothing is selected: runs, agent activity,
 * tokens and what to fix, over the last week. Laid out after the reference's Insights panel.
 */
export function WorkflowInsightsPanel({ workflowId, name, diagram }: { workflowId: string; name: string; diagram: Diagram }) {
  const [workflow, setWorkflow] = useState<MonitoredWorkflow | undefined>()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    setState('loading')
    fetchMonitoredWorkflows(DAYS)
      .then((rows) => {
        if (!live) return
        setWorkflow(rows.find((row) => row.workflowId === workflowId))
        setState('ready')
      })
      .catch(() => live && setState('error'))
    return () => {
      live = false
    }
  }, [workflowId, reload])

  const todo = useMemo(() => recommendations(diagram, workflow), [diagram, workflow])
  const runs = workflow?.runs
  const agents = [...(workflow?.agents ?? [])].sort((a, b) => b.calls - a.calls)
  const maxCalls = Math.max(1, ...agents.map((agent) => agent.calls))
  const tokens = runs?.totalTokens ?? 0
  const successRate = runs && runs.total > 0 ? Math.round((runs.succeeded / runs.total) * 100) : null
  const counts = { high: 0, medium: 0, low: 0 }
  for (const item of todo) counts[item.level] += 1

  // Donut: the top agents by tokens, the rest together
  const byTokens = [...agents].sort((a, b) => b.totalTokens - a.totalTokens)
  const slices = [...byTokens.slice(0, 4), ...(byTokens.length > 4 ? [{ name: 'Other', totalTokens: byTokens.slice(4).reduce((sum, a) => sum + a.totalTokens, 0) }] : [])]
  const sliceTotal = slices.reduce((sum, slice) => sum + slice.totalTokens, 0)
  let offset = 0

  return (
    <div className="space-y-3 px-3 py-3 text-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{name}</p>
          <p className="mt-0.5 flex items-center gap-1.5">
            <Caps>Insights (last {DAYS} days)</Caps>
            {todo.length > 0 ? (
              <span className="rounded-[2px] bg-primary px-1 text-[9px] font-bold uppercase leading-[14px] text-primary-foreground">{todo.length} new</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReload((value) => value + 1)}
          className="flex h-6 w-6 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Refresh"
          aria-label="Refresh insights"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', state === 'loading' && 'animate-spin')} />
        </button>
      </div>

      {state === 'error' ? (
        <p className="text-[11.5px] text-destructive">Couldn't load activity. The checks below still apply.</p>
      ) : null}

      <Card title="Runs">
        {runs && runs.total > 0 ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Total', runs.total, ''],
                ['Succeeded', runs.succeeded, 'text-[hsl(var(--success))]'],
                ['Failed', runs.failed, runs.failed > 0 ? 'text-destructive' : ''],
              ].map(([label, value, tone]) => (
                <div key={label as string}>
                  <Caps>{label}</Caps>
                  <p className={cn('text-[18px] font-light leading-tight', tone as string)}>{value}</p>
                </div>
              ))}
            </div>
            <div>
              <Caps>Last run</Caps>
              <p className="text-[11.5px] text-primary">{ago(runs.lastRun)}</p>
            </div>
            {runs.lastError ? (
              <div>
                <Caps>Last error</Caps>
                <p className="line-clamp-2 text-[11.5px] text-primary" title={runs.lastError}>
                  {runs.lastError}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">{state === 'loading' ? 'Loading…' : 'No runs in the last week. Save the workflow and run it to see activity here.'}</p>
        )}
      </Card>

      <Card title="Agent activity">
        {agents.length > 0 ? (
          <ul className="space-y-1.5">
            {agents.slice(0, 8).map((agent) => (
              <li key={agent.id} className="grid grid-cols-[1fr_auto_64px] items-center gap-2 text-[11.5px]">
                <span className="truncate">{agent.name}</span>
                <span className="w-8 text-right tabular-nums text-muted-foreground">{agent.calls}</span>
                <span className="h-[3px] rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (agent.calls / maxCalls) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">No model calls yet.</p>
        )}
      </Card>

      <Card title="Tokens">
        <div className="flex items-start gap-4">
          <div>
            <p className="text-[34px] font-extralight leading-none tracking-tight">{compact(tokens)}</p>
            <Caps className="mt-1 block">Total tokens</Caps>
          </div>
          <dl className="ml-auto space-y-1 text-right">
            {[
              ['Runs', runs ? String(runs.total) : '0'],
              ['Avg time', runs?.avgDurationMs ? `${(runs.avgDurationMs / 1000).toFixed(1)}s` : '—'],
              ['Success', successRate === null ? '—' : `${successRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-end gap-2">
                <Caps>{label}</Caps>
                <span className="w-12 text-[11.5px] font-semibold tabular-nums">
                  {label === 'Success' && successRate !== null ? (
                    <span className={successRate >= 90 ? 'text-[hsl(var(--success))]' : 'text-destructive'}>
                      {successRate >= 90 ? <ArrowUp className="mr-0.5 inline h-3 w-3" /> : <ArrowDown className="mr-0.5 inline h-3 w-3" />}
                      {value}
                    </span>
                  ) : (
                    value
                  )}
                </span>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      <Card title="Tokens by agent">
        {sliceTotal > 0 ? (
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 42 42" className="h-[76px] w-[76px] shrink-0 -rotate-90" aria-hidden>
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
              {slices.map((slice, index) => {
                const share = (slice.totalTokens / sliceTotal) * 100
                const arc = (
                  <circle
                    key={slice.name}
                    cx="21"
                    cy="21"
                    r="15.9"
                    fill="none"
                    stroke={DONUT[index % DONUT.length]}
                    strokeWidth="6"
                    strokeDasharray={`${share} ${100 - share}`}
                    strokeDashoffset={-offset}
                    pathLength={100}
                  />
                )
                offset += share
                return arc
              })}
            </svg>
            <ul className="min-w-0 space-y-1">
              {slices.map((slice, index) => (
                <li key={slice.name} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2.5 w-[3px] shrink-0 rounded-sm" style={{ background: DONUT[index % DONUT.length] }} />
                  <span className="font-semibold tabular-nums">{compact(slice.totalTokens)}</span>
                  <span className="truncate text-muted-foreground">{slice.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">No tokens used yet.</p>
        )}
      </Card>

      <Card title="Recommendations">
        <div className="mb-2 flex gap-3">
          {(['high', 'medium', 'low'] as const).map((level) => (
            <Caps key={level} className="flex items-center gap-1">
              <span className={cn('h-2.5 w-[3px] rounded-sm', level === 'high' ? 'bg-destructive' : level === 'medium' ? 'bg-[hsl(var(--warning))]' : 'bg-primary')} />
              {level} {counts[level]}
            </Caps>
          ))}
        </div>
        {todo.length > 0 ? (
          <ul className="space-y-1">
            {todo.map((item, index) => (
              <li key={index} className="grid grid-cols-[76px_1fr] gap-2 text-[11.5px]">
                <span className="text-muted-foreground">{item.area}</span>
                <span className="flex items-start gap-1.5">
                  <span className={cn('mt-1 h-2 w-[3px] shrink-0 rounded-sm', item.level === 'high' ? 'bg-destructive' : item.level === 'medium' ? 'bg-[hsl(var(--warning))]' : 'bg-primary')} />
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11.5px] text-muted-foreground">Nothing to fix. Every agent has a model and instructions.</p>
        )}
      </Card>
    </div>
  )
}
