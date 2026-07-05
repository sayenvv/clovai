import { memo, useState } from 'react'
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

const MICROSOFT_LOGO = '/agent-providers/microsoft.svg'

const COMING_SOON_SOURCES = [
  { label: 'LangSmith', provider: 'LangChain' },
  { label: 'Bedrock Agents', provider: 'AWS' },
  { label: 'Vertex Agent Builder', provider: 'Google' },
  { label: 'Agentforce', provider: 'Salesforce' },
] as const

interface ExternalAgentImportSectionProps {
  onOpenFoundryImport: () => void
}

export const ExternalAgentImportSection = memo(function ExternalAgentImportSection({
  onOpenFoundryImport,
}: ExternalAgentImportSectionProps) {
  return (
    <section className="mt-6 border-t border-border pt-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-foreground">Import agents</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Pull agents from external platforms into your workflow
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenFoundryImport}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2.5 text-left transition-colors',
          'hover:border-sky-500/50 hover:bg-sky-500/10',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background p-1">
          <img src={MICROSOFT_LOGO} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">Azure AI Foundry</p>
          <p className="truncate text-[10px] text-muted-foreground">Import agents from your project</p>
        </div>
        <CloudDownload className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
      </button>

      <div className="mt-2 space-y-1">
        {COMING_SOON_SOURCES.map((source) => (
          <div
            key={source.label}
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
    </section>
  )
})

interface AzureFoundryImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportAgents?: (agentIds: string[]) => void
}

export const AzureFoundryImportDialog = memo(function AzureFoundryImportDialog({
  open,
  onOpenChange,
}: AzureFoundryImportDialogProps) {
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
      toast.info('Azure AI Foundry connection is not configured yet. Agent import will be available soon.')
      handleOpenChange(false)
    }, 600)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background p-1.5">
              <img src={MICROSOFT_LOGO} alt="" className="h-full w-full object-contain" />
            </div>
            <div>
              <DialogTitle>Import from Azure AI Foundry</DialogTitle>
              <DialogDescription className="mt-0.5">
                Browse agents in your Foundry project and add them to the canvas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="foundry-endpoint" className="text-xs">
              Foundry endpoint
            </Label>
            <Input
              id="foundry-endpoint"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://your-resource.services.ai.azure.com"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="foundry-project" className="text-xs">
              Project name
            </Label>
            <Input
              id="foundry-project"
              value={project}
              onChange={(event) => setProject(event.target.value)}
              placeholder="my-agent-project"
              className="h-9"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Sign in with your Azure account to list agents, prompts, and tool-enabled assistants from
            AI Foundry. Additional import sources are coming soon.
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
