import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import { Bot, ChevronLeft, GitBranch, MousePointerClick, PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DesignerResizeHandle } from '@/components/designer/DesignerResizeHandle'
import { WorkspaceMembersFacepile } from '@/components/designer/WorkspaceMembersFacepile'
import { WorkspaceMembersPanel } from '@/components/designer/WorkspaceMembersPanel'
import { AgentConfigPanel } from '@/components/agent-workflow/AgentConfigPanel'
import { ConnectorConfigPanel } from '@/components/agent-workflow/ConnectorConfigPanel'
import { ToolConfigPanel } from '@/components/agent-workflow/ToolConfigPanel'
import { SubWorkflowConfigPanel } from '@/components/agent-workflow/SubWorkflowConfigPanel'
import {
  agentLabel,
  isToolNode,
} from '@/components/agent-workflow/tool-agent-mapping'
import { isSubWorkflowNode } from '@/components/agent-workflow/sub-workflow-ops'
import { SIDE_PANEL_COLLAPSED_WIDTH } from '@/components/agent-workflow/panel-layout'
import { useShareSettings, workspaceMemberCount } from '@/components/designer/share-settings'
import { cn } from '@/utils/cn'
import type { Selection } from '@/components/designer/selection-utils'
import type { Diagram, DiagramDocument, DiagramEdge, DiagramNode } from '@/components/designer/diagram-types'

export type RightPanelTab = 'details' | 'collaborators'

const TAB_TRIGGER_CLASS =
  'h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-violet-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none'

interface AgentPropertiesShellProps {
  diagram: Diagram
  doc: DiagramDocument
  selection: Selection
  onChange: (updater: (previous: Diagram) => Diagram) => void
  width: number
  collapsed: boolean
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleCollapse: () => void
  toolId: string
  activeTab: RightPanelTab
  onTabChange: (tab: RightPanelTab) => void
  onManageAccess?: () => void
  onOpenSubWorkflow?: (pageId: string) => void
  onConvertToSubWorkflow?: () => void
  canConvertToSubWorkflow?: boolean
}

export const AgentPropertiesShell = memo(function AgentPropertiesShell({
  diagram,
  doc,
  selection,
  onChange,
  width,
  collapsed,
  onResizePointerDown,
  onToggleCollapse,
  toolId,
  activeTab,
  onTabChange,
  onManageAccess,
  onOpenSubWorkflow,
  onConvertToSubWorkflow,
  canConvertToSubWorkflow = false,
}: AgentPropertiesShellProps) {
  const { settings } = useShareSettings(toolId)
  const memberTotal = workspaceMemberCount(settings)

  const selectedNode: DiagramNode | undefined =
    selection?.kind === 'node' ? diagram.nodes.find((node) => node.id === selection.id) : undefined
  const selectedEdge: DiagramEdge | undefined =
    selection?.kind === 'edge' ? diagram.edges.find((edge) => edge.id === selection.id) : undefined

  const fromLabel =
    selectedEdge && diagram.nodes.find((node) => node.id === selectedEdge.from)?.label
  const toLabel = selectedEdge && diagram.nodes.find((node) => node.id === selectedEdge.to)?.label

  const multiSelectCount = selection?.kind === 'nodes' ? selection.ids.length : 0

  const detailsTitle =
    multiSelectCount > 0
      ? `${multiSelectCount} selected`
      : selection?.kind === 'node' && selectedNode
        ? selectedNode.label
        : selection?.kind === 'edge'
          ? 'Connector'
          : 'Details'

  const panelTitle = activeTab === 'collaborators' ? 'Collaborators' : detailsTitle

  const detailsSubtitle =
    selection?.kind === 'edge' && selectedEdge
      ? `${fromLabel ?? 'Source'} → ${toLabel ?? 'Target'}`
      : selection?.kind === 'node' && selectedNode && isToolNode(selectedNode)
        ? `Under ${agentLabel(diagram, selectedNode.mappedAgentId)}`
        : null

  if (collapsed) {
    return (
      <aside
        className="relative flex h-full shrink-0 flex-col border-l border-border bg-card/50"
        style={{ width: SIDE_PANEL_COLLAPSED_WIDTH }}
      >
        <div className="flex flex-col items-center gap-2 border-b border-border py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleCollapse}
            aria-label="Expand right panel"
            title="Expand panel"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl]">
            Panel
          </span>
          <Button
            variant={activeTab === 'details' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              onTabChange('details')
              onToggleCollapse()
            }}
            aria-label="Details"
            title="Details"
          >
            <MousePointerClick className="h-4 w-4" />
          </Button>
          <button
            type="button"
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg p-1 transition-colors',
              activeTab === 'collaborators' ? 'bg-muted' : 'hover:bg-muted/60',
            )}
            onClick={() => {
              onTabChange('collaborators')
              onToggleCollapse()
            }}
            aria-label="Collaborators"
            title="Collaborators"
          >
            <WorkspaceMembersFacepile
              toolId={toolId}
              maxVisible={3}
              showOverflow={false}
              orientation="vertical"
            />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-card/50"
      style={{ width }}
    >
      <DesignerResizeHandle
        side="left"
        onPointerDown={onResizePointerDown}
        ariaLabel="Resize right panel"
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => onTabChange(value as RightPanelTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border pr-2">
          <TabsList className="h-9 bg-transparent p-0 pl-2">
            <TabsTrigger value="details" className={TAB_TRIGGER_CLASS}>
              <MousePointerClick className="mr-1.5 h-3.5 w-3.5" />
              Details
            </TabsTrigger>
            <TabsTrigger value="collaborators" className={cn(TAB_TRIGGER_CLASS, 'gap-2')}>
              <WorkspaceMembersFacepile toolId={toolId} maxVisible={3} className="mr-0.5" />
              Collaborators
            </TabsTrigger>
          </TabsList>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggleCollapse}
            aria-label="Collapse right panel"
            title="Collapse panel"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-3 py-2">
          {activeTab === 'collaborators' && (
            <WorkspaceMembersFacepile toolId={toolId} maxVisible={4} className="shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{panelTitle}</p>
            {activeTab === 'collaborators' ? (
              <p className="truncate text-[11px] text-muted-foreground">
                {memberTotal} member{memberTotal === 1 ? '' : 's'} with access
              </p>
            ) : detailsSubtitle ? (
              <p className="truncate text-[11px] text-muted-foreground">{detailsSubtitle}</p>
            ) : null}
          </div>
        </div>

        <TabsContent
          value="details"
          className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          {multiSelectCount > 0 ? (
            <MultiSelectState
              count={multiSelectCount}
              canConvert={canConvertToSubWorkflow}
              onConvert={onConvertToSubWorkflow}
            />
          ) : selection?.kind === 'node' && selectedNode && isSubWorkflowNode(selectedNode) ? (
            <SubWorkflowConfigPanel
              node={selectedNode}
              doc={doc}
              onOpenSubWorkflow={onOpenSubWorkflow ?? (() => {})}
            />
          ) : selection?.kind === 'node' && selectedNode?.agent && isToolNode(selectedNode) ? (
            <ToolConfigPanel node={selectedNode} diagram={diagram} onChange={onChange} />
          ) : selection?.kind === 'node' && selectedNode?.agent ? (
            <AgentConfigPanel node={selectedNode} onChange={onChange} />
          ) : selection?.kind === 'edge' && selectedEdge ? (
            <ConnectorConfigPanel
              edge={selectedEdge}
              fromLabel={fromLabel ?? 'Source'}
              toLabel={toLabel ?? 'Target'}
              onChange={onChange}
            />
          ) : (
            <SelectionEmptyState />
          )}
        </TabsContent>

        <TabsContent
          value="collaborators"
          className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
        >
          <WorkspaceMembersPanel
            toolId={toolId}
            onManageAccess={onManageAccess}
            hideHeader
          />
        </TabsContent>
      </Tabs>
    </aside>
  )
})

function MultiSelectState({
  count,
  canConvert,
  onConvert,
}: {
  count: number
  canConvert: boolean
  onConvert?: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
        <GitBranch className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{count} items selected</p>
      <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
        Shift-click or Cmd/Ctrl-click agents to add or remove them from the selection.
      </p>
      {canConvert && onConvert && (
        <Button type="button" className="mt-5 gap-2" onClick={onConvert}>
          <GitBranch className="h-4 w-4" />
          Convert to sub-workflow
        </Button>
      )}
      {!canConvert && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          Select at least two agents to group into a sub-workflow.
        </p>
      )}
    </div>
  )
}

function SelectionEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground">
        <MousePointerClick className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-foreground">Nothing selected</p>
      <p className="mt-1.5 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
        Select an agent, tool, or connector on the canvas to view and edit its properties here.
      </p>
      <div className="mt-6 space-y-2 text-left text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <span>Click an agent to configure it</span>
        </div>
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span>Click a tool to change its agent mapping</span>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <span>Shift-click to multi-select agents</span>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <span>Click a connector to set flow rules</span>
        </div>
      </div>
    </div>
  )
}
