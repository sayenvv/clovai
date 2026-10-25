import { memo, useMemo } from 'react'
import { ArrowRight, GitFork, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { defaultConnectorConfig } from '@/components/agent-workflow/agent-workflow-defaults'
import { listExecutorNodes, parseCondition } from '@/components/agent-workflow/workflow-edge-groups'
import {
  createNodeId,
  facingPortSides,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
} from '@/components/designer/diagram-types'
import type { EdgeCondition } from '@/types/workflow-build-spec'

/**
 * A Switch routes one agent's output to exactly one next node. It has no model or instructions:
 * its cases live on its outgoing connectors (`connector.condition`, checked in `executionOrder`),
 * and the one connector without a condition is the default. `workflow-edge-groups.ts` turns them
 * into Agent Framework's `add_switch_case_edge_group`.
 */

type Op = NonNullable<EdgeCondition['op']>

const OPERATORS: Array<{ op: Op; symbol: string; label: string }> = [
  { op: 'equals', symbol: '==', label: 'is' },
  { op: 'not_equals', symbol: '!=', label: 'is not' },
  { op: 'contains', symbol: 'contains', label: 'contains' },
  { op: 'gt', symbol: '>', label: '>' },
  { op: 'gte', symbol: '>=', label: '≥' },
  { op: 'lt', symbol: '<', label: '<' },
  { op: 'lte', symbol: '<=', label: '≤' },
]

const NUMERIC_OPS = new Set<Op>(['gt', 'gte', 'lt', 'lte'])

interface SwitchCase {
  edge: DiagramEdge
  op: Op
  value: string
}

/** The condition string the connector stores, e.g. `text contains "refund"` or `score >= 0.8`. */
function writeCondition(field: string, op: Op, value: string): string {
  const symbol = OPERATORS.find((item) => item.op === op)?.symbol ?? '=='
  const number = Number(value)
  const literal = NUMERIC_OPS.has(op) && value.trim() !== '' && Number.isFinite(number) ? String(number) : JSON.stringify(value)
  return `${field || 'text'} ${symbol} ${literal}`
}

function readCase(edge: DiagramEdge): SwitchCase & { field: string } {
  const parsed = parseCondition(edge.connector?.condition ?? '')
  const op = parsed?.op && parsed.op !== 'exists' && parsed.op !== 'in' ? parsed.op : 'equals'
  const value = parsed?.value === undefined ? '' : Array.isArray(parsed.value) ? parsed.value.join(', ') : String(parsed.value)
  return { edge, op, value, field: parsed?.field ?? 'text' }
}

function newEdge(diagram: Diagram, from: string, to: string, condition: string, executionOrder: number): DiagramEdge {
  const fromNode = diagram.nodes.find((node) => node.id === from)
  const toNode = diagram.nodes.find((node) => node.id === to)
  const sides = fromNode && toNode ? facingPortSides(fromNode, 'process', toNode, 'process') : { fromSide: 'right' as const, toSide: 'left' as const }
  return {
    id: `edge-${createNodeId()}`,
    from,
    to,
    ...sides,
    routing: 'curved',
    connector: { ...defaultConnectorConfig(), condition, executionOrder },
  }
}

const byOrder = (a: DiagramEdge, b: DiagramEdge) =>
  (a.connector?.executionOrder ?? 0) - (b.connector?.executionOrder ?? 0)

export const SwitchConfigPanel = memo(function SwitchConfigPanel({
  node,
  diagram,
  onChange,
}: {
  node: DiagramNode
  diagram: Diagram
  onChange: (updater: (previous: Diagram) => Diagram) => void
}) {
  const agents = useMemo(() => listExecutorNodes(diagram), [diagram])
  const input = diagram.edges.find((edge) => edge.to === node.id)
  const outgoing = diagram.edges.filter((edge) => edge.from === node.id).sort(byOrder)
  const cases = outgoing.filter((edge) => edge.connector?.condition?.trim()).map(readCase)
  const fallback = outgoing.find((edge) => !edge.connector?.condition?.trim())
  // One field for the whole Switch: the first case's, so every case checks the same thing
  const field = cases[0]?.field ?? 'text'
  const targets = agents.filter((agent) => agent.id !== input?.from)

  const update = (updater: (previous: Diagram) => Diagram) => onChange(updater)
  const patchEdge = (edgeId: string, patch: (edge: DiagramEdge) => DiagramEdge) =>
    update((previous) => ({ ...previous, edges: previous.edges.map((edge) => (edge.id === edgeId ? patch(edge) : edge)) }))
  const setCondition = (edge: DiagramEdge, condition: string) =>
    patchEdge(edge.id, (current) => ({ ...current, connector: { ...defaultConnectorConfig(), ...current.connector, condition } }))
  const retarget = (edge: DiagramEdge, to: string) =>
    update((previous) => {
      const fromNode = previous.nodes.find((item) => item.id === edge.from)
      const toNode = previous.nodes.find((item) => item.id === to)
      const sides = fromNode && toNode ? facingPortSides(fromNode, 'process', toNode, 'process') : {}
      return { ...previous, edges: previous.edges.map((item) => (item.id === edge.id ? { ...item, to, ...sides } : item)) }
    })
  const removeEdge = (edgeId: string) =>
    update((previous) => ({ ...previous, edges: previous.edges.filter((edge) => edge.id !== edgeId) }))

  const setSource = (agentId: string) => {
    if (!agentId) {
      if (input) removeEdge(input.id)
      return
    }
    if (input) {
      update((previous) => {
        const fromNode = previous.nodes.find((item) => item.id === agentId)
        const sides = fromNode ? facingPortSides(fromNode, 'process', node, 'process') : {}
        return { ...previous, edges: previous.edges.map((edge) => (edge.id === input.id ? { ...edge, from: agentId, ...sides } : edge)) }
      })
    } else {
      update((previous) => ({ ...previous, edges: [...previous.edges, newEdge(previous, agentId, node.id, '', 1)] }))
    }
  }

  const setField = (next: string) => {
    for (const item of cases) setCondition(item.edge, writeCondition(next.trim() || 'text', item.op, item.value))
  }

  const addCase = () => {
    const used = new Set(outgoing.map((edge) => edge.to))
    const target = targets.find((agent) => !used.has(agent.id)) ?? targets[0]
    if (!target) return
    update((previous) => ({
      ...previous,
      edges: [...previous.edges, newEdge(previous, node.id, target.id, writeCondition(field, 'equals', ''), cases.length + 1)],
    }))
  }

  const setDefault = (agentId: string) => {
    if (!agentId) {
      if (fallback) removeEdge(fallback.id)
    } else if (fallback) {
      retarget(fallback, agentId)
    } else {
      update((previous) => ({ ...previous, edges: [...previous.edges, newEdge(previous, node.id, agentId, '', cases.length + 1)] }))
    }
  }

  const rename = (label: string) =>
    update((previous) => ({ ...previous, nodes: previous.nodes.map((item) => (item.id === node.id ? { ...item, label } : item)) }))

  const sourceLabel = agents.find((agent) => agent.id === input?.from)?.label

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-6 pt-3">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground/10 text-foreground">
          <GitFork className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Input value={node.label} onChange={(event) => rename(event.target.value)} className="h-8 text-[13px] font-semibold" aria-label="Switch name" />
          <p className="mt-1 text-[11px] text-muted-foreground">Sends the output to the first matching case; no model needed.</p>
        </div>
      </div>

      <div className="space-y-5">
        <Field label="Source" hint="The node whose output this Switch checks.">
          <Select value={input?.from ?? ''} onChange={(event) => setSource(event.target.value)} className="text-xs">
            <option value="">Choose a node…</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Check"
          hint={'"text" checks the whole reply. Any other name reads that field from a JSON reply, e.g. category or result.score.'}
        >
          <Input
            value={field}
            onChange={(event) => setField(event.target.value)}
            placeholder="text"
            className="font-mono text-xs"
            disabled={cases.length === 0}
          />
        </Field>

        <PanelSection title="Cases">
          <div className="space-y-2">
            {cases.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground">
                {sourceLabel ? `Add a case for each answer ${sourceLabel} can give.` : 'Choose a source, then add a case for each answer it can give.'}
              </p>
            ) : null}
            {cases.map((item, index) => (
              <div key={item.edge.id} className="rounded-lg border border-border/70 bg-background/50 p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                    Case {index + 1} · if {field}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-red-600"
                    onClick={() => removeEdge(item.edge.id)}
                    aria-label={`Remove case ${index + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-1.5">
                  <Select
                    value={item.op}
                    onChange={(event) => setCondition(item.edge, writeCondition(field, event.target.value as Op, item.value))}
                    className="h-8 text-xs"
                    aria-label="Operator"
                  >
                    {OPERATORS.map((operator) => (
                      <option key={operator.op} value={operator.op}>
                        {operator.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={item.value}
                    onChange={(event) => setCondition(item.edge, writeCondition(field, item.op, event.target.value))}
                    placeholder={NUMERIC_OPS.has(item.op) ? '0.8' : 'billing'}
                    className="h-8 font-mono text-xs"
                    aria-label="Value"
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <Select value={item.edge.to} onChange={(event) => retarget(item.edge, event.target.value)} className="h-8 text-xs" aria-label="Go to">
                    {targets.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" onClick={addCase} disabled={targets.length === 0}>
              <Plus className="size-3.5" />
              Add case
            </Button>
          </div>
        </PanelSection>

        <Field label="Otherwise go to" hint="Required: runs when no case matches.">
          <Select value={fallback?.to ?? ''} onChange={(event) => setDefault(event.target.value)} className="text-xs">
            <option value="">Choose a node…</option>
            {targets.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </Select>
        </Field>
        {!fallback ? (
          <p className="-mt-3 text-[11px] text-amber-700 dark:text-amber-300">The workflow can't run until the Switch has a default path.</p>
        ) : null}
      </div>
    </div>
  )
})
