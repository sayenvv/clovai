import type { ReactNode } from 'react'
import { MoreHorizontal, X } from 'lucide-react'
import { cn } from '@/utils/cn'

/** What the canvas is focused on: a node or connector it glides to, or nothing in particular. */
export type CanvasFocusTarget =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'center' }

/** Run state shown as a ring around a node while (or after) the workflow runs. */
export type NodeRunStatus = 'running' | 'waiting' | 'completed' | 'error'

/**
 * A node (or connector) expanded on the canvas: the node grows in place into a card with its
 * details, pinned to the node as the canvas pans and zooms.
 */
export interface CanvasFocus {
  /** Changes when the card shows something else, so the canvas glides and animates again. */
  key: string
  target: CanvasFocusTarget
  title: string
  subtitle?: string | null
  icon?: ReactNode
  /** Fixed width in pixels; the card never exceeds the canvas. */
  width?: number
  /** `fill` gives the content a fixed height to manage its own scrolling (the run chat). */
  layout?: 'auto' | 'fill'
  content: ReactNode
  onClose: () => void
  /** Opens the node's actions menu at screen position (x, y), from the header's "⋯" button. */
  onMore?: (x: number, y: number) => void
}

export const FOCUS_CARD_WIDTH = 440

/** The card itself: header with icon, title and close, then the content. */
export function FocusCardShell({
  focus,
  className,
  style,
  elementRef,
}: {
  focus: CanvasFocus
  className?: string
  style?: React.CSSProperties
  /** Receives the card element, so the canvas can measure it. */
  elementRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={elementRef}
      role="dialog"
      aria-label={focus.title}
      className={cn(
        // The selected node, grown: same surface and outline as a selected node card.
        'flex flex-col overflow-hidden rounded-xl bg-[hsl(var(--node))] text-card-foreground',
        'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_14px_-4px_rgba(0,0,0,0.14)]',
        className,
      )}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      // Keys typed in the card must not reach the canvas shortcuts (Backspace would delete the
      // node); Esc still closes it.
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') focus.onClose()
      }}
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
        {focus.icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-muted/40 to-muted text-foreground/75 ring-1 ring-inset ring-border [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {focus.icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{focus.title}</h2>
          {focus.subtitle ? (
            <p className="truncate text-[11px] text-muted-foreground">{focus.subtitle}</p>
          ) : null}
        </div>
        {focus.onMore ? (
          <button
            type="button"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              focus.onMore?.(rect.left, rect.bottom + 4)
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="More actions"
            title="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={focus.onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className={cn(
          'min-h-0 flex-1',
          focus.layout === 'fill' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain',
        )}
      >
        {focus.content}
      </div>
    </div>
  )
}
