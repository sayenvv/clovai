import { memo, useState } from 'react'
import {
  Link2,
  Copy,
  Code2,
  Cpu,
  Crown,
  Download,
  Eraser,
  ExternalLink,
  GitBranch,
  FilePlus2,
  Keyboard,
  Layers,
  Maximize,
  Moon,
  PanelRight,
  Plus,
  Scan,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Selection } from '@/components/designer/selection-utils'
import { selectionNodeCount } from '@/components/designer/selection-utils'
import { ServerLlmModelIndicator } from '@/components/agent-workflow/ServerLlmModelIndicator'
import { WorkspaceMembersTrigger } from './WorkspaceMembersTrigger'
import { APP_NAME } from '@/constants'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Scroll', action: 'Zoom in / out (toward cursor)' },
  { keys: 'Drag background', action: 'Pan the canvas' },
  { keys: 'Drag shape', action: 'Move a shape' },
  { keys: 'Drag corner handle', action: 'Resize the selected shape' },
  { keys: 'Click port → click target', action: 'Draw a connection' },
  { keys: 'Double-click shape', action: 'Rename inline' },
  { keys: 'Delete / Backspace', action: 'Delete the selection' },
  { keys: 'Esc', action: 'Cancel connection / deselect' },
]

interface DesignerMenubarProps {
  selection: Selection
  isEmpty: boolean
  snapToGrid: boolean
  showGrid: boolean
  onNew: () => void
  onNewPage?: () => void
  onNewWorkspace?: () => void
  onImport: () => void
  onExportJson: () => void
  onExportSvg: () => void
  onExportPng: () => void
  onExportPdf: () => void
  onViewCode: () => void
  onDuplicate: () => void
  onDeleteSelection: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onFitToContent: () => void
  onSnapToGridChange: (enabled: boolean) => void
  onShowGridChange: (enabled: boolean) => void
  onShare: () => void
  toolId: string
  onManageAccess: () => void
  /** Hide facepile when the workspace header already shows members. */
  showWorkspaceMembers?: boolean
  /** Right-side properties / inspector panel (agent workflow). */
  propertiesPanelOpen?: boolean
  onTogglePropertiesPanel?: () => void
  /** Agent workflow — group selection into a nested workflow. */
  onConvertToSubWorkflow?: () => void
  canConvertToSubWorkflow?: boolean
  onInsertWorkflow?: () => void
  onInsertImport?: () => void
  onCreateWorkflowTab?: () => void
  /** Allow opening code view when the canvas is empty (workflow build spec). */
  viewCodeWhenEmpty?: boolean
  /** Active code debug view (workflow editor). */
  codeViewActive?: boolean
  onToggleCodeView?: () => void
  /** Open workflow-level settings (model config, execution type). */
  onOpenWorkflowSettings?: () => void
  /** Server-managed LLM model (read-only display). */
  serverModelConfig?: WorkflowModelConfig
  llmConfigured?: boolean
  llmConfigLoading?: boolean
}

function MenuTrigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2.5 text-xs font-medium text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
      >
        {label}
      </Button>
    </DropdownMenuTrigger>
  )
}

/** App-style menu bar with Share next to Settings and workspace members on the right. */
export const DesignerMenubar = memo(function DesignerMenubar({
  selection,
  isEmpty,
  snapToGrid,
  showGrid,
  onNew,
  onNewPage,
  onNewWorkspace,
  onImport,
  onExportJson,
  onExportSvg,
  onExportPng,
  onExportPdf,
  onViewCode,
  onDuplicate,
  onDeleteSelection,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitToContent,
  onSnapToGridChange,
  onShowGridChange,
  onShare,
  toolId,
  onManageAccess,
  showWorkspaceMembers = true,
  propertiesPanelOpen,
  onTogglePropertiesPanel,
  onConvertToSubWorkflow,
  canConvertToSubWorkflow = false,
  onInsertWorkflow,
  onInsertImport,
  onCreateWorkflowTab,
  viewCodeWhenEmpty = false,
  codeViewActive,
  onToggleCodeView,
  onOpenWorkflowSettings,
  serverModelConfig,
  llmConfigured = false,
  llmConfigLoading = false,
}: DesignerMenubarProps) {
  const { theme, toggleTheme } = useTheme()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  return (
    <div className="flex items-center gap-0.5 border-b bg-background px-2 py-1">
      <DropdownMenu>
        <MenuTrigger label="File" />
        <DropdownMenuContent align="start">
          {onNewPage || onNewWorkspace ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FilePlus2 /> New
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {onNewPage && (
                  <DropdownMenuItem onSelect={onNewPage}>
                    <FilePlus2 /> New page
                  </DropdownMenuItem>
                )}
                {onNewWorkspace && (
                  <DropdownMenuItem onSelect={onNewWorkspace}>
                    <Layers /> New workspace
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem onSelect={onNew}>
              <FilePlus2 /> New diagram
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onImport}>
            <Upload /> Import JSON…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onExportJson} disabled={isEmpty}>
            <Download /> JSON (.json)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportSvg} disabled={isEmpty}>
            <Download /> SVG (.svg)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportPng} disabled={isEmpty}>
            <Download /> PNG (.png)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportPdf} disabled={isEmpty}>
            <Download /> PDF (.pdf)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={onViewCode}
            disabled={!viewCodeWhenEmpty && isEmpty}
          >
            <Code2 /> Code view
            <span className="ml-auto inline-flex items-center gap-1 rounded-sm border border-amber-400/60 bg-amber-300/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-800 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-amber-200">
              <Crown className="h-2.5 w-2.5" />
              Premium
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onInsertWorkflow && (
        <DropdownMenu>
          <MenuTrigger label="Insert" />
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onInsertWorkflow}>
              <Layers /> Workflow…
            </DropdownMenuItem>
            {onCreateWorkflowTab && (
              <DropdownMenuItem onSelect={onCreateWorkflowTab}>
                <Plus /> New workflow tab
              </DropdownMenuItem>
            )}
            {onInsertImport && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onInsertImport}>
                  <Upload /> Import from file…
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <MenuTrigger label="Edit" />
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onDuplicate} disabled={selection?.kind !== 'node'}>
            <Copy /> Duplicate shape
          </DropdownMenuItem>
          {onConvertToSubWorkflow && (
            <DropdownMenuItem
              onSelect={onConvertToSubWorkflow}
              disabled={!canConvertToSubWorkflow}
            >
              <GitBranch /> Convert to sub-workflow
              {selectionNodeCount(selection) > 1 && (
                <DropdownMenuShortcut>{selectionNodeCount(selection)} agents</DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onDeleteSelection} disabled={!selection}>
            <Trash2 /> Delete selection
            <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onNew} disabled={isEmpty}>
            <Eraser /> Clear canvas
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="View" />
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onZoomIn}>
            <ZoomIn /> Zoom in
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onZoomOut}>
            <ZoomOut /> Zoom out
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onResetView}>
            <Maximize /> Reset view
            <DropdownMenuShortcut>100%</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onFitToContent} disabled={isEmpty}>
            <Scan /> Fit to content
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={onShowGridChange}>
            Show grid
          </DropdownMenuCheckboxItem>
          {onToggleCodeView && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={codeViewActive ?? false}
                onCheckedChange={() => onToggleCodeView()}
              >
                Code view
                <span className="ml-auto inline-flex items-center gap-1 rounded-sm border border-amber-400/60 bg-amber-300/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-800 dark:border-amber-300/40 dark:bg-amber-300/10 dark:text-amber-200">
                  <Crown className="h-2.5 w-2.5" />
                  Premium
                </span>
              </DropdownMenuCheckboxItem>
            </>
          )}
          {onTogglePropertiesPanel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={propertiesPanelOpen ?? true}
                onCheckedChange={(checked) => {
                  if (checked !== (propertiesPanelOpen ?? true)) {
                    onTogglePropertiesPanel()
                  }
                }}
              >
                Properties panel
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Share" />
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onShare}>
            <Link2 /> Share & collaborate…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Settings" />
        <DropdownMenuContent align="start">
          {onOpenWorkflowSettings && (
            <>
              <DropdownMenuLabel>Workflow</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onOpenWorkflowSettings}>
                <Cpu /> Model & workflow settings…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Canvas</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={snapToGrid} onCheckedChange={onSnapToGridChange}>
            Snap to grid
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={onShowGridChange}>
            Show grid
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuItem onSelect={toggleTheme}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Help" />
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
            <Keyboard /> Keyboard shortcuts & canvas basics
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/#faq" target="_blank" rel="noopener">
              <ExternalLink /> FAQ & documentation
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/" target="_blank" rel="noopener">
              <Sparkles /> About {APP_NAME}
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts & canvas basics</DialogTitle>
            <DialogDescription>Everything you can do on the design canvas.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col divide-y">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-muted-foreground">{shortcut.action}</span>
                <kbd className="shrink-0 rounded-md border bg-muted px-2 py-1 font-mono text-[11px]">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {(serverModelConfig || onTogglePropertiesPanel || showWorkspaceMembers) && (
        <div className="ml-auto flex items-center gap-1.5 pl-2">
          {serverModelConfig ? (
            <ServerLlmModelIndicator
              modelConfig={serverModelConfig}
              configured={llmConfigured}
              isLoading={llmConfigLoading}
              variant="compact"
            />
          ) : null}
          {onTogglePropertiesPanel && (
            <Button
              variant={propertiesPanelOpen ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={onTogglePropertiesPanel}
              aria-label={propertiesPanelOpen ? 'Hide properties panel' : 'Show properties panel'}
              title={propertiesPanelOpen ? 'Hide properties panel' : 'Show properties panel'}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
          {showWorkspaceMembers && (
            <WorkspaceMembersTrigger toolId={toolId} onManageAccess={onManageAccess} />
          )}
        </div>
      )}
    </div>
  )
})
