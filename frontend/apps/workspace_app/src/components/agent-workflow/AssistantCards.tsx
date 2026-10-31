import { useEffect, useState } from 'react'
import { Check, ClipboardList, Eye, EyeOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchTestRun, type AssistantRequest, type DraftDiff, type TestRun } from '@/services/workflow-assistant-api'
import type { DiagramNode } from '@/components/designer/diagram-types'
import type { DiffState, DraftPreview } from '@/components/agent-workflow/draft-preview'
import { ChatMarkdown } from '@/components/agent-workflow/ChatMarkdown'
import { OutOfTokensNotice } from '@/components/agent-workflow/OutOfTokensNotice'
import { SchemaForm } from '@/components/agent-workflow/SchemaForm'
import { cn } from '@/utils/cn'
import { formatCredits } from '@/services/token-usage-store'

/**
 * Cards the 4.0 workflow assistant shows in the chat: what a waiting run asks the user (a plan to approve,
 * a question, a confirmation), and the draft's changes to accept onto the canvas or discard.
 */

export const CARD = 'mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3 text-[12px]'

export function AssistantRequestCard({
  request,
  busy,
  onAnswer,
}: {
  request: AssistantRequest
  busy: boolean
  onAnswer: (response: Record<string, unknown>) => void
}) {
  const [text, setText] = useState('')
  // The workflow marks a question whose answer is "approve, or say what to change" (such as a plan to build)
  const isPlanApproval = request.kind === 'ask_user' && request.payload.responseSchema?.['x-ui'] === 'plan-approval'

  if (request.kind === 'credits') {
    return <OutOfTokensNotice message={request.payload.message} busy={busy} onContinue={() => onAnswer({})} />
  }

  if (request.kind === 'approval') {
    return (
      <div className={CARD}>
        <p className="font-medium text-foreground">Confirm</p>
        <p className="whitespace-pre-wrap text-muted-foreground">{request.payload.message}</p>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={() => onAnswer({ approved: true })}>
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={() => onAnswer({ approved: false })}>
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      </div>
    )
  }

  if (!isPlanApproval) {
    // Any other question: the inputs the asking step picked (choices, toggles, dates, text), drawn as a form
    return (
      <div className={CARD}>
        <ChatMarkdown content={request.payload.question ?? ''} className="text-[12.5px] leading-5 text-foreground" />
        <SchemaForm schema={request.payload.responseSchema} busy={busy} onSubmit={onAnswer} />
      </div>
    )
  }

  // The plan as a card: its heading, then the plan itself (steps, branches, assumptions) as formatted text
  return (
    <div className={CARD}>
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <ClipboardList className="h-3.5 w-3.5" /> Plan to review
      </p>
      <div className="max-h-[340px] overflow-y-auto rounded border border-border/60 bg-muted/30 px-2.5 py-2">
        <ChatMarkdown content={request.payload.question ?? ''} className="text-[12.5px] leading-5 text-foreground" />
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        placeholder="What should change? (leave empty to build it as planned)"
        className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-[12px] outline-none focus:border-foreground/30"
        disabled={busy}
      />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-[11.5px]" disabled={busy || text.trim().length > 0} onClick={() => onAnswer({ approve: true })}>
          Build it
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11.5px]"
          disabled={busy || !text.trim()}
          onClick={() => onAnswer({ approve: false, changes: text.trim() })}
        >
          Change the plan
        </Button>
      </div>
    </div>
  )
}

function count(part: { added: string[]; removed: string[]; changed: unknown[] } | undefined, noun: string): string | null {
  if (!part) return null
  const bits = [
    part.added.length ? `${part.added.length} added` : '',
    part.removed.length ? `${part.removed.length} removed` : '',
    part.changed.length ? `${part.changed.length} changed` : '',
  ].filter(Boolean)
  return bits.length ? `${noun}: ${bits.join(', ')}` : null
}

export function draftHasChanges(diff: DraftDiff): boolean {
  const parts = Object.values(diff).filter((value): value is { added: string[]; removed: string[]; changed: unknown[] } =>
    Boolean(value && typeof value === 'object' && 'added' in value),
  )
  return parts.some((part) => part.added.length || part.removed.length || part.changed.length) || diff.sections.length > 0
}

const DIFF_CHIPS: Array<{ state: DiffState; label: string; className: string }> = [
  { state: 'added', label: 'new', className: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  { state: 'changed', label: 'edited', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { state: 'removed', label: 'removed', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
]

function DiffChips({ counts }: { counts: Record<DiffState, number> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DIFF_CHIPS.filter((chip) => counts[chip.state]).map((chip) => (
        <span key={chip.state} className={cn('rounded-full px-1.5 py-px text-[10.5px] font-medium tabular-nums', chip.className)}>
          {counts[chip.state]} {chip.label}
        </span>
      ))}
    </div>
  )
}

const THUMB_FILL: Record<DiffState | 'same', string> = {
  added: 'fill-green-500/15 stroke-green-600',
  changed: 'fill-amber-500/15 stroke-amber-500',
  removed: 'fill-red-500/10 stroke-red-500 [stroke-dasharray:4_3]',
  same: 'fill-muted stroke-border',
}

/** The draft as a small flowchart: every block a box coloured by its change, every connector a line. */
function DraftThumbnail({ preview }: { preview: DraftPreview }) {
  const { nodes, edges } = preview.diagram
  if (!nodes.length) return null
  const box = (node: DiagramNode) => ({ x: node.x, y: node.y, width: node.width ?? 180, height: node.height ?? 72 })
  const boxes = new Map(nodes.map((node) => [node.id, box(node)]))
  const all = [...boxes.values()]
  const pad = 40
  const minX = Math.min(...all.map((b) => b.x)) - pad
  const minY = Math.min(...all.map((b) => b.y)) - pad
  const width = Math.max(...all.map((b) => b.x + b.width)) - minX + pad
  const height = Math.max(...all.map((b) => b.y + b.height)) - minY + pad
  return (
    <svg viewBox={`${minX} ${minY} ${width} ${height}`} className="h-28 w-full rounded border border-border bg-background" aria-hidden>
      {edges.map((edge) => {
        const from = boxes.get(edge.from)
        const to = boxes.get(edge.to)
        if (!from || !to) return null
        const state = preview.edges[edge.id]
        return (
          <line
            key={edge.id}
            x1={from.x + from.width}
            y1={from.y + from.height / 2}
            x2={to.x}
            y2={to.y + to.height / 2}
            strokeWidth={4}
            className={cn(
              state === 'added' ? 'stroke-green-600' : state === 'removed' ? 'stroke-red-500 [stroke-dasharray:10_8]' : 'stroke-muted-foreground/40',
            )}
          />
        )
      })}
      {nodes.map((node) => {
        const b = boxes.get(node.id)!
        return (
          <rect key={node.id} {...b} rx={14} strokeWidth={4} className={THUMB_FILL[preview.nodes[node.id] ?? 'same']} />
        )
      })}
    </svg>
  )
}

export function DraftReviewCard({
  diff,
  preview,
  previewOnCanvas,
  onTogglePreview,
  busy,
  testFailed = false,
  onAccept,
  onDiscard,
  onKeepFixing,
}: {
  diff: DraftDiff
  preview: DraftPreview | null
  previewOnCanvas: boolean
  onTogglePreview?: () => void
  busy: boolean
  /** The assistant's test of this draft still fails: fixing comes first, accepting it as it is stays possible. */
  testFailed?: boolean
  onAccept: () => void
  onDiscard: () => void
  onKeepFixing?: () => void
}) {
  const settings = diff.sections.length ? `Settings changed: ${diff.sections.join(', ')}` : null
  const lines = preview
    ? [settings].filter(Boolean)
    : [
        count(diff.nodes, 'Steps'),
        count(diff.edges, 'Connections'),
        count(diff.agents as DraftDiff['nodes'] | undefined, 'Agents'),
        count(diff.tools as DraftDiff['nodes'] | undefined, 'Tools'),
        settings,
      ].filter(Boolean)
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">{preview?.isNew ? 'New workflow ready' : 'Changes ready to review'}</p>
        {preview ? <DiffChips counts={preview.counts} /> : null}
      </div>
      {preview ? (
        <button
          type="button"
          onClick={onTogglePreview}
          disabled={!onTogglePreview}
          className="block w-full rounded transition-opacity hover:opacity-90 disabled:cursor-default"
          title={previewOnCanvas ? 'Shown on the canvas' : 'Show on the canvas'}
        >
          <DraftThumbnail preview={preview} />
        </button>
      ) : null}
      {lines.length ? (
        <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {testFailed ? (
        <p className="rounded border border-red-500/30 bg-red-500/[0.06] px-2 py-1.5 text-red-700 dark:text-red-300">
          The test still fails. Let the assistant keep fixing it, or accept it as it is and fix it on the canvas yourself.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {testFailed ? (
          <>
            <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={busy || !onKeepFixing} onClick={onKeepFixing}>
              <Check className="h-3.5 w-3.5" /> Keep fixing
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={onAccept}>
              <Check className="h-3.5 w-3.5" /> Accept anyway
            </Button>
          </>
        ) : (
          <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={onAccept}>
            <Check className="h-3.5 w-3.5" /> Accept
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={onDiscard}>
          <X className="h-3.5 w-3.5" /> Discard
        </Button>
        {onTogglePreview ? (
          <Button size="sm" variant="ghost" className="ml-auto h-7 gap-1 text-[11.5px]" disabled={busy} onClick={onTogglePreview}>
            {previewOnCanvas ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {previewOnCanvas ? 'Hide preview' : 'Preview on canvas'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Floats over the canvas while it shows the draft: what changed, and accept / discard / back. */
export function DraftPreviewBar({
  counts,
  busy,
  acceptDisabled = false,
  onAccept,
  onDiscard,
  onHide,
}: {
  counts: Record<DiffState, number>
  busy: boolean
  /** The draft's test still fails: it cannot be accepted yet. */
  acceptDisabled?: boolean
  onAccept: () => void
  onDiscard: () => void
  onHide: () => void
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-background/95 py-1.5 pl-4 pr-1.5 text-[12px] shadow-lg backdrop-blur">
      <span className="font-medium text-foreground">Previewing the assistant's changes</span>
      <DiffChips counts={counts} />
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-7 rounded-full text-[11.5px]" disabled={busy} onClick={onHide}>
          Back to workflow
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 rounded-full text-[11.5px]" disabled={busy} onClick={onDiscard}>
          <X className="h-3.5 w-3.5" /> Discard
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1 rounded-full text-[11.5px]"
          disabled={busy || acceptDisabled}
          onClick={onAccept}
          title={acceptDisabled ? 'The test still fails; let the assistant keep fixing it' : undefined}
        >
          <Check className="h-3.5 w-3.5" /> Accept
        </Button>
      </div>
    </div>
  )
}

export const RUN_STATUS: Record<string, { label: string; className: string }> = {
  succeeded: { label: 'Succeeded', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  waiting: { label: 'Waiting', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  running: { label: 'Running', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
}

export const asText = (value: unknown): string =>
  value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2)

/** What the input was: the message itself when the workflow takes one, else the whole input. */
function inputText(inputs: Record<string, unknown>): string {
  const keys = Object.keys(inputs)
  return keys.length === 1 && keys[0] === 'message' ? asText(inputs.message) : asText(inputs)
}

const verifiedKey = (runId: string) => `assistant-test-verified:${runId}`

/**
 * The assistant's test run of a draft, for the user to check: the input it used, each step and how it ended,
 * the output, and whether it looks right. "Something's wrong" starts a message about it.
 */
export function TestRunCard({ runId, onReportProblem }: { runId: string; onReportProblem: (text: string) => void }) {
  const [run, setRun] = useState<TestRun | null>(null)
  const [failed, setFailed] = useState(false)
  const [verified, setVerified] = useState(() => {
    try {
      return localStorage.getItem(verifiedKey(runId)) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    let live = true
    fetchTestRun(runId)
      .then((value) => live && setRun(value))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [runId])

  if (failed) return <p className="mt-2 text-[12px] text-muted-foreground">The test run could not be loaded.</p>
  if (!run) return <div className="mt-2 h-24 animate-pulse rounded-md border border-border bg-muted/30" />

  const status = RUN_STATUS[run.status] ?? RUN_STATUS.cancelled
  const steps = run.events.filter(
    (event) => (event.type === 'node.completed' || event.type === 'node.failed') && event.nodeType !== 'start' && event.nodeType !== 'end',
  )
  const tokens = run.events.reduce((sum, event) => sum + (event.type === 'usage' ? (event.totalTokens ?? 0) : 0), 0)
  const output = asText(run.output)

  const confirm = () => {
    setVerified(true)
    try {
      localStorage.setItem(verifiedKey(runId), '1')
    } catch {
      // Not remembered across reloads; the card still shows it now
    }
  }

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">Test run</p>
        <span className="flex items-center gap-2">
          {tokens ? <span className="font-mono text-[11px] text-muted-foreground">{formatCredits(tokens)}</span> : null}
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', status.className)}>{status.label}</span>
        </span>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Input</p>
        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded border border-border bg-background px-2 py-1.5 font-mono text-[11.5px] text-foreground">
          {inputText(run.inputs)}
        </pre>
      </div>

      {steps.length ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Steps</p>
          <ol className="mt-1 space-y-1">
            {steps.map((step, index) => {
              const failedStep = step.type === 'node.failed'
              const auto = step.nodeType === 'approval' || step.nodeType === 'ask_user'
              const note = failedStep
                ? step.error
                : auto
                  ? `${step.outcome ?? 'answered'} automatically in the test`
                  : step.summary || step.outcome || ''
              return (
                <li key={`${step.nodeId}-${index}`} className="flex gap-2">
                  <span
                    className={cn('mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full', failedStep ? 'bg-red-500' : 'bg-emerald-500')}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{step.name}</span>
                    {note ? <span className="text-muted-foreground"> · {note}</span> : null}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      {run.error ? <p className="text-red-600 dark:text-red-400">{run.error}</p> : null}
      {output ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Output</p>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border bg-background px-2 py-1.5 text-[12px] text-foreground">
            {output}
          </pre>
        </div>
      ) : null}

      {verified ? (
        <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> You checked this result
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          <span className="mr-auto text-muted-foreground">Does this look right?</span>
          <Button size="sm" className="h-7 gap-1 text-[11.5px]" onClick={confirm}>
            <Check className="h-3.5 w-3.5" /> Looks right
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11.5px]"
            onClick={() => onReportProblem('The test run did not do what I expected: ')}
          >
            Something&apos;s wrong
          </Button>
        </div>
      )}
    </div>
  )
}
