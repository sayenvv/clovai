import { memo } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Play,
  Square,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Logo, LOGO_SIZE_WORKSPACE } from '@/components/shared/Logo'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import type { WorkflowRunStatus } from '@/types/agent-workflow'

interface WorkflowOption {
  id: string
  name: string
}

interface ExecutionPageHeaderProps {
  workflows: WorkflowOption[]
  selectedWorkflowId: string
  onWorkflowChange: (workflowId: string) => void
  stepCount: number
  runStatus: WorkflowRunStatus
  isRunning: boolean
  onExecute: () => void
  onStop: () => void
  workflowSelectDisabled?: boolean
}

const STATUS_STYLES: Record<WorkflowRunStatus, string> = {
  idle: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
  running: 'border-primary/40 bg-primary/10 text-primary',
  'waiting-approval': 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  completed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  failed: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  cancelled: 'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
}

export const ExecutionPageHeader = memo(function ExecutionPageHeader({
  workflows,
  selectedWorkflowId,
  onWorkflowChange,
  stepCount,
  runStatus,
  isRunning,
  onExecute,
  onStop,
  workflowSelectDisabled = false,
}: ExecutionPageHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-3 backdrop-blur-sm">
      <Link to="/" className="shrink-0" aria-label="Clovai home">
        <Logo size={LOGO_SIZE_WORKSPACE} />
      </Link>

      <div className="h-5 w-px bg-border" />

      <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 px-2">
        <Link to="/tools/agent-workflow">
          <ArrowLeft className="h-3.5 w-3.5" />
          Editor
        </Link>
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Select
          value={selectedWorkflowId}
          onChange={(event) => onWorkflowChange(event.target.value)}
          disabled={workflowSelectDisabled}
          className="h-8 max-w-[220px] text-sm font-semibold"
          aria-label="Select workflow"
        >
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name}
            </option>
          ))}
        </Select>
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
          {stepCount} step{stepCount === 1 ? '' : 's'}
        </Badge>
        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
          Execution
        </Badge>
        <Badge variant="outline" className={cnBadge(STATUS_STYLES[runStatus])}>
          {runStatus === 'running' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {runStatus === 'completed' && <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
          {runStatus === 'failed' && <XCircle className="mr-1 h-3 w-3 text-red-600 dark:text-red-400" />}
          {runStatus === 'waiting-approval' && <AlertTriangle className="mr-1 h-3 w-3" />}
          <span className="capitalize">{runStatus.replace('-', ' ')}</span>
        </Badge>
      </div>

      <div className="flex items-center gap-1.5">
        {isRunning ? (
          <Button variant="outline" size="sm" onClick={onStop}>
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={onExecute}>
            <Play className="h-3.5 w-3.5" />
            Execute
          </Button>
        )}
      </div>

      <ProfileMenu />
    </header>
  )
})

function cnBadge(className: string) {
  return `shrink-0 text-[10px] font-normal capitalize ${className}`
}
