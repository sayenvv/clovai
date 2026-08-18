import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Bot,
  CloudDownload,
  GitBranch,
  GripVertical,
  LayoutGrid,
  List,
  Plug,
  Plus,
  Rocket,
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
import { OPEN_LIBRARY_DEPLOYMENTS_EVENT } from '@/components/agent-workflow/deployments-sidebar-ui'
import { SettingsMenu } from '@/components/agent-workflow/SettingsMenu'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import { getSession } from '@/services/project-auth-store'
import type { DiagramDocument } from '@/components/designer/diagram-types'
import type { AgentType } from '@/types/agent-workflow'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import type { LucideIcon } from 'lucide-react'

export type LibrarySection = 'blocks' | 'workflows' | 'store' | 'import' | 'deployments'

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
  /** Fill parent (mobile drawer) — flyout open by default, no resize handle. */
  embedded?: boolean
  /** Active library section — used to highlight Deployments when the canvas board is open. */
  activeSection?: LibrarySection | null
  onSectionChange?: (section: LibrarySection | null) => void
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
  deployments: {
    title: 'Deployments',
    subtitle: 'Published workflow instances for this account',
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

const BLOCK_STYLES: Record<string, { icon: string; ring: string }> = {
  agent: {
    icon: 'bg-red-500/10 text-red-600 dark:text-red-300',
    ring: 'ring-red-500/20',
  },
  tool: {
    icon: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    ring: 'ring-sky-500/20',
  },
  mcp: {
    icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    ring: 'ring-emerald-500/20',
  },
  skill: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    ring: 'ring-violet-500/20',
  },
  integration: {
    icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/20',
  },
  executor: {
    icon: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
    ring: 'ring-orange-500/20',
  },
}

const BLOCK_KIND_LABELS: Record<string, string> = {
  agent: 'Agent',
  tool: 'Tool',
  'mcp-tool': 'MCP',
  skill: 'Skill',
  integration: 'Integration',
  executor: 'Executor',
}

function resolveBlockVisual(block: SidebarBlock) {
  const styles = BLOCK_STYLES[block.id === 'mcp-tool' ? 'mcp' : block.id] ?? BLOCK_STYLES.agent
  const Icon =
    block.paletteId === MCP_TOOL_PALETTE_ID
      ? Plug
      : block.paletteId === EXECUTOR_PALETTE_ID
        ? Terminal
        : block.id === 'tool'
          ? Wrench
          : (BLOCK_ICONS[block.agentType] ?? Bot)
  const kindLabel = BLOCK_KIND_LABELS[block.id] ?? block.label
  return { styles, Icon, kindLabel }
}

function BlockTile({
  block,
  onAddAgent,
}: {
  block: SidebarBlock
  onAddAgent: (paletteId: string) => void
}) {
  const { styles, Icon, kindLabel } = resolveBlockVisual(block)

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DND_MIME, block.paletteId)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAddAgent(block.paletteId)}
      title={`Add ${block.label} · ${block.description}`}
      className={cn(
        'group relative flex w-full items-start gap-2.5 rounded-lg border border-border bg-card p-2.5 text-left shadow-sm',
        'cursor-grab transition-all duration-150 active:cursor-grabbing',
        'hover:border-foreground/20 hover:shadow-md',
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
          styles.icon,
          styles.ring,
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 pr-4">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] font-semibold leading-tight text-foreground">
            {block.label}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">
          {block.description}
        </p>
        <span className="mt-1.5 inline-flex items-center rounded border border-border/60 bg-muted/60 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {kindLabel}
        </span>
      </div>
      <GripVertical
        className="absolute right-2 top-2.5 size-3.5 text-muted-foreground/0 transition-colors duration-150 group-hover:text-muted-foreground/50"
        aria-hidden
      />
    </button>
  )
}

function GridBlockTile({
  block,
  onAddAgent,
}: {
  block: SidebarBlock
  onAddAgent: (paletteId: string) => void
}) {
  const { styles, Icon, kindLabel } = resolveBlockVisual(block)

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DND_MIME, block.paletteId)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onAddAgent(block.paletteId)}
      title={`Add ${block.label} · ${block.description}`}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-3 text-center shadow-sm',
        'cursor-grab transition-all duration-150 active:cursor-grabbing',
        'hover:border-foreground/20 hover:shadow-md',
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
          styles.icon,
          styles.ring,
        )}
      >
        <Icon className="size-4" />
      </div>
      <span className="line-clamp-1 w-full text-[11px] font-semibold leading-tight text-foreground">
        {block.label}
      </span>
      <span className="text-[8.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {kindLabel}
      </span>
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
  embedded = false,
  activeSection,
  onSectionChange,
}: AgentLibrarySidebarProps) {
  const [section, setSection] = useState<LibrarySection | null>(
    embedded ? 'blocks' : null,
  )
  const resolvedSection = activeSection !== undefined ? activeSection : section
  const [query, setQuery] = useState('')
  const [blocksView, setBlocksView] = useState<'list' | 'grid'>('grid')
  const [importSourceId, setImportSourceId] = useState<string | null>(null)
  const [focusSearch, setFocusSearch] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const session = getSession()
  const userInitials = (session?.fullName || session?.email || 'U').slice(0, 1).toUpperCase()
  const userLabel = session
    ? [session.fullName || session.email, session.displayName].filter(Boolean).join(' · ')
    : undefined

  // Deployments opens in the main canvas — keep the rail highlighted, no flyout.
  const flyoutOpen = resolvedSection !== null && resolvedSection !== 'deployments'
  const flyoutWidth = Math.max(width, FLYOUT_MIN_WIDTH)
  const totalWidth = embedded
    ? '100%'
    : SIDE_PANEL_COLLAPSED_WIDTH + (flyoutOpen ? flyoutWidth : 0)

  const closeFlyout = useCallback(() => {
    setSection(null)
    onSectionChange?.(null)
    setQuery('')
    setFocusSearch(false)
    if (!collapsed) onToggleCollapse()
  }, [collapsed, onToggleCollapse, onSectionChange])

  useEffect(() => {
    if (!focusSearch || resolvedSection !== 'blocks') return
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [focusSearch, resolvedSection])

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
    if (!needle || resolvedSection !== 'blocks') return SIDEBAR_BLOCKS
    return SIDEBAR_BLOCKS.filter(
      (block) =>
        block.label.toLowerCase().includes(needle) ||
        block.description.toLowerCase().includes(needle),
    )
  }, [query, resolvedSection])

  const filteredStore = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || resolvedSection !== 'store') return EXTERNAL_AGENT_BLOCKS
    return EXTERNAL_AGENT_BLOCKS.filter(
      (block) =>
        block.label.toLowerCase().includes(needle) ||
        block.provider.toLowerCase().includes(needle) ||
        (block.description?.toLowerCase().includes(needle) ?? false),
    )
  }, [query, resolvedSection])

  const filteredWorkflows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || resolvedSection !== 'workflows') return mountableWorkflows
    return mountableWorkflows.filter((page) => page.name.toLowerCase().includes(needle))
  }, [query, resolvedSection, mountableWorkflows])

  const setActiveSection = useCallback(
    (next: LibrarySection | null) => {
      setSection(next)
      onSectionChange?.(next)
    },
    [onSectionChange],
  )

  const openSection = (next: LibrarySection, options?: { focusSearch?: boolean }) => {
    setQuery('')
    setFocusSearch(Boolean(options?.focusSearch))
    const current = resolvedSection
    const closing = current === next && !options?.focusSearch
    if (closing) {
      if (!collapsed && next !== 'deployments') onToggleCollapse()
      setFocusSearch(false)
      setActiveSection(null)
      return
    }
    if (next !== 'deployments' && collapsed) onToggleCollapse()
    setActiveSection(next)
  }

  useEffect(() => {
    const openDeployments = () => {
      setQuery('')
      setFocusSearch(false)
      setActiveSection('deployments')
    }
    window.addEventListener(OPEN_LIBRARY_DEPLOYMENTS_EVENT, openDeployments)
    return () => window.removeEventListener(OPEN_LIBRARY_DEPLOYMENTS_EVENT, openDeployments)
  }, [setActiveSection])

  const meta =
    resolvedSection && resolvedSection !== 'deployments'
      ? SECTION_META[resolvedSection]
      : null

  return (
    <>
      <aside
        ref={rootRef}
        className={cn(
          'relative flex h-full shrink-0 border-r border-border/70',
          'bg-background',
          embedded && 'w-full border-r-0',
        )}
        style={{ width: totalWidth }}
      >
        {flyoutOpen && !embedded && (
          <DesignerResizeHandle
            side="right"
            onPointerDown={onResizePointerDown}
            ariaLabel="Resize library panel"
          />
        )}

        {/* Premium icon rail */}
        {!embedded && (
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
            <div className="flex h-full min-h-0 flex-col items-center px-2 py-3">
              <div className="flex w-full shrink-0 flex-col items-center gap-1">
                <RailIconButton
                  label="Add block"
                  icon={Plus}
                  accent
                  active={resolvedSection === 'blocks' && !focusSearch}
                  onClick={() => openSection('blocks')}
                />
                <RailIconButton
                  label="Search blocks"
                  icon={Search}
                  active={resolvedSection === 'blocks' && focusSearch}
                  onClick={() => openSection('blocks', { focusSearch: true })}
                />
              </div>

              <div className="my-3 h-px w-6 shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />

              <div className="flex w-full shrink-0 flex-col items-center gap-1">
                <RailIconButton
                  label="Workflows"
                  icon={GitBranch}
                  active={resolvedSection === 'workflows'}
                  onClick={() => openSection('workflows')}
                />
                {EXTERNAL_AGENT_BLOCKS.length > 0 && (
                  <RailIconButton
                    label="Agent store"
                    icon={Store}
                    active={resolvedSection === 'store'}
                    onClick={() => openSection('store')}
                  />
                )}
                <RailIconButton
                  label="Import agents"
                  icon={CloudDownload}
                  active={resolvedSection === 'import'}
                  onClick={() => openSection('import')}
                />
                <RailIconButton
                  label="Deployments"
                  icon={Rocket}
                  active={resolvedSection === 'deployments'}
                  onClick={() => openSection('deployments')}
                />
              </div>

              <div className="min-h-2 flex-1" aria-hidden />

              <div className="flex w-full shrink-0 flex-col items-center gap-1.5">
                <div className="mb-1 h-px w-6 bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />
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
        )}

        {/* Expandable section */}
        {flyoutOpen && meta ? (
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-col bg-background',
              !embedded && 'animate-in fade-in-0 slide-in-from-left-1 duration-200',
            )}
            style={embedded ? undefined : { width: flyoutWidth }}
          >
            {!embedded && (
            <div className="shrink-0 border-b border-border/60 px-3 py-2.5">
              <h2 className="truncate text-sm font-semibold text-foreground">{meta.title}</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{meta.subtitle}</p>
            </div>
            )}

            {embedded && (
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 px-2 py-2">
                {(
                  [
                    ['blocks', 'Blocks'],
                    ['workflows', 'Workflows'],
                    ['store', 'Store'],
                    ['import', 'Import'],
                    ['deployments', 'Deployments'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveSection(id)
                      setQuery('')
                    }}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap',
                      resolvedSection === id
                        ? 'bg-foreground/[0.08] text-foreground'
                        : 'text-muted-foreground hover:bg-foreground/[0.06]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {(resolvedSection === 'blocks' ||
              resolvedSection === 'store' ||
              resolvedSection === 'workflows') && (
              <div className="shrink-0 border-b border-border/60 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search…"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  {resolvedSection === 'blocks' && (
                    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
                      <button
                        type="button"
                        aria-label="List view"
                        aria-pressed={blocksView === 'list'}
                        onClick={() => setBlocksView('list')}
                        className={cn(
                          'flex size-6 items-center justify-center rounded transition-colors duration-150',
                          blocksView === 'list'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <List className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Grid view"
                        aria-pressed={blocksView === 'grid'}
                        onClick={() => setBlocksView('grid')}
                        className={cn(
                          'flex size-6 items-center justify-center rounded transition-colors duration-150',
                          blocksView === 'grid'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <LayoutGrid className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {resolvedSection === 'blocks' && (
                filteredBlocks.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No blocks match.</p>
                ) : blocksView === 'grid' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredBlocks.map((block) => (
                      <GridBlockTile key={block.id} block={block} onAddAgent={onAddAgent} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredBlocks.map((block) => (
                      <BlockTile key={block.id} block={block} onAddAgent={onAddAgent} />
                    ))}
                  </div>
                )
              )}

              {resolvedSection === 'workflows' &&
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

              {resolvedSection === 'store' && (
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

              {resolvedSection === 'import' && (
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
