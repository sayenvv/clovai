import { memo, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Bot,
  ChevronRight,
  CloudDownload,
  GitBranch,
  Layers,
  PanelLeftClose,
  Store,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { DND_MIME } from '@/components/designer/diagram-types'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { AgentStoreDialog } from '@/components/agent-workflow/AgentStoreDialog'
import {
  EXTERNAL_AGENT_BLOCKS,
  SIDEBAR_BLOCKS,
  SIDEBAR_PREVIEW_LIMIT,
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
  AgentImportDialog,
  ExternalAgentImportSection,
} from '@/components/agent-workflow/external-agent-import-ui'
import { countAgentsInPage } from '@/components/agent-workflow/sub-workflow-ops'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import { SidebarSection, WorkflowEmptyHint } from '@/components/agent-workflow/workflow-ui'
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

function SidebarCatalogDialogs({
  storeOpen,
  setStoreOpen,
  workflowStoreOpen,
  setWorkflowStoreOpen,
  importSourceId,
  setImportSourceId,
  doc,
  activePageId,
  onAddAgent,
  onMountWorkflow,
  onCreateWorkflowTab,
}: {
  storeOpen: boolean
  setStoreOpen: (open: boolean) => void
  workflowStoreOpen: boolean
  setWorkflowStoreOpen: (open: boolean) => void
  importSourceId: string | null
  setImportSourceId: (id: string | null) => void
  doc: DiagramDocument
  activePageId: string
  onAddAgent: (paletteId: string) => void
  onMountWorkflow: (pageId: string) => void
  onCreateWorkflowTab?: () => void
}) {
  return (
    <>
      <AgentStoreDialog open={storeOpen} onOpenChange={setStoreOpen} onAddAgent={onAddAgent} />
      <WorkflowStoreDialog
        open={workflowStoreOpen}
        onOpenChange={setWorkflowStoreOpen}
        doc={doc}
        activePageId={activePageId}
        onMountWorkflow={onMountWorkflow}
        onCreateWorkflowTab={onCreateWorkflowTab}
      />
      <AgentImportDialog
        sourceId={importSourceId}
        open={importSourceId !== null}
        onOpenChange={(open) => {
          if (!open) setImportSourceId(null)
        }}
      />
    </>
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
  const [importSourceId, setImportSourceId] = useState<string | null>(null)

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

  const dialogs = (
    <SidebarCatalogDialogs
      storeOpen={storeOpen}
      setStoreOpen={setStoreOpen}
      workflowStoreOpen={workflowStoreOpen}
      setWorkflowStoreOpen={setWorkflowStoreOpen}
      importSourceId={importSourceId}
      setImportSourceId={setImportSourceId}
      doc={doc}
      activePageId={activePageId}
      onAddAgent={onAddAgent}
      onMountWorkflow={onMountWorkflow}
      onCreateWorkflowTab={onCreateWorkflowTab}
    />
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
              onClick={() => setImportSourceId('azure-foundry')}
              aria-label="Import agents"
              title="Import agents"
            >
              <CloudDownload className="h-4 w-4" />
            </Button>
          </div>
        </aside>
        {dialogs}
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
          <SidebarSection title="Built-in blocks" />
          <div className="grid grid-cols-2 gap-2">
            {SIDEBAR_BLOCKS.map((block) => (
              <BlockTile key={block.id} block={block} onAddAgent={onAddAgent} />
            ))}
          </div>

          <section className="mt-6 border-t border-border pt-4">
            <SidebarSection
              title="Workflows"
              subtitle="Reusable sub-workflows from other tabs"
              count={mountableWorkflows.length > 0 ? mountableWorkflows.length : undefined}
            />

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
              <WorkflowEmptyHint compact onCreateTab={onCreateWorkflowTab} />
            )}
          </section>

          {EXTERNAL_AGENT_BLOCKS.length > 0 && (
            <section className="mt-6 border-t border-border pt-4">
              <SidebarSection
                title="External integrations"
                subtitle="Featured third-party agents"
                count={EXTERNAL_AGENT_BLOCKS.length}
              />
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

          <ExternalAgentImportSection onOpenImport={setImportSourceId} />
        </div>
      </aside>
      {dialogs}
    </>
  )
})
