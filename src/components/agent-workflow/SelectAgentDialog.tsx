import { memo } from 'react'
import { Bot } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { DiagramNode } from '@/components/designer/diagram-types'

interface SelectAgentDialogProps {
  open: boolean
  agents: DiagramNode[]
  onSelect: (agentId: string) => void
  onOpenChange: (open: boolean) => void
}

export const SelectAgentDialog = memo(function SelectAgentDialog({
  open,
  agents,
  onSelect,
  onOpenChange,
}: SelectAgentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose an agent</DialogTitle>
          <DialogDescription>
            Tools must be mapped to an agent. Select which agent this tool belongs to.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {agents.map((agent) => (
            <Button
              key={agent.id}
              variant="outline"
              className="h-auto w-full justify-start gap-3 px-3 py-2.5"
              onClick={() => {
                onSelect(agent.id)
                onOpenChange(false)
              }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/10 text-violet-600">
                <Bot className="h-4 w-4" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-medium">{agent.label}</span>
                <span className="block text-xs text-muted-foreground">Map tool here</span>
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
})
