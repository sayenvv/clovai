import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose } from 'lucide-react'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import type { usePersistedHorizontalPanel } from '@/components/agent-workflow/hooks/use-workflow-editor-panels'
import { cn } from '@/utils/cn'

type Panel = ReturnType<typeof usePersistedHorizontalPanel>

const KEY_STEP = 16

/**
 * A side pane of the app builder: resizable from its inner edge (drag, arrow keys; double-click collapses), and
 * collapsible to a rail. It never takes more than `maxShare` of the row, so the middle keeps its room. On a narrow
 * screen (`stacked`) it is a full-width tab panel instead.
 *
 * Its content stays mounted however it is shown (collapsed, stacked, hidden), so a conversation in it survives.
 */
export function BuilderPane({
  side,
  title,
  icon,
  panel,
  actions,
  maxShare = 0.4,
  stacked = false,
  active = true,
  children,
}: {
  /** Which edge of the builder the pane sits on. */
  side: 'left' | 'right'
  title: string
  icon: ReactNode
  panel: Panel
  /** Buttons in the pane's header, before its collapse button. */
  actions?: ReactNode
  maxShare?: number
  /** Shown as a tab panel (narrow screens); `active` says whether its tab is selected. */
  stacked?: boolean
  active?: boolean
  children: ReactNode
}) {
  const collapsed = panel.collapsed && !stacked
  const border = side === 'left' ? 'border-r' : 'border-l'
  const Expand = side === 'left' ? ChevronRight : ChevronLeft
  const Collapse = side === 'left' ? PanelLeftClose : PanelRightClose

  // The handle is on the inner edge; moving it toward the middle widens the pane
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP
    if (event.key === 'ArrowLeft') panel.nudge(side === 'left' ? -step : step)
    else if (event.key === 'ArrowRight') panel.nudge(side === 'left' ? step : -step)
    else if (event.key === 'Enter') panel.collapse()
    else return
    event.preventDefault()
  }

  return (
    <aside
      aria-label={title}
      className={cn(
        'relative flex h-full min-w-0 flex-col bg-card',
        stacked ? (active ? 'flex-1' : 'hidden') : cn('shrink-0 border-border', border),
      )}
      style={stacked ? undefined : collapsed ? { width: SIDE_PANEL_COLLAPSED_WIDTH } : { width: panel.size, maxWidth: `${maxShare * 100}%` }}
    >
      {!stacked && !collapsed ? (
        <DesignerResizeHandle
          side={side === 'left' ? 'right' : 'left'}
          onPointerDown={panel.onResizePointerDown}
          onDoubleClick={panel.collapse}
          onKeyDown={onKeyDown}
          ariaLabel={`Resize ${title.toLowerCase()}`}
          grip
        />
      ) : null}
      {stacked ? null : collapsed ? (
        <button
          type="button"
          onClick={panel.expand}
          aria-label={`Show ${title.toLowerCase()}`}
          title={`Show ${title.toLowerCase()}`}
          className="flex flex-1 flex-col items-center gap-3 py-3 text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
        >
          <Expand className="h-4 w-4" />
          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
          <span className="text-[10px] font-medium uppercase tracking-widest [writing-mode:vertical-rl]" style={{ transform: 'rotate(180deg)' }}>
            {title}
          </span>
        </button>
      ) : (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <span className="text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
          <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">{title}</p>
          {actions}
          <button
            type="button"
            onClick={panel.collapse}
            aria-label={`Hide ${title.toLowerCase()}`}
            title={`Hide ${title.toLowerCase()}`}
            className="flex h-7 w-7 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <Collapse className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className={cn('flex min-h-0 flex-1 flex-col', collapsed && 'hidden')}>{children}</div>
    </aside>
  )
}

/** The builder's middle (preview, code): fills the row, or is one tab panel on a narrow screen. */
export function BuilderStage({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', hidden && 'hidden')}>{children}</div>
}

export interface PaneTab<T extends string> {
  id: T
  label: string
  icon: ReactNode
  /** A dot on the tab, such as unsaved changes or a new reply. */
  badge?: boolean
}

/** The builder's panes as tabs, for screens too narrow to show them side by side. */
export function PaneTabs<T extends string>({ tabs, value, onChange }: { tabs: PaneTab<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <div role="tablist" aria-label="Builder panes" className="flex shrink-0 border-b border-border bg-card px-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative flex h-10 flex-1 items-center justify-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground [&>svg]:h-3.5 [&>svg]:w-3.5',
            value === tab.id && 'font-medium text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.badge ? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="(updated)" /> : null}
        </button>
      ))}
    </div>
  )
}
