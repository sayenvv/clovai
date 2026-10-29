import { useState } from 'react'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AssistantRequest, DraftDiff } from '@/services/workflow-assistant-api'
import type { DiagramNode } from '@/components/designer/diagram-types'
import type { DiffState, DraftPreview } from '@/components/agent-workflow/draft-preview'
import { cn } from '@/utils/cn'

/**
 * Cards the 4.0 workflow assistant shows in the chat: what a waiting run asks the user (a plan to approve,
 * a question, a confirmation), and the draft's changes to accept onto the canvas or discard.
 */

const CARD = 'mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3 text-[12px]'

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
  const fields = request.payload.responseSchema?.properties ?? {}
  // A question whose answer is "approve, or say what to change" (the assistant's plan approval)
  const isPlanApproval = request.kind === 'ask_user' && 'approve' in fields

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

  return (
    <div className={CARD}>
      <p className="whitespace-pre-wrap text-foreground">{request.payload.question}</p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        placeholder={isPlanApproval ? 'What should change? (leave empty to build it as planned)' : 'Your answer'}
        className="w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-[12px] outline-none focus:border-foreground/30"
        disabled={busy}
      />
      <div className="flex gap-2">
        {isPlanApproval ? (
          <>
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
          </>
        ) : (
          <Button size="sm" className="h-7 text-[11.5px]" disabled={busy || !text.trim()} onClick={() => onAnswer({ text: text.trim() })}>
            Send answer
          </Button>
        )}
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
  { state: 'added', label: 'new', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
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
  added: 'fill-blue-500/15 stroke-blue-500',
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
              state === 'added' ? 'stroke-blue-500' : state === 'removed' ? 'stroke-red-500 [stroke-dasharray:10_8]' : 'stroke-muted-foreground/40',
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
  onAccept,
  onDiscard,
}: {
  diff: DraftDiff
  preview: DraftPreview | null
  previewOnCanvas: boolean
  onTogglePreview?: () => void
  busy: boolean
  onAccept: () => void
  onDiscard: () => void
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
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={busy} onClick={onAccept}>
          <Check className="h-3.5 w-3.5" /> Accept
        </Button>
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
  onAccept,
  onDiscard,
  onHide,
}: {
  counts: Record<DiffState, number>
  busy: boolean
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
        <Button size="sm" className="h-7 gap-1 rounded-full text-[11.5px]" disabled={busy} onClick={onAccept}>
          <Check className="h-3.5 w-3.5" /> Accept
        </Button>
      </div>
    </div>
  )
}
