import { memo, useMemo } from 'react'
import { Link2, Rocket, Save, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import type { DeploymentStatus } from '@/types/agent-workflow'
import { APP_NAME } from '@/constants'
import { cn } from '@/utils/cn'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
/** Shortcut label for opening the AI chat (handled by the page). */
const ASK_AI_SHORTCUT_LABEL = IS_MAC ? '⌘K' : 'Ctrl K'

interface AgentWorkflowHeaderProps {
  workflowName: string
  onWorkflowNameChange: (name: string) => void
  status: DeploymentStatus
  isDirty?: boolean
  onSave: () => void
  onDeploy: () => void
  /** Opens the Workflow AI chat. */
  onGenerate?: () => void
  isValidated: boolean
  onNavigateHome?: () => void
  onViewInstance?: () => void
  onShare?: () => void
  /** The tab shown in the centre: the canvas, its code, the executions board or the workflow configuration. */
  view?: EditorView
  onViewChange?: (view: EditorView) => void
  /** Header tabs from `designer.views` in mega-menu.json; falls back to all four. */
  viewTabs?: Array<{ id: EditorView; label: string; isVisible: boolean; order: number }>
}

export type EditorView = 'editor' | 'code' | 'executions' | 'configuration'

const VIEW_TABS: Array<{ value: EditorView; label: string }> = [
  { value: 'editor', label: 'Editor' },
  { value: 'code', label: 'Code' },
  { value: 'executions', label: 'Executions' },
  { value: 'configuration', label: 'Configuration' },
]

/**
 * The editor's top bar, kept to the main actions: logo and workflow name on the left, the
 * Editor / Code / Deployments tabs in the centre, and Ask AI, Share, Save and Deploy
 * on the right. Status details (version, save state, issues, model, members) live in
 * `WorkspaceStatusBar` at the bottom.
 */
export const AgentWorkflowHeader = memo(function AgentWorkflowHeader({
  workflowName,
  onWorkflowNameChange,
  status,
  isDirty = false,
  onSave,
  onDeploy,
  onGenerate,
  isValidated,
  onNavigateHome,
  onViewInstance,
  onShare,
  view,
  onViewChange,
  viewTabs,
}: AgentWorkflowHeaderProps) {
  const isDeployed = status === 'deployed'

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
      {/* Left: logo and workflow name */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {onNavigateHome ? (
          <button
            type="button"
            onClick={onNavigateHome}
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${APP_NAME} home`}
          >
            <Logo size={LOGO_SIZE_WORKSPACE} />
          </button>
        ) : (
          <Link to="/" className="shrink-0" aria-label={`${APP_NAME} home`}>
            <Logo size={LOGO_SIZE_WORKSPACE} />
          </Link>
        )}

        <div className="h-5 w-px shrink-0 bg-border" aria-hidden />

        <div className="flex min-w-0 items-center gap-1">
          <Input
            value={workflowName}
            onChange={(event) => onWorkflowNameChange(event.target.value)}
            className="h-8 w-36 min-w-0 border-transparent bg-transparent px-1.5 text-sm font-semibold shadow-none hover:bg-accent/60 focus-visible:border-input focus-visible:bg-background xl:w-48"
            aria-label="Workflow name"
          />
        </div>
      </div>

      {/* Centre: editor / code / deployments tabs */}
      {view && onViewChange ? <ViewTabs view={view} onViewChange={onViewChange} tabs={viewTabs} /> : null}

      {/* Right: Ask AI, share, then save / validate / deploy */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        {onGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            className="mr-1 flex h-8 items-center gap-2 rounded-md border border-border bg-background/60 pl-2.5 pr-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 2xl:w-56"
            aria-label="Ask Workflow AI"
            aria-keyshortcuts="Meta+K Control+K"
            title={`Ask Workflow AI (${ASK_AI_SHORTCUT_LABEL})`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-foreground" />
            <span className="min-w-0 flex-1 truncate">
              <span className="2xl:hidden">Ask AI</span>
              <span className="hidden 2xl:inline">Ask AI to build…</span>
            </span>
            <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-px font-sans text-[10px] font-medium text-muted-foreground">
              {ASK_AI_SHORTCUT_LABEL}
            </kbd>
          </button>
        ) : null}
        {onShare ? (
          <Button variant="ghost" size="sm" onClick={onShare} className="h-8 px-2 xl:px-3" aria-label="Share">
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Share</span>
          </Button>
        ) : null}

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

        <Button
          variant="ghost"
          size="icon"
          onClick={onSave}
          className="relative h-8 w-8"
          aria-label={isDirty ? 'Save draft (unsaved changes)' : 'Save draft'}
          title={isDirty ? 'Save draft — unsaved changes' : 'Save draft'}
        >
          <Save className="h-4 w-4" />
          {isDirty && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
          )}
        </Button>
        {isDeployed && onViewInstance && !onViewChange ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewInstance}
            className="hidden h-8 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 xl:inline-flex"
          >
            Deployments
          </Button>
        ) : null}
        <Button size="sm" disabled={!isValidated} onClick={onDeploy} className="h-8">
          <Rocket className="h-3.5 w-3.5" />
          <span>Deploy</span>
        </Button>
      </div>
    </header>
  )
})

/** n8n-style segmented tabs: a soft grey track with the active tab cut out in the page colour. */
function ViewTabs({
  view,
  onViewChange,
  tabs,
}: {
  view: EditorView
  onViewChange: (view: EditorView) => void
  tabs?: AgentWorkflowHeaderProps['viewTabs']
}) {
  const visibleTabs = useMemo(
    () =>
      tabs
        ? tabs
            .filter((tab) => tab.isVisible)
            .sort((a, b) => a.order - b.order)
            .map((tab) => ({ value: tab.id, label: tab.label }))
        : VIEW_TABS,
    [tabs],
  )
  return (
    <div role="tablist" aria-label="Editor view" className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5">
      {visibleTabs.map((tab) => {
        const active = view === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onViewChange(tab.value)}
            className={cn(
              'h-7 rounded-[5px] px-3 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
