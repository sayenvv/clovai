import { memo, useState } from 'react'
import {
  Copy,
  Code2,
  Download,
  Eraser,
  ExternalLink,
  FilePlus2,
  Keyboard,
  Maximize,
  Moon,
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
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Selection } from './DesignerCanvas'

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
  scale: number
  selection: Selection
  isEmpty: boolean
  snapToGrid: boolean
  showGrid: boolean
  onNew: () => void
  onImport: () => void
  onExport: () => void
  onViewCode: () => void
  onDuplicate: () => void
  onDeleteSelection: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  onFitToContent: () => void
  onSnapToGridChange: (enabled: boolean) => void
  onShowGridChange: (enabled: boolean) => void
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

/** App-style menu bar (File / Edit / View / Settings) plus quick zoom
 *  controls and the Clovai Engine placeholder. */
export const DesignerMenubar = memo(function DesignerMenubar({
  scale,
  selection,
  isEmpty,
  snapToGrid,
  showGrid,
  onNew,
  onImport,
  onExport,
  onViewCode,
  onDuplicate,
  onDeleteSelection,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitToContent,
  onSnapToGridChange,
  onShowGridChange,
}: DesignerMenubarProps) {
  const { theme, toggleTheme } = useTheme()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  return (
    <div className="flex items-center gap-0.5 border-b bg-background px-2 py-1">
      <DropdownMenu>
        <MenuTrigger label="File" />
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onNew}>
            <FilePlus2 /> New diagram
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onImport}>
            <Upload /> Import JSON…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExport} disabled={isEmpty}>
            <Download /> Export JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onViewCode} disabled={isEmpty}>
            <Code2 /> Build as code…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Edit" />
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onDuplicate} disabled={selection?.kind !== 'node'}>
            <Copy /> Duplicate shape
          </DropdownMenuItem>
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
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Settings" />
        <DropdownMenuContent align="start">
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
              <Sparkles /> About Clovai
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

      <div className="mx-1.5 h-5 w-px bg-border" aria-hidden />

      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut} aria-label="Zoom out">
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn} aria-label="Zoom in">
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Badge variant="gradient" className="hidden sm:inline-flex">
          Coming soon
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          disabled
          title="Clovai Engine — multi-agent AI generation, launching soon"
        >
          <Sparkles /> Generate with AI
        </Button>
      </div>
    </div>
  )
})
