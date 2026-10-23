import { memo, useEffect, type ComponentType } from 'react'
import { cn } from '@/utils/cn'

export interface NodeContextMenuState {
  nodeId: string
  x: number
  y: number
}

export type NodeMenuEntry =
  | {
      kind?: 'item'
      label: string
      icon: ComponentType<{ className?: string }>
      onSelect: () => void
      shortcut?: string
      destructive?: boolean
      /** Shown greyed out, with `hint` explaining why. */
      disabled?: boolean
      hint?: string
    }
  | { kind: 'separator' }

/** Right-click (or "⋯") menu for a node on the workflow canvas. Same look as the connector menu. */
export const NodeContextMenu = memo(function NodeContextMenu({
  state,
  title,
  entries,
  onClose,
}: {
  state: NodeContextMenuState
  title?: string
  entries: NodeMenuEntry[]
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Keep the menu on screen near the click.
  const left = Math.min(state.x, window.innerWidth - 240)
  const top = Math.min(state.y, window.innerHeight - 40 - entries.length * 32)

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default"
        aria-label="Dismiss menu"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
      />
      <div
        className="fixed z-[70] w-56 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-xl"
        style={{ left, top: Math.max(8, top) }}
        role="menu"
        aria-label={title ? `${title} actions` : 'Node actions'}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {title ? (
          <div className="truncate px-2 pb-1.5 pt-1 text-[11px] font-medium text-muted-foreground">{title}</div>
        ) : null}
        {entries.map((entry, index) =>
          entry.kind === 'separator' ? (
            <div key={`separator-${index}`} className="my-1 h-px bg-border" />
          ) : (
            <button
              key={entry.label}
              type="button"
              role="menuitem"
              disabled={entry.disabled}
              title={entry.disabled ? entry.hint : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-muted',
                'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent',
                entry.destructive && 'text-destructive hover:bg-destructive/10',
              )}
              onClick={() => {
                if (entry.disabled) return
                entry.onSelect()
                onClose()
              }}
            >
              <entry.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="flex-1 truncate">{entry.label}</span>
              {entry.disabled && entry.hint ? (
                <span className="text-[10px] text-muted-foreground">{entry.hint}</span>
              ) : entry.shortcut ? (
                <span className="text-[10px] text-muted-foreground">{entry.shortcut}</span>
              ) : null}
            </button>
          ),
        )}
      </div>
    </>
  )
})
