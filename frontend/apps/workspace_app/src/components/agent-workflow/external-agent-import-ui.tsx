import { memo, useMemo, useState } from 'react'
import { CloudDownload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/utils/cn'
import {
  AGENT_IMPORT_SOURCES,
  primaryImportSource,
  type AgentImportSource,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { SidebarSection } from '@/components/agent-workflow/workflow-ui'

interface ExternalAgentImportSectionProps {
  onOpenImport: (sourceId: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** Hide title chrome when shown inside the library flyout. */
  embedded?: boolean
}

export const ExternalAgentImportSection = memo(function ExternalAgentImportSection({
  onOpenImport,
  collapsed = false,
  onToggleCollapse,
  embedded = false,
}: ExternalAgentImportSectionProps) {
  const primary = primaryImportSource()
  const comingSoon = useMemo(
    () => AGENT_IMPORT_SOURCES.filter((source) => !source.enabled),
    [],
  )

  if (!primary && comingSoon.length === 0) return null

  const body = (
    <>
      {collapsed ? null : (
        <>
          {primary && (
            <ImportSourceButton source={primary} onClick={() => onOpenImport(primary.id)} />
          )}

          {comingSoon.length > 0 && (
            <div className="mt-2 space-y-1">
              {comingSoon.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground"
                >
                  <span className="truncate">
                    {source.label}
                    <span className="text-muted-foreground/70"> · {source.provider}</span>
                  </span>
                  <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[9px] font-normal">
                    Soon
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )

  if (embedded) {
    return <div className="space-y-1">{body}</div>
  }

  return (
    <section className="mt-6 border-t border-border pt-4">
      <SidebarSection
        title="Import agents"
        subtitle="Pull agents from external platforms into your workflow"
        count={(primary ? 1 : 0) + comingSoon.length}
        collapsed={collapsed}
        onToggle={onToggleCollapse}
      />

      {body}
    </section>
  )
})

function ImportSourceButton({
  source,
  onClick,
}: {
  source: AgentImportSource
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2.5 text-left transition-colors',
        'hover:border-sky-500/50 hover:bg-sky-500/10',
      )}
    >
      {source.logo ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background p-1">
          <img src={source.logo} alt="" className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
          <CloudDownload className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{source.label}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {source.description ?? `Import from ${source.provider}`}
        </p>
      </div>
      <CloudDownload className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
    </button>
  )
}

interface AgentImportDialogProps {
  sourceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const AgentImportDialog = memo(function AgentImportDialog({
  sourceId,
  open,
  onOpenChange,
}: AgentImportDialogProps) {
  const source = AGENT_IMPORT_SOURCES.find((item) => item.id === sourceId)
  const [endpoint, setEndpoint] = useState('')
  const [project, setProject] = useState('')
  const [loading, setLoading] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEndpoint('')
      setProject('')
      setLoading(false)
    }
    onOpenChange(next)
  }

  const handleConnect = () => {
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      toast.info(`${source?.label ?? 'Import'} connection is not configured yet. Agent import will be available soon.`)
      handleOpenChange(false)
    }, 600)
  }

  if (!source) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            {source.logo ? (
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background p-1.5">
                <img src={source.logo} alt="" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                <CloudDownload className="h-5 w-5" />
              </div>
            )}
            <div>
              <DialogTitle>Import from {source.label}</DialogTitle>
              <DialogDescription className="mt-0.5">
                Browse agents in your {source.provider} project and add them to the canvas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="import-endpoint" className="text-xs">
              Endpoint
            </Label>
            <Input
              id="import-endpoint"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://your-resource.services.ai.azure.com"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="import-project" className="text-xs">
              Project name
            </Label>
            <Input
              id="import-project"
              value={project}
              onChange={(event) => setProject(event.target.value)}
              placeholder="my-agent-project"
              className="h-9"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Sign in to list agents, prompts, and tool-enabled assistants. Additional import sources
            are coming soon.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConnect} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            Connect &amp; browse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

/** @deprecated Use AgentImportDialog */
export const AzureFoundryImportDialog = AgentImportDialog
