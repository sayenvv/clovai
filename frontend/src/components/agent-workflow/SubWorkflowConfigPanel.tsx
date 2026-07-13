import { memo } from 'react'
import { ExternalLink, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { DiagramDocument, DiagramNode } from '@/components/designer/diagram-types'
import { subWorkflowAgentCount } from '@/components/agent-workflow/sub-workflow-ops'

interface SubWorkflowConfigPanelProps {
  node: DiagramNode
  doc: DiagramDocument
  onOpenSubWorkflow: (pageId: string) => void
}

export const SubWorkflowConfigPanel = memo(function SubWorkflowConfigPanel({
  node,
  doc,
  onOpenSubWorkflow,
}: SubWorkflowConfigPanelProps) {
  const pageId = node.subWorkflowPageId
  const linkedPage = pageId ? doc.pages.find((page) => page.id === pageId) : undefined
  const agentCount = subWorkflowAgentCount(doc, node)

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-300">
          <GitBranch className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Sub-workflow agent</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Runs a nested workflow as a single step in the parent flow. Mount this agent in other
            workflows to reuse the same pipeline.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Linked workflow</Label>
          <p className="mt-1 text-sm font-medium text-foreground">
            {linkedPage?.name ?? 'Missing page'}
          </p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Agents inside</Label>
          <p className="mt-1 text-sm text-foreground">
            {agentCount} agent{agentCount === 1 ? '' : 's'}
          </p>
        </div>
        {node.agent?.description && (
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <p className="mt-1 text-sm text-muted-foreground">{node.agent.description}</p>
          </div>
        )}
      </div>

      {pageId && linkedPage && (
        <Button
          type="button"
          variant="secondary"
          className="mt-6 w-full gap-2"
          onClick={() => onOpenSubWorkflow(pageId)}
        >
          <ExternalLink className="h-4 w-4" />
          Open sub-workflow
        </Button>
      )}
    </div>
  )
})
