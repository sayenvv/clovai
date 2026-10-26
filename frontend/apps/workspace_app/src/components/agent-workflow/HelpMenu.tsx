import { memo, useState } from 'react'
import { BookOpen, CircleHelp, ExternalLink, Info, Keyboard } from 'lucide-react'
import { cn } from '@/utils/cn'
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { APP_NAME } from '@/constants'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl'

/** Shortcuts the workflow editor actually handles (AgentWorkflowPage and DesignerCanvas). */
export const SHORTCUT_GROUPS: Array<{ title: string; items: Array<{ keys: string; action: string }> }> = [
  {
    title: 'General',
    items: [
      { keys: `${MOD} K`, action: 'Ask Workflow AI' },
      { keys: `${MOD} Z`, action: 'Undo' },
      { keys: IS_MAC ? '⌘ ⇧ Z' : 'Ctrl Y', action: 'Redo' },
      { keys: 'Delete / Backspace', action: 'Delete the selection' },
      { keys: 'Esc', action: 'Cancel a connection / deselect' },
    ],
  },
  {
    title: 'Canvas',
    items: [
      { keys: 'Scroll / two-finger drag', action: 'Pan the canvas' },
      { keys: 'Shift + click', action: 'Select several nodes' },
      { keys: 'Drag from a port', action: 'Draw a connection (repeat for more)' },
      { keys: 'Double-click a node', action: 'Rename it' },
      { keys: '▶ on Start', action: 'Execute the workflow' },
    ],
  },
  {
    title: 'Selected connectors',
    items: [
      { keys: `${MOD} C / ${MOD} X`, action: 'Copy / cut' },
      { keys: `${MOD} V`, action: 'Paste' },
      { keys: `${MOD} D`, action: 'Duplicate' },
    ],
  },
]

interface HelpMenuProps {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Overrides the trigger's size and colours (e.g. the compact top bar). */
  triggerClassName?: string
}

/** Help dropdown for the sidebar rail: keyboard shortcuts, docs and about. */
export const HelpMenu = memo(function HelpMenu({ side = 'right', align = 'end', triggerClassName }: HelpMenuProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('h-9 w-9 rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground', triggerClassName)}
                  aria-label="Help"
                >
                  <CircleHelp className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10} className="px-2.5 py-1.5 text-xs font-medium">
              Help
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent side={side} align={align} sideOffset={8} className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Help</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
              <Keyboard />
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/#faq" target="_blank" rel="noopener">
                <BookOpen />
                FAQ & documentation
                <ExternalLink className="ml-auto !h-3 !w-3 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/" target="_blank" rel="noopener">
                <Info />
                About {APP_NAME}
                <ExternalLink className="ml-auto !h-3 !w-3 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Everything you can do quickly in the workflow editor.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title}>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </h3>
                <div className="flex flex-col divide-y divide-border">
                  {group.items.map((shortcut) => (
                    <div key={shortcut.action} className="flex items-center justify-between gap-4 py-2">
                      <span className="text-sm text-foreground/90">{shortcut.action}</span>
                      <kbd className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-sans text-[11px] text-muted-foreground">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
