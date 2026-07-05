import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { FileJson, GitBranch, Layers, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/utils/cn'
import { normalizeDocument, type DiagramDocument } from '@/components/designer/diagram-types'
import { countAgentsInPage } from '@/components/agent-workflow/sub-workflow-ops'

export type InsertWorkflowMode = 'nodes' | 'mount'
export type InsertDialogTab = 'workflow' | 'import'

interface InsertWorkflowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: DiagramDocument
  activePageId: string
  defaultTab?: InsertDialogTab
  onInsertFromPage: (pageId: string, mode: InsertWorkflowMode) => void
  onImportDocument: (document: DiagramDocument, mode: InsertWorkflowMode) => void
  onCreateWorkflowTab?: () => void
}

export const InsertWorkflowDialog = memo(function InsertWorkflowDialog({
  open,
  onOpenChange,
  doc,
  activePageId,
  defaultTab = 'workflow',
  onInsertFromPage,
  onImportDocument,
  onCreateWorkflowTab,
}: InsertWorkflowDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<InsertDialogTab>(defaultTab)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [mode, setMode] = useState<InsertWorkflowMode>('mount')

  const otherPages = useMemo(
    () => doc.pages.filter((page) => page.id !== activePageId),
    [doc.pages, activePageId],
  )

  useEffect(() => {
    if (open) setActiveTab(defaultTab)
  }, [open, defaultTab])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedPageId(null)
      setMode('mount')
    }
    onOpenChange(next)
  }

  const handleImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = normalizeDocument(JSON.parse(String(reader.result)))
        onImportDocument(imported, mode)
        handleOpenChange(false)
      } catch {
        toast.error('Invalid workflow JSON file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Insert</DialogTitle>
          <DialogDescription>
            Attach a workflow from another tab, or import one from a file.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as InsertDialogTab)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="workflow" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Workflow
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Insert as</Label>
              <div className="grid gap-2">
                <ModeOption
                  active={mode === 'mount'}
                  title="Sub-workflow agent"
                  description="One agent node linked to the chosen workflow tab."
                  onClick={() => setMode('mount')}
                />
                <ModeOption
                  active={mode === 'nodes'}
                  title="Copy nodes"
                  description="Paste agents and connectors from that workflow onto this canvas."
                  onClick={() => setMode('nodes')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Choose workflow</Label>
                {onCreateWorkflowTab && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => {
                      onCreateWorkflowTab()
                      handleOpenChange(false)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New tab
                  </Button>
                )}
              </div>

              {otherPages.length > 0 ? (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-1">
                  {otherPages.map((page) => {
                    const agentCount = countAgentsInPage(doc, page.id)
                    const selected = selectedPageId === page.id
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => setSelectedPageId(page.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                          selected ? 'bg-violet-500/10 text-foreground' : 'hover:bg-muted/60',
                        )}
                      >
                        <Layers className="h-4 w-4 shrink-0 text-violet-500" />
                        <span className="min-w-0 flex-1 truncate font-medium">{page.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {agentCount} agent{agentCount === 1 ? '' : 's'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-foreground">No other workflows yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a workflow in a new tab, build it there, then come back here to attach
                    it on this page.
                  </p>
                  {onCreateWorkflowTab && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-3 gap-1.5"
                      onClick={() => {
                        onCreateWorkflowTab()
                        handleOpenChange(false)
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New workflow tab
                    </Button>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="px-0 sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!selectedPageId}
                onClick={() => {
                  if (!selectedPageId) return
                  onInsertFromPage(selectedPageId, mode)
                  handleOpenChange(false)
                }}
              >
                <GitBranch className="mr-1.5 h-4 w-4" />
                Insert workflow
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="import" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Insert as</Label>
              <div className="grid gap-2">
                <ModeOption
                  active={mode === 'mount'}
                  title="Sub-workflow agent"
                  description="Import and mount the file as a reusable sub-workflow agent."
                  onClick={() => setMode('mount')}
                />
                <ModeOption
                  active={mode === 'nodes'}
                  title="Copy nodes"
                  description="Import and paste nodes from the file onto this canvas."
                  onClick={() => setMode('nodes')}
                />
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) handleImportFile(file)
                event.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Choose workflow JSON file…
            </Button>

            <DialogFooter className="px-0 sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
})

function ModeOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors',
        active ? 'border-violet-500/40 bg-violet-500/5' : 'hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 rounded-full border',
          active ? 'border-violet-500 bg-violet-500' : 'border-muted-foreground/40',
        )}
      />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

interface ConvertSubWorkflowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentCount: number
  defaultName: string
  onConfirm: (name: string) => void
}

export const ConvertSubWorkflowDialog = memo(function ConvertSubWorkflowDialog({
  open,
  onOpenChange,
  agentCount,
  defaultName,
  onConfirm,
}: ConvertSubWorkflowDialogProps) {
  const [name, setName] = useState(defaultName)

  const handleOpenChange = (next: boolean) => {
    if (next) setName(defaultName)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to sub-workflow</DialogTitle>
          <DialogDescription>
            Group {agentCount} selected agents into a nested workflow. They will be replaced by one
            sub-workflow agent you can mount in other flows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="sub-workflow-name">Sub-workflow name</Label>
          <input
            id="sub-workflow-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Research pipeline"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm(name.trim() || defaultName)
              handleOpenChange(false)
            }}
          >
            <FileJson className="mr-1.5 h-4 w-4" />
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
