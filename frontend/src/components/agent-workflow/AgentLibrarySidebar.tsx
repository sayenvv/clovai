import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Bot,
  CloudDownload,
  GitBranch,
  Plug,
  Plus,
  Search,
  Store,
  Terminal,
  Wrench,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/utils/cn'
import { DND_MIME } from '@/components/designer/diagram-types'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import {
  EXTERNAL_AGENT_BLOCKS,
  EXECUTOR_PALETTE_ID,
  MCP_TOOL_PALETTE_ID,
  SIDEBAR_BLOCKS,
  type SidebarBlock,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { ExternalAgentListItem } from '@/components/agent-workflow/external-agent-ui'
import {
  listMountableWorkflows,
  WorkflowListItem,
} from '@/components/agent-workflow/workflow-sidebar-ui'
import {
  AgentImportDialog,
  ExternalAgentImportSection,
} from '@/components/agent-workflow/external-agent-import-ui'
import { countAgentsInPage } from '@/components/agent-workflow/sub-workflow-ops'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import { WorkflowEmptyHint } from '@/components/agent-workflow/workflow-ui'
import { SettingsMenu } from '@/components/agent-workflow/SettingsMenu'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import { getSession } from '@/services/project-auth-store'
import type { DiagramDocument } from '@/components/designer/diagram-types'
import type { AgentType } from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import type { LucideIcon } from 'lucide-react'

type LibrarySection = 'blocks' | 'workflows' | 'store' | 'import'

interface AgentLibrarySidebarProps {
  onAddAgent: (paletteId: string) => void
  doc: DiagramDocument
  activePageId: string
  onMountWorkflow: (pageId: string) => void
  onCreateWorkflowTab?: () => void
  onOpenSettings?: () => void
  serverModelConfig?: WorkflowModelConfig
  llmConfigured?: boolean
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
}

const FLYOUT_MIN_WIDTH = 260

const SECTION_META: Record<LibrarySection, { title: string; subtitle: string }> = {
  blocks: {
    title: 'Built-in blocks',
    subtitle: 'Drag or click to add to the canvas',
  },
  workflows: {
    title: 'Workflows',
    subtitle: 'Reusable sub-workflows from other tabs',
  },
  store: {
    title: 'Agent store',
    subtitle: 'Third-party agent integrations',
  },
  import: {
    title: 'Import agents',
    subtitle: 'Pull agents from external platforms',
  },
}

const BLOCK_ICONS: Record<AgentType, LucideIcon> = {
  llm: Bot,
  tool: Wrench,
  specialist: Bot,
  planner: Bot,
  human: Bot,
  router: Bot,
  trigger: Bot,
  memory: Bot,
  output: Bot,
  control: Bot,
  executor: Terminal,
}

const BLOCK_STYLES: Record<string, { icon: string; hover: string }> = {
  agent: {
    icon: 'bg-red-500/10 text-red-600 dark:text-red-300',
    hover: 'hover:border-red-400/50 hover:bg-red-500/5',
  },
  tool: {
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
    hover: 'hover:border-blue-400/50 hover:bg-blue-500/5',
  },
  mcp: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    hover: 'hover:border-emerald-400/50 hover:bg-emerald-500/5',
  },
  skill: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    hover: 'hover:border-violet-400/50 hover:bg-violet-500/5',
  },
  integration: {
    icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    hover: 'hover:border-amber-400/50 hover:bg-amber-500/5',
  },
  executor: {
    icon: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
    hover: 'hover:border-orange-400/50 hover:bg-orange-500/5',
  },
}

function BlockTile({
  block,
  onAddAgent,
}: {
  block: SidebarBlock
  onAddAgent: (paletteId: string) => void
}) {
  const styles = BLOCK_STYLES[block.id === 'mcp-tool' ? 'mcp' : block.id] ?? BLOCK_STYLES.agent
  const Icon =
    block.paletteId === MCP_TOOL_PALETTE_ID
      ? Plug
      : block.paletteId === EXECUTOR_PALETTE_ID
        ? Terminal
        : block.id === 'tool'
          ? Wrench
          : (BLOCK_ICONS[block.agentType] ?? Bot)

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DND_MIME, block.paletteId)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAddAgent(block.paletteId)}
      title={block.description}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-border/70 bg-background p-2.5 text-left transition-colors',
        'cursor-grab active:cursor-grabbing',
        styles.hover,
      )}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', styles.icon)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-foreground">{block.label}</span>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
          {block.description}
        </p>
      </div>
    </button>
  )
}

function RailIconButton({
  label,
  icon: Icon,
  onClick,
  active,
  accent,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  active?: boolean
  accent?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'group/rail relative flex h-10 w-10 items-center justify-center rounded-[11px]',
            'text-muted-foreground transition-all duration-200 ease-out',
            'hover:bg-foreground/[0.06] hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            active && 'bg-foreground/[0.08] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]',
            accent && !active && 'text-foreground hover:bg-foreground/[0.08]',
            accent && active && 'bg-foreground/[0.1] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]',
          )}
        >
          {active ? (
            <span
              className="absolute top-1/2 left-[-11px] h-4 w-[3px] -translate-y-1/2 rounded-full bg-foreground/80"
              aria-hidden
            />
          ) : null}
          <Icon
            className={cn(
              'h-[18px] w-[18px] transition-transform duration-200',
              'group-hover/rail:scale-105',
            )}
            strokeWidth={accent ? 2.1 : 1.75}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={12}
        className="border-border/80 bg-popover/95 px-2.5 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export const AgentLibrarySidebar = memo(function AgentLibrarySidebar({
  onAddAgent,
  doc,
  activePageId,
  onMountWorkflow,
  onCreateWorkflowTab,
  onOpenSettings,
  serverModelConfig,
  llmConfigured = false,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
}: AgentLibrarySidebarProps) {
  const [section, setSection] = useState<LibrarySection | null>(null)
  const [query, setQuery] = useState('')
  const [importSourceId, setImportSourceId] = useState<string | null>(null)
  const [focusSearch, setFocusSearch] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const session = getSession()
  const userInitials = (session?.fullName || session?.email || 'U').slice(0, 1).toUpperCase()
  const userLabel = session
    ? [session.fullName || session.email, session.displayName].filter(Boolean).join(' · ')
    : undefined

  const flyoutOpen = section !== null
  const flyoutWidth = Math.max(width, FLYOUT_MIN_WIDTH)
  const totalWidth = SIDE_PANEL_COLLAPSED_WIDTH + (flyoutOpen ? flyoutWidth : 0)

  const closeFlyout = useCallback(() => {
    setSection(null)
    setQuery('')
    setFocusSearch(false)
    if (!collapsed) onToggleCollapse()
  }, [collapsed, onToggleCollapse])

  useEffect(() => {
    if (!focusSearch || section !== 'blocks') return
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [focusSearch, section])

  // Collapse the expandable section when clicking outside the library.
  useEffect(() => {
    if (!flyoutOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      // Keep open while an import dialog (portal) is active.
      if (importSourceId !== null) return
      if (target instanceof Element && target.closest('[role="dialog"], [data-radix-popper-content-wrapper]')) {
        return
      }
      closeFlyout()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [flyoutOpen, importSourceId, closeFlyout])

  const mountableWorkflows = useMemo(
    () => listMountableWorkflows(doc, activePageId),
    [doc, activePageId],
  )

  const filteredBlocks = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || section !== 'blocks') return SIDEBAR_BLOCKS
    return SIDEBAR_BLOCKS.filter(
      (block) =>
        block.label.toLowerCase().includes(needle) ||
        block.description.toLowerCase().includes(needle),
    )
  }, [query, section])

  const filteredStore = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || section !== 'store') return EXTERNAL_AGENT_BLOCKS
    return EXTERNAL_AGENT_BLOCKS.filter(
      (block) =>
        block.label.toLowerCase().includes(needle) ||
        block.provider.toLowerCase().includes(needle) ||
        (block.description?.toLowerCase().includes(needle) ?? false),
    )
  }, [query, section])

  const filteredWorkflows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || section !== 'workflows') return mountableWorkflows
    return mountableWorkflows.filter((page) => page.name.toLowerCase().includes(needle))
  }, [query, section, mountableWorkflows])

  const openSection = (next: LibrarySection, options?: { focusSearch?: boolean }) => {
    setQuery('')
    setFocusSearch(Boolean(options?.focusSearch))
    setSection((previous) => {
      const closing = previous === next && !options?.focusSearch
      if (closing) {
        if (!collapsed) onToggleCollapse()
        setFocusSearch(false)
        return null
      }
      if (collapsed) onToggleCollapse()
      return next
    })
  }

  const meta = section ? SECTION_META[section] : null

  return (
    <>
      <aside
        ref={rootRef}
        className={cn(
          'relative flex h-full shrink-0 border-r border-border/70',
          'bg-background',
        )}
        style={{ width: totalWidth }}
      >
        {flyoutOpen && (
          <DesignerResizeHandle
            side="right"
            onPointerDown={onResizePointerDown}
            ariaLabel="Resize library panel"
          />
        )}

        {/* Premium icon rail */}
        <div
          className={cn(
            'relative flex h-full shrink-0 flex-col',
            'bg-gradient-to-b from-muted/40 via-background to-muted/30',
            flyoutOpen ? 'border-r border-border/60' : '',
          )}
          style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-border/80 to-transparent"
            aria-hidden
          />

          <TooltipProvider delayDuration={180}>
            <div className="flex flex-1 flex-col items-center px-2 py-3">
              <div className="flex w-full flex-col items-center gap-1">
                <RailIconButton
                  label="Add block"
                  icon={Plus}
                  accent
                  active={section === 'blocks' && !focusSearch}
                  onClick={() => openSection('blocks')}
                />
                <RailIconButton
                  label="Search blocks"
                  icon={Search}
                  active={section === 'blocks' && focusSearch}
                  onClick={() => openSection('blocks', { focusSearch: true })}
                />
              </div>

              <div className="my-3 h-px w-6 bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />

              <div className="flex w-full flex-col items-center gap-1">
                <RailIconButton
                  label="Workflows"
                  icon={GitBranch}
                  active={section === 'workflows'}
                  onClick={() => openSection('workflows')}
                />
                {EXTERNAL_AGENT_BLOCKS.length > 0 && (
                  <RailIconButton
                    label="Agent store"
                    icon={Store}
                    active={section === 'store'}
                    onClick={() => openSection('store')}
                  />
                )}
                <RailIconButton
                  label="Import agents"
                  icon={CloudDownload}
                  active={section === 'import'}
                  onClick={() => openSection('import')}
                />
              </div>

              <div className="mt-auto flex w-full flex-col items-center gap-1.5 pt-3">
                <div className="h-px w-6 bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />
                <SettingsMenu
                  onOpenWorkflowSettings={onOpenSettings}
                  modelConfig={serverModelConfig}
                  llmConfigured={llmConfigured}
                  side="right"
                  align="end"
                />
                <div
                  className="rounded-full p-0.5 shadow-[0_0_0_1px_hsl(var(--border)/0.7)] transition-shadow duration-200 hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.22)]"
                  title="Profile"
                >
                  <ProfileMenu
                    showSignOut={Boolean(session)}
                    userInitials={userInitials}
                    userLabel={userLabel}
                    side="right"
                    align="end"
                    avatarSize="sm"
                    triggerClassName="h-9 w-9 rounded-full hover:bg-transparent"
                  />
                </div>
              </div>
            </div>
          </TooltipProvider>
        </div>

        {/* Expandable section */}
        {flyoutOpen && meta ? (
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col bg-background',
              'animate-in fade-in-0 slide-in-from-left-1 duration-200',
            )}
            style={{ width: flyoutWidth }}
          >
            <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
              <h2 className="truncate text-sm font-semibold text-foreground">{meta.title}</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{meta.subtitle}</p>
            </div>

            {(section === 'blocks' || section === 'store' || section === 'workflows') && (
              <div className="shrink-0 border-b border-border/60 px-3 py-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search…"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {section === 'blocks' && (
                <div className="space-y-2">
                  {filteredBlocks.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No blocks match.</p>
                  ) : (
                    filteredBlocks.map((block) => (
                      <BlockTile key={block.id} block={block} onAddAgent={onAddAgent} />
                    ))
                  )}
                </div>
              )}

              {section === 'workflows' &&
                (filteredWorkflows.length > 0 ? (
                  <div className="space-y-1.5">
                    {filteredWorkflows.map((page) => (
                      <WorkflowListItem
                        key={page.id}
                        page={page}
                        agentCount={countAgentsInPage(doc, page.id)}
                        onMount={onMountWorkflow}
                        compact
                      />
                    ))}
                  </div>
                ) : mountableWorkflows.length === 0 ? (
                  <WorkflowEmptyHint compact onCreateTab={onCreateWorkflowTab} />
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">No workflows match.</p>
                ))}

              {section === 'store' && (
                <div className="space-y-1.5">
                  {filteredStore.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No agents match.</p>
                  ) : (
                    filteredStore.map((block) => (
                      <ExternalAgentListItem
                        key={block.id}
                        block={block}
                        onAddAgent={onAddAgent}
                        draggable
                      />
                    ))
                  )}
                </div>
              )}

              {section === 'import' && (
                <ExternalAgentImportSection
                  onOpenImport={setImportSourceId}
                  collapsed={false}
                  embedded
                />
              )}
            </div>
          </div>
        ) : null}
      </aside>

      <AgentImportDialog
        sourceId={importSourceId}
        open={importSourceId !== null}
        onOpenChange={(open) => {
          if (!open) setImportSourceId(null)
        }}
      />
    </>
  )
})
