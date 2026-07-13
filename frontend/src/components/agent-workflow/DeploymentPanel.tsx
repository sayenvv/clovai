import { memo } from 'react'
import { CheckCircle2, Copy, Globe, Key, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { toast } from 'sonner'
import type { WorkflowDeployment } from '@/types/agent-workflow'

interface DeploymentPanelProps {
  deployment?: WorkflowDeployment
  canDeploy: boolean
  onDeploy: () => void
}

export const DeploymentPanel = memo(function DeploymentPanel({
  deployment,
  canDeploy,
  onDeploy,
}: DeploymentPanelProps) {
  const copy = (value: string, label: string) => {
    void navigator.clipboard.writeText(value)
    toast.success(`Copied ${label}`)
  }

  if (!deployment) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
          <Rocket className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold">Not deployed yet</h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Validate your workflow, then deploy to generate an API endpoint and schemas.
        </p>
        <Button className="mt-4 bg-red-600 hover:bg-red-700" disabled={!canDeploy} onClick={onDeploy}>
          Deploy workflow
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Deployment</h3>
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-[10px] capitalize text-emerald-700 dark:text-emerald-300"
          >
            {deployment.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Version {deployment.version}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <PanelSection title="API endpoint">
          <Field label="Workflow ID">
            <CopyField value={deployment.workflowId} onCopy={() => copy(deployment.workflowId, 'workflow ID')} />
          </Field>
          <Field label="Endpoint URL">
            <CopyField value={deployment.endpointUrl} onCopy={() => copy(deployment.endpointUrl, 'endpoint URL')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trigger">
              <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-xs">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                {deployment.triggerMethod}
              </div>
            </Field>
            <Field label="Authentication">
              <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-xs capitalize">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                {deployment.authType.replace('-', ' ')}
              </div>
            </Field>
          </div>
        </PanelSection>

        <PanelSection title="Schemas">
          <Field label="Request schema">
            <pre className="max-h-32 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px]">
              {deployment.requestSchema}
            </pre>
          </Field>
          <Field label="Response schema">
            <pre className="max-h-32 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px]">
              {deployment.responseSchema}
            </pre>
          </Field>
        </PanelSection>

        {deployment.deployedAt && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Deployed {new Date(deployment.deployedAt).toLocaleString()}
          </p>
        )}

        <Button className="w-full bg-red-600 hover:bg-red-700" disabled={!canDeploy} onClick={onDeploy}>
          Redeploy
        </Button>
      </div>
    </div>
  )
})

function CopyField({ value, onCopy }: { value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2.5 py-2 font-mono text-[10px]">
        {value}
      </code>
      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
