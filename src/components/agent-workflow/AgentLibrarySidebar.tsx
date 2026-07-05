import { memo, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Bot,
  ChevronRight,
  GitBranch,
  CloudDownload,
  Layers,
  PanelLeftClose,
  Plus,
  Store,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'
import { DND_MIME } from '@/components/designer/diagram-types'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { AgentStoreDialog } from '@/components/agent-workflow/AgentStoreDialog'
import {
  EXTERNAL_AGENT_BLOCKS,
  SIDEBAR_BLOCKS,
  type SidebarBlock,
} from '@/components/agent-workflow/agent-workflow-defaults'
import {
  ExternalAgentListItem,
  sidebarPreviewAgents,
} from '@/components/agent-workflow/external-agent-ui'
import {
  listMountableWorkflows,
  SIDEBAR_WORKFLOW_PREVIEW_LIMIT,
  WorkflowListItem,
  WorkflowStoreDialog,
} from '@/components/agent-workflow/workflow-sidebar-ui'
import {
  AzureFoundryImportDialog,
  ExternalAgentImportSection,
} from '@/components/agent-workflow/external-agent-import-ui'
import { countAgentsInPage } from '@/components/agent-workflow/sub-workflow-ops'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import type { DiagramDocument } from '@/components/designer/diagram-types'
import type { AgentType } from '@/types/agent-workflow'
import type { LucideIcon } from 'lucide-react'

interface AgentLibrarySidebarProps {
  onAddAgent: (paletteId: string) => void
  doc: DiagramDocument
  activePageId: string
  onMountWorkflow: (pageId: string) => void
  onCreateWorkflowTab?: () => void
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
}

const SIDEBAR_PREVIEW_LIMIT = 3

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
}

const BLOCK_STYLES: Record<string, { icon: string; hover: string }> = {
  agent: {
    icon: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    hover: 'hover:border-violet-400/50 hover:bg-violet-500/5',
  },
  tool: {
    icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
    hover: 'hover:border-blue-400/50 hover:bg-blue-500/5',
  },
}

function BlockTile({
  block,
  onAddAgent,
}: {
  block: SidebarBlock
  onAddAgent: (paletteId: string) => void
}) {
  const Icon = BLOCK_ICONS[block.agentType] ?? Bot
  const styles = BLOCK_STYLES[block.id] ?? BLOCK_STYLES.agent

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
        'flex flex-col items-center gap-2.5 rounded-xl border border-border/70 bg-background p-4 text-center transition-all',
        'cursor-grab active:cursor-grabbing',
        styles.hover,
      )}
    >
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', styles.icon)}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-semibold text-foreground">{block.label}</span>
    </button>
  )
}

export const AgentLibrarySidebar = memo(function AgentLibrarySidebar({
  onAddAgent,
  doc,
  activePageId,
  onMountWorkflow,
  onCreateWorkflowTab,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
}: AgentLibrarySidebarProps) {
  const [storeOpen, setStoreOpen] = useState(false)
  const [workflowStoreOpen, setWorkflowStoreOpen] = useState(false)
  const [foundryImportOpen, setFoundryImportOpen] = useState(false)

  const previewAgents = useMemo(
    () => sidebarPreviewAgents(EXTERNAL_AGENT_BLOCKS, SIDEBAR_PREVIEW_LIMIT),
    [],
  )

  const mountableWorkflows = useMemo(
    () => listMountableWorkflows(doc, activePageId),
    [doc, activePageId],
  )

  const previewWorkflows = useMemo(
    () => mountableWorkflows.slice(0, SIDEBAR_WORKFLOW_PREVIEW_LIMIT),
    [mountableWorkflows],
  )

  if (collapsed) {
    return (
      <>
        <aside
          className="relative flex h-full shrink-0 flex-col border-r border-border bg-card/50"
          style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
        >
          <div className="flex flex-col items-center gap-2 border-b border-border py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleCollapse}
              aria-label="Expand blocks panel"
              title="Expand blocks"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
              Blocks
            </span>
            {onCreateWorkflowTab && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWorkflowStoreOpen(true)}
                aria-label="Open workflow library"
                title="Workflow library"
              >
                <GitBranch className="h-4 w-4" />
              </Button>
            )}
            {EXTERNAL_AGENT_BLOCKS.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setStoreOpen(true)}
                aria-label="Open agent store"
                title="Agent store"
              >
                <Store className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setFoundryImportOpen(true)}
              aria-label="Import from Azure AI Foundry"
              title="Import agents"
            >
              <CloudDownload className="h-4 w-4" />
            </Button>
          </div>
        </aside>
        <AgentStoreDialog
          open={storeOpen}
          onOpenChange={setStoreOpen}
          onAddAgent={onAddAgent}
        />
        <WorkflowStoreDialog
          open={workflowStoreOpen}
          onOpenChange={setWorkflowStoreOpen}
          doc={doc}
          activePageId={activePageId}
          onMountWorkflow={onMountWorkflow}
          onCreateWorkflowTab={onCreateWorkflowTab}
        />
        <AzureFoundryImportDialog open={foundryImportOpen} onOpenChange={setFoundryImportOpen} />
      </>
    )
  }

  return (
    <>
      <aside
        className="relative flex h-full shrink-0 flex-col border-r border-border bg-card/50"
        style={{ width }}
      >
        <DesignerResizeHandle
          side="right"
          onPointerDown={onResizePointerDown}
          ariaLabel="Resize blocks panel"
        />

        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Agent library</h2>
            <p className="text-[10px] text-muted-foreground">Drag blocks onto the canvas</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleCollapse}
            aria-label="Collapse blocks panel"
            title="Collapse panel"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-2 px-0.5">
            <h3 className="text-xs font-semibold text-foreground">Built-in blocks</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SIDEBAR_BLOCKS.map((block) => (
              <BlockTile key={block.id} block={block} onAddAgent={onAddAgent} />
            ))}
          </div>

          <section className="mt-6 border-t border-border pt-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-foreground">Workflows</h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Reusable sub-workflows from other tabs
                </p>
              </div>
              {mountableWorkflows.length > 0 && (
                <Badge variant="outline" className="h-5 shrink-0 text-[10px] font-normal tabular-nums">
                  {mountableWorkflows.length}
                </Badge>
              )}
            </div>

            {previewWorkflows.length > 0 ? (
              <>
                <div className="space-y-1.5">
                  {previewWorkflows.map((page) => (
                    <WorkflowListItem
                      key={page.id}
                      page={page}
                      agentCount={countAgentsInPage(doc, page.id)}
                      onMount={onMountWorkflow}
                      compact
                    />
                  ))}
                </div>

                {mountableWorkflows.length > SIDEBAR_WORKFLOW_PREVIEW_LIMIT && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 h-9 w-full justify-between gap-2 px-3 text-xs"
                    onClick={() => setWorkflowStoreOpen(true)}
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5" />
                      Workflow library
                    </span>
                    <span className="text-muted-foreground">
                      See all ({mountableWorkflows.length})
                    </span>
                  </Button>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-indigo-500/25 bg-indigo-500/5 px-3 py-4 text-center">
                <p className="text-[11px] font-medium text-foreground">No other workflows</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Add a tab and build a workflow, then mount it here.
                </p>
                {onCreateWorkflowTab && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3 h-8 gap-1.5 text-xs"
                    onClick={onCreateWorkflowTab}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New workflow tab
                  </Button>
                )}
              </div>
            )}
          </section>

          {EXTERNAL_AGENT_BLOCKS.length > 0 && (
            <section className="mt-6 border-t border-border pt-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-foreground">External integrations</h3>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Featured third-party agents</p>
                </div>
                <Badge variant="outline" className="h-5 shrink-0 text-[10px] font-normal tabular-nums">
                  {EXTERNAL_AGENT_BLOCKS.length}
                </Badge>
              </div>

              <div className="space-y-1.5">
                {previewAgents.map((block) => (
                  <ExternalAgentListItem
                    key={block.id}
                    block={block}
                    onAddAgent={onAddAgent}
                    draggable
                  />
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-9 w-full justify-between gap-2 px-3 text-xs"
                onClick={() => setStoreOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <Store className="h-3.5 w-3.5" />
                  Agent store
                </span>
                <span className="text-muted-foreground">
                  See all ({EXTERNAL_AGENT_BLOCKS.length})
                </span>
              </Button>
            </section>
          )}

          <ExternalAgentImportSection onOpenFoundryImport={() => setFoundryImportOpen(true)} />
        </div>
      </aside>

      <AgentStoreDialog
        open={storeOpen}
        onOpenChange={setStoreOpen}
        onAddAgent={onAddAgent}
      />
      <WorkflowStoreDialog
        open={workflowStoreOpen}
        onOpenChange={setWorkflowStoreOpen}
        doc={doc}
        activePageId={activePageId}
        onMountWorkflow={onMountWorkflow}
        onCreateWorkflowTab={onCreateWorkflowTab}
      />
      <AzureFoundryImportDialog open={foundryImportOpen} onOpenChange={setFoundryImportOpen} />
    </>
  )
})
