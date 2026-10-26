import { memo, useEffect, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  History,
  Link2,
  Maximize2,
  Minus,
  Orbit,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Sparkles,
  Undo2,
  Workflow as WorkflowIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WorkflowPurpose } from '@/services/assistant-api'
import type { DeploymentStatus } from '@/types/agent-workflow'
import { cn } from '@/utils/cn'

// Whether the header is folded to its one-line bar; remembered in this browser
const COLLAPSED_KEY = 'eleven-nodes-workflow-header-collapsed'

export type WorkspaceView = 'map' | 'canvas' | 'code' | 'executions' | 'configuration'

const VIEWS: Array<{ id: WorkspaceView; label: string; icon: LucideIcon }> = [
  { id: 'map', label: 'Map', icon: Orbit },
  { id: 'canvas', label: 'Canvas', icon: WorkflowIcon },
  { id: 'code', label: 'Code', icon: Code2 },
  // Executions and Configuration live in the left rail
]

/** The toolbar's flat grey buttons: a blue icon and a short label. */
const TOOL_BUTTON =
  'flex h-6 items-center gap-1.5 rounded-[2px] bg-foreground/[0.045] px-2 text-[11px] text-foreground transition-colors hover:bg-foreground/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-primary'

const ICON_TOOL =
  'flex h-6 w-6 items-center justify-center rounded-[2px] text-primary transition-colors hover:bg-foreground/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-3.5 [&_svg]:w-3.5'

interface WorkflowContentHeaderProps {
  name: string
  onNameChange: (name: string) => void
  subtitle: string
  status: DeploymentStatus
  isDirty: boolean
  view: WorkspaceView
  onViewChange: (view: WorkspaceView) => void
  onRun: () => void
  canRun: boolean
  isExecuting: boolean
  onSave: () => void
  onAskAi?: () => void
  onShare?: () => void
  onDeploy: () => void
  canDeploy: boolean
  /** Admins only: what this workflow is for. */
  purpose?: { value: WorkflowPurpose; onChange: (purpose: WorkflowPurpose) => void; busy?: boolean }
  /** Zoom and layout tools for the map and canvas. */
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onAutoLayout?: () => void
  onUndo?: () => void
}

/**
 * The page header over the workspace: the workflow's name in large type with a one-line summary,
 * a row of flat action buttons, and on the right the VIEW switch and the zoom tools.
 */
export const WorkflowContentHeader = memo(function WorkflowContentHeader({
  name,
  onNameChange,
  subtitle,
  status,
  isDirty,
  view,
  onViewChange,
  onRun,
  canRun,
  isExecuting,
  onSave,
  onAskAi,
  onShare,
  onDeploy,
  canDeploy,
  purpose,
  onZoomIn,
  onZoomOut,
  onFit,
  onAutoLayout,
  onUndo,
}: WorkflowContentHeaderProps) {
  const zoomable = view === 'map' || view === 'canvas'
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Storage blocked: the header just opens expanded next time.
    }
  }, [collapsed])

  return (
    <div
      className={cn(
        'relative z-10 shrink-0 border-b border-border bg-[hsl(var(--canvas))] px-4 shadow-[0_2px_6px_-2px_rgba(0,0,0,0.10)] transition-[padding] duration-200 dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]',
        collapsed ? 'py-1.5' : 'pb-2.5 pt-3',
      )}
    >
      <div className={cn('flex gap-4', collapsed ? 'items-center' : 'items-start')}>
        <div className={cn('min-w-0 flex-1', collapsed && 'flex items-baseline gap-2')}>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            aria-label="Workflow name"
            className={cn(
              '-ml-1 rounded-[2px] border border-transparent bg-transparent px-1 font-semibold tracking-[-0.01em] text-foreground outline-none transition-[font-size] duration-200 hover:border-border focus:border-primary',
              collapsed ? 'w-auto max-w-[18rem] text-[14px] leading-6' : 'w-full max-w-[32rem] text-[22px] leading-8',
            )}
            style={collapsed ? { width: `${Math.max(name.length, 8) + 2}ch` } : undefined}
          />
          <p className={cn('truncate text-[11px] text-muted-foreground', !collapsed && 'mt-0.5')}>
            {subtitle}
            {status === 'deployed' ? <span className="ml-1.5 text-emerald-700 dark:text-emerald-400">· Deployed</span> : null}
            {isDirty ? <span className="ml-1.5 text-amber-700 dark:text-amber-400">· Unsaved changes</span> : null}
          </p>
        </div>

        {/* VIEW switch and zoom tools */}
        <div className={cn('flex shrink-0 items-center gap-3', !collapsed && 'pt-1')}>
          <div className="flex items-center gap-1" role="tablist" aria-label="View">
            <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">View:</span>
            {VIEWS.map(({ id, label, icon: Icon }) => {
              const active = view === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={label}
                  title={label}
                  onClick={() => onViewChange(id)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-foreground/[0.07]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.25 : 1.9} />
                </button>
              )
            })}
          </div>
          <div className={cn('flex items-center gap-0.5', !zoomable && 'pointer-events-none opacity-35')} aria-hidden={!zoomable}>
            <button type="button" className={ICON_TOOL} onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
              <Plus />
            </button>
            <button type="button" className={ICON_TOOL} onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
              <Minus />
            </button>
            {onAutoLayout ? (
              <button type="button" className={ICON_TOOL} onClick={onAutoLayout} aria-label="Tidy up" title="Tidy up (auto-layout)">
                <RefreshCw />
              </button>
            ) : null}
            <button type="button" className={ICON_TOOL} onClick={onFit} aria-label="Fit to view" title="Fit to view">
              <Maximize2 />
            </button>
            {onUndo ? (
              <button type="button" className={ICON_TOOL} onClick={onUndo} aria-label="Undo" title="Undo">
                <Undo2 />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(ICON_TOOL, 'border-l border-border pl-0.5')}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand header' : 'Collapse header'}
            title={collapsed ? 'Show actions' : 'Collapse header'}
          >
            {collapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
          </button>
        </div>
      </div>

      {/* Actions: fold away with the header */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
        aria-hidden={collapsed}
      >
      <div className="min-h-0 overflow-hidden">
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <div className="flex items-center">
          <button type="button" className={cn(TOOL_BUTTON, 'rounded-r-none')} onClick={onRun} disabled={!canRun}>
            <Play />
            {isExecuting ? 'Running…' : 'Run workflow'}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(TOOL_BUTTON, 'rounded-l-none border-l border-border/70 px-1.5 [&_svg]:text-foreground/70')} aria-label="More run options">
                <ChevronDown />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem disabled={!canRun} onSelect={onRun}>
                <Play /> Run with input…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onViewChange('executions')}>
                <History /> Past executions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <button type="button" className={TOOL_BUTTON} onClick={onSave}>
          <Save />
          Save
        </button>
        {onAskAi ? (
          <button type="button" className={TOOL_BUTTON} onClick={onAskAi}>
            <Sparkles />
            Ask AI
          </button>
        ) : null}
        {onShare ? (
          <button type="button" className={TOOL_BUTTON} onClick={onShare}>
            <Link2 />
            Share
          </button>
        ) : null}
        {purpose ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={purpose.busy}>
              <button type="button" className={TOOL_BUTTON} aria-label="Workflow purpose">
                <Bot />
                {purpose.value === 'ai_assistant' ? 'AI assistant' : 'Purpose'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Purpose</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={purpose.value === 'user_build'}
                onCheckedChange={() => purpose.onChange('user_build')}
              >
                My workflow
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={purpose.value === 'ai_assistant'}
                onCheckedChange={() => purpose.onChange('ai_assistant')}
              >
                <span className="flex flex-col">
                  <span>AI assistant</span>
                  <span className="text-[11px] text-muted-foreground">Everyone's chat runs it; your saves update it</span>
                </span>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <button type="button" className={TOOL_BUTTON} onClick={onDeploy} disabled={!canDeploy}>
          <Rocket />
          Deploy
        </button>
      </div>
      </div>
      </div>
    </div>
  )
})
