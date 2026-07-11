import { memo } from 'react'
import {
  ArrowLeftRight,
  BringToFront,
  ClipboardCopy,
  Copy,
  Lock,
  Scissors,
  SendToBack,
  Tag,
  Trash2,
  Unlock,
  Waypoints,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { EdgeRouting } from './diagram-types'

export interface EdgeContextMenuState {
  x: number
  y: number
  edgeIds: string[]
}

interface EdgeContextMenuProps {
  state: EdgeContextMenuState
  routing: EdgeRouting
  locked: boolean
  onClose: () => void
  onDelete: () => void
  onDuplicate: () => void
  onCopy: () => void
  onCut: () => void
  onReverse: () => void
  onAddLabel: () => void
  onToggleLock: () => void
  onRoutingChange: (routing: EdgeRouting) => void
  onBringForward: () => void
  onSendBackward: () => void
}

function Item({
  icon: Icon,
  label,
  shortcut,
  destructive,
  onClick,
}: {
  icon: typeof Trash2
  label: string
  shortcut?: string
  destructive?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-muted',
        destructive && 'text-destructive hover:bg-destructive/10',
      )}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
    </button>
  )
}

/** Right-click menu for selected connector(s). */
export const EdgeContextMenu = memo(function EdgeContextMenu({
  state,
  routing,
  locked,
  onClose,
  onDelete,
  onDuplicate,
  onCopy,
  onCut,
  onReverse,
  onAddLabel,
  onToggleLock,
  onRoutingChange,
  onBringForward,
  onSendBackward,
}: EdgeContextMenuProps) {
  const run = (action: () => void) => {
    action()
    onClose()
  }

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
        style={{ left: state.x, top: state.y }}
        role="menu"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Item icon={Tag} label="Add / edit label" onClick={() => run(onAddLabel)} />
        <Item icon={ArrowLeftRight} label="Reverse direction" onClick={() => run(onReverse)} />
        <Item
          icon={Waypoints}
          label={
            routing === 'orthogonal'
              ? 'Use bezier curve'
              : routing === 'curved'
                ? 'Use straight line'
                : 'Use orthogonal'
          }
          onClick={() =>
            run(() =>
              onRoutingChange(
                routing === 'orthogonal'
                  ? 'curved'
                  : routing === 'curved'
                    ? 'straight'
                    : 'orthogonal',
              ),
            )
          }
        />
        <Item
          icon={locked ? Unlock : Lock}
          label={locked ? 'Unlock connector' : 'Lock connector'}
          onClick={() => run(onToggleLock)}
        />
        <div className="my-1 h-px bg-border" />
        <Item icon={BringToFront} label="Bring forward" onClick={() => run(onBringForward)} />
        <Item icon={SendToBack} label="Send backward" onClick={() => run(onSendBackward)} />
        <div className="my-1 h-px bg-border" />
        <Item icon={Copy} label="Duplicate" shortcut="⌘D" onClick={() => run(onDuplicate)} />
        <Item icon={ClipboardCopy} label="Copy" shortcut="⌘C" onClick={() => run(onCopy)} />
        <Item icon={Scissors} label="Cut" shortcut="⌘X" onClick={() => run(onCut)} />
        <div className="my-1 h-px bg-border" />
        <Item
          icon={Trash2}
          label="Delete"
          shortcut="⌫"
          destructive
          onClick={() => run(onDelete)}
        />
      </div>
    </>
  )
})
