import { memo, type ComponentType, type ReactNode } from 'react'
import {
  Check,
  Code2,
  Copy,
  Download,
  Eraser,
  FilePlus2,
  GitBranch,
  Grid3x3,
  Layers,
  LayoutTemplate,
  Link2,
  Magnet,
  Maximize,
  Menu,
  Plus,
  Save,
  Scan,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { APP_NAME } from '@/constants'
import { cn } from '@/utils/cn'
import type { Selection } from '@/components/designer/selection-utils'

type IconType = ComponentType<{ className?: string }>

interface DrawerAction {
  id: string
  label: string
  icon: IconType
  onSelect: () => void
  disabled?: boolean
  hint?: string
}

interface MobileAppDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowName: string
  selection: Selection
  isEmpty: boolean
  snapToGrid: boolean
  showGrid: boolean
  codeViewActive?: boolean
  canConvertToSubWorkflow?: boolean
  onNewPage: () => void
  onNewWorkspace: () => void
  onSave: () => void
  onSaveAs: () => void
  onImport: () => void
  onExportJson: () => void
  onExportSvg: () => void
  onExportPng: () => void
  onExportPdf: () => void
  onInsertWorkflow: () => void
  onInsertTemplates: () => void
  onCreateWorkflowTab: () => void
  onInsertImport: () => void
  onToggleCodeView: () => void
  onDuplicate: () => void
  onDeleteSelection: () => void
  onConvertToSubWorkflow: () => void
  onClearCanvas: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onFitToContent: () => void
  onSnapToGridChange: (enabled: boolean) => void
  onShowGridChange: (enabled: boolean) => void
  onShare: () => void
}

function DrawerRow({
  icon: Icon,
  label,
  hint,
  disabled,
  onSelect,
  trailing,
}: {
  icon: IconType
  label: string
  hint?: string
  disabled?: boolean
  onSelect: () => void
  trailing?: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/45'
          : 'text-foreground active:bg-foreground/[0.06]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      {trailing}
    </button>
  )
}

function SectionActions({
  actions,
  onDone,
}: {
  actions: DrawerAction[]
  onDone: () => void
}) {
  return (
    <div className="space-y-0.5 pb-2">
      {actions.map((action) => (
        <DrawerRow
          key={action.id}
          icon={action.icon}
          label={action.label}
          hint={action.hint}
          disabled={action.disabled}
          onSelect={() => {
            if (action.disabled) return
            action.onSelect()
            onDone()
          }}
        />
      ))}
    </div>
  )
}

/** Left app drawer — mobile File / Insert / Edit / View menu. */
export const MobileAppDrawer = memo(function MobileAppDrawer({
  open,
  onOpenChange,
  workflowName,
  selection,
  isEmpty,
  snapToGrid,
  showGrid,
  codeViewActive = false,
  canConvertToSubWorkflow = false,
  onNewPage,
  onNewWorkspace,
  onSave,
  onSaveAs,
  onImport,
  onExportJson,
  onExportSvg,
  onExportPng,
  onExportPdf,
  onInsertWorkflow,
  onInsertTemplates,
  onCreateWorkflowTab,
  onInsertImport,
  onToggleCodeView,
  onDuplicate,
  onDeleteSelection,
  onConvertToSubWorkflow,
  onClearCanvas,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitToContent,
  onSnapToGridChange,
  onShowGridChange,
  onShare,
}: MobileAppDrawerProps) {
  const close = () => onOpenChange(false)
  const hasSelection = Boolean(selection)

  const fileActions: DrawerAction[] = [
    { id: 'new-page', label: 'New page', icon: FilePlus2, onSelect: onNewPage },
    { id: 'new-workspace', label: 'New workspace', icon: Layers, onSelect: onNewWorkspace },
    { id: 'save', label: 'Save', icon: Save, onSelect: onSave },
    { id: 'save-as', label: 'Save as…', icon: Download, onSelect: onSaveAs },
    { id: 'import', label: 'Import JSON…', icon: Upload, onSelect: onImport },
    {
      id: 'export-json',
      label: 'Export JSON',
      icon: Download,
      onSelect: onExportJson,
      disabled: isEmpty,
    },
    {
      id: 'export-svg',
      label: 'Export SVG',
      icon: Download,
      onSelect: onExportSvg,
      disabled: isEmpty,
    },
    {
      id: 'export-png',
      label: 'Export PNG',
      icon: Download,
      onSelect: onExportPng,
      disabled: isEmpty,
    },
    {
      id: 'export-pdf',
      label: 'Export PDF',
      icon: Download,
      onSelect: onExportPdf,
      disabled: isEmpty,
    },
  ]

  const insertActions: DrawerAction[] = [
    { id: 'insert-workflow', label: 'Workflow…', icon: Layers, onSelect: onInsertWorkflow },
    {
      id: 'insert-templates',
      label: 'Templates…',
      icon: LayoutTemplate,
      onSelect: onInsertTemplates,
    },
    {
      id: 'new-tab',
      label: 'New workflow tab',
      icon: Plus,
      onSelect: onCreateWorkflowTab,
    },
    {
      id: 'code',
      label: codeViewActive ? 'Back to canvas' : 'Code view',
      icon: Code2,
      onSelect: onToggleCodeView,
    },
    {
      id: 'insert-import',
      label: 'Import from file…',
      icon: Upload,
      onSelect: onInsertImport,
    },
  ]

  const editActions: DrawerAction[] = [
    {
      id: 'duplicate',
      label: 'Duplicate shape',
      icon: Copy,
      onSelect: onDuplicate,
      disabled: selection?.kind !== 'node',
    },
    {
      id: 'subflow',
      label: 'Convert to sub-workflow',
      icon: GitBranch,
      onSelect: onConvertToSubWorkflow,
      disabled: !canConvertToSubWorkflow,
    },
    {
      id: 'delete',
      label: 'Delete selection',
      icon: Trash2,
      onSelect: onDeleteSelection,
      disabled: !hasSelection,
    },
    {
      id: 'clear',
      label: 'Clear canvas',
      icon: Eraser,
      onSelect: onClearCanvas,
      disabled: isEmpty,
    },
  ]

  const viewActions: DrawerAction[] = [
    { id: 'zoom-in', label: 'Zoom in', icon: ZoomIn, onSelect: onZoomIn },
    { id: 'zoom-out', label: 'Zoom out', icon: ZoomOut, onSelect: onZoomOut },
    { id: 'reset', label: 'Reset view', icon: Maximize, onSelect: onResetView, hint: '100%' },
    {
      id: 'fit',
      label: 'Fit to content',
      icon: Scan,
      onSelect: onFitToContent,
      disabled: isEmpty,
    },
  ]

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 left-0 z-[60] flex w-[min(20.5rem,88vw)] flex-col border-r border-border bg-card shadow-2xl outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-200',
          )}
        >
          <div className="flex items-center gap-2.5 border-b border-border px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <Logo size={LOGO_SIZE_WORKSPACE} rounded="md" />
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-[14px] font-semibold tracking-tight">
                {APP_NAME}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="truncate text-[11px] text-muted-foreground">
                {workflowName || 'Workflow menu'}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
            <Accordion type="multiple" defaultValue={['file', 'insert', 'edit', 'view']}>
              <AccordionItem value="file" className="border-border/70">
                <AccordionTrigger className="px-2 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
                  File
                </AccordionTrigger>
                <AccordionContent className="px-0">
                  <SectionActions actions={fileActions} onDone={close} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="insert" className="border-border/70">
                <AccordionTrigger className="px-2 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
                  Insert
                </AccordionTrigger>
                <AccordionContent className="px-0">
                  <SectionActions actions={insertActions} onDone={close} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="edit" className="border-border/70">
                <AccordionTrigger className="px-2 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
                  Edit
                </AccordionTrigger>
                <AccordionContent className="px-0">
                  <SectionActions actions={editActions} onDone={close} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="view" className="border-border/70">
                <AccordionTrigger className="px-2 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
                  View
                </AccordionTrigger>
                <AccordionContent className="px-0">
                  <SectionActions actions={viewActions} onDone={close} />
                  <div className="space-y-0.5 pb-2">
                    <DrawerRow
                      icon={Grid3x3}
                      label="Show grid"
                      onSelect={() => onShowGridChange(!showGrid)}
                      trailing={
                        showGrid ? (
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : null
                      }
                    />
                    <DrawerRow
                      icon={Magnet}
                      label="Snap to grid"
                      onSelect={() => onSnapToGridChange(!snapToGrid)}
                      trailing={
                        snapToGrid ? (
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : null
                      }
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-1 border-t border-border/70 px-0 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Share
              </p>
              <DrawerRow
                icon={Link2}
                label="Share & collaborate…"
                onSelect={() => {
                  onShare()
                  close()
                }}
              />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
})

export const MobileAppDrawerTrigger = memo(function MobileAppDrawerTrigger({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-10 w-10 shrink-0 text-foreground"
      aria-label="Open app menu"
    >
      <Menu className="h-6 w-6" strokeWidth={2.25} />
    </Button>
  )
})
