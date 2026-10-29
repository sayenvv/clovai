import { memo, useState } from 'react'
import { Check, Search, Target } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SavedWorkflowSummary } from '@/services/activity-api'
import { cn } from '@/utils/cn'

/**
 * "Ask about a workflow": picks one of the user's saved workflows for the assistant to read (it does not edit
 * it), so a question can be about something other than the open draft.
 */
export const WorkflowReferencePicker = memo(function WorkflowReferencePicker({
  workflows,
  selectedId,
  onSelect,
  disabled = false,
}: {
  workflows: SavedWorkflowSummary[]
  selectedId: string
  onSelect: (workflowId: string) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = workflows.filter((workflow) => !needle || (workflow.name || '').toLowerCase().includes(needle)).slice(0, 30)

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery('')}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-muted',
            selectedId ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label="Ask about a saved workflow"
          title="Ask about a saved workflow"
        >
          <Target className="h-4 w-4" />
          <span className="hidden sm:inline">Workflow</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          Ask about one of your saved workflows. The assistant reads it; it does not change it.
        </DropdownMenuLabel>
        <div className="px-2 pb-1.5" onKeyDown={(event) => event.stopPropagation()}>
          <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2 text-xs">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workflows"
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              aria-label="Search workflows"
            />
          </label>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {shown.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{workflows.length ? 'No workflow matches.' : 'No saved workflows yet.'}</p>
          ) : (
            shown.map((workflow) => (
              <DropdownMenuItem
                key={workflow.workflow_id}
                onSelect={() => onSelect(workflow.workflow_id === selectedId ? '' : workflow.workflow_id)}
                className="gap-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs">{workflow.name || 'Untitled workflow'}</span>
                {workflow.workflow_id === selectedId ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
