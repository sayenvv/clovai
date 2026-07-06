import { memo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  ListTree,
  Loader2,
  Radio,
  Wrench,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'
import { listAgentNodes, listToolsForAgent } from '@/components/agent-workflow/tool-agent-mapping'
import type { Diagram } from '@/components/designer/diagram-types'
import type { WorkflowExecutionEvent, WorkflowRunState } from '@/types/agent-workflow'

interface ExecutionInspectorPanelProps {
  diagram: Diagram
  runState: WorkflowRunState
}

export const ExecutionInspectorPanel = memo(function ExecutionInspectorPanel({
  diagram,
  runState,
}: ExecutionInspectorPanelProps) {
  const rawCount = runState.events.length
  const displayCount = runState.events.filter((event) => event.kind !== 'tool-invoke').length

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        <Accordion type="multiple" defaultValue={['events', 'traces']} className="w-full">
      <AccordionItem value="events" className="border-border/60">
        <AccordionTrigger className="gap-2 py-2.5 text-[11px] font-semibold hover:no-underline">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Events
            {rawCount > 0 && (
              <Badge variant="outline" className="ml-auto h-4 border-0 px-1 text-[9px]">
                {displayCount}
              </Badge>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2 pt-0">
          {runState.events.length === 0 ? (
            <EmptyHint message="Runtime events will stream here during execution." />
          ) : (
            <ul className="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5">
              {runState.events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="traces" className="border-border/60">
        <AccordionTrigger className="gap-2 py-2.5 text-[11px] font-semibold hover:no-underline">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <ListTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Traces
            {runState.trace.length > 0 && (
              <Badge variant="outline" className="ml-auto h-4 border-0 px-1 text-[9px]">
                {runState.trace.length}
              </Badge>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2 pt-0">
          {runState.trace.length === 0 ? (
            <EmptyHint message="Step traces appear here as agents run." />
          ) : (
            <ol className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
              {runState.trace.map((step, index) => (
                <li
                  key={step.id}
                  className={cn(
                    'rounded-md border px-3 py-2 text-xs',
                    step.status === 'running' && 'border-primary/30 bg-primary/5',
                    step.status === 'completed' && 'border-emerald-500/30 bg-emerald-500/5',
                    step.status === 'waiting-approval' && 'border-amber-500/30 bg-amber-500/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{step.agentName}</span>
                    <TraceBadge status={step.status} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {index + 1}. {new Date(step.timestamp).toLocaleTimeString()}
                  </p>
                  {step.output && (
                    <pre className="mt-2 max-h-24 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px]">
                      {step.output.slice(0, 280)}
                    </pre>
                  )}
                </li>
              ))}
            </ol>
          )}

          {(runState.errors.length > 0 || runState.warnings.length > 0) && (
            <div className="mt-4 space-y-3 border-t border-border pt-3">
              {runState.errors.length > 0 && (
                <IssueBlock title="Errors" items={runState.errors} tone="error" />
              )}
              {runState.warnings.length > 0 && (
                <IssueBlock title="Warnings" items={runState.warnings} tone="warning" />
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="tools" className="border-border/60 border-b-0">
        <AccordionTrigger className="gap-2 py-2.5 text-[11px] font-semibold hover:no-underline">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            Tools
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-2 pt-0">
          <div className="max-h-64 overflow-y-auto overscroll-contain pr-0.5">
            <ToolList diagram={diagram} runState={runState} />
          </div>
        </AccordionContent>
      </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
})

function EventRow({ event }: { event: WorkflowExecutionEvent }) {
  const [open, setOpen] = useState(false)
  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <li className="rounded-md text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
      >
        <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground">{time}</span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'font-mono',
              event.level === 'success' && 'text-emerald-600 dark:text-emerald-400',
              event.level === 'error' && 'text-red-600 dark:text-red-400',
              event.level === 'warning' && 'text-amber-600 dark:text-amber-400',
              event.level === 'info' && 'text-foreground',
            )}
          >
            {event.message}
          </span>
          {event.detail && !open && (
            <span className="ml-2 text-muted-foreground">· {event.detail}</span>
          )}
        </span>
        {event.detail ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : null}
      </button>
      {open && event.detail && (
        <div className="ml-12 mr-2 mb-1 rounded border border-border/60 bg-muted/30 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
          {event.agentName && <p>Agent: {event.agentName}</p>}
          <p>{event.detail}</p>
        </div>
      )}
    </li>
  )
}

function TraceBadge({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <Badge variant="outline" className="h-5 gap-1 border-0 bg-primary/10 text-[9px] text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        running
      </Badge>
    )
  }
  if (status === 'completed') {
    return (
      <Badge variant="outline" className="h-5 gap-1 border-0 bg-emerald-500/10 text-[9px] text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        done
      </Badge>
    )
  }
  if (status === 'waiting-approval') {
    return (
      <Badge variant="outline" className="h-5 gap-1 border-0 bg-amber-500/10 text-[9px] text-amber-600">
        <Clock className="h-3 w-3" />
        approval
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="h-5 border-0 text-[9px] capitalize text-muted-foreground">
      {status}
    </Badge>
  )
}

function IssueBlock({
  title,
  items,
  tone,
}: {
  title: string
  items: WorkflowExecutionEvent[]
  tone: 'error' | 'warning'
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
        <AlertTriangle className={cn('h-3.5 w-3.5', tone === 'error' ? 'text-red-500' : 'text-amber-500')} />
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex gap-2 text-[11px] text-muted-foreground">
            <Circle className="mt-1 h-2 w-2 shrink-0 fill-current" />
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ToolList({ diagram, runState }: { diagram: Diagram; runState: WorkflowRunState }) {
  const agents = listAgentNodes(diagram)
  if (agents.length === 0) {
    return <EmptyHint message="No agents with tools in this workflow." />
  }

  return (
    <ul className="space-y-3">
      {agents.map((agent) => {
        const tools = listToolsForAgent(diagram, agent.id)
        const ran = runState.completedNodeIds.includes(agent.id)
        return (
          <li key={agent.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-xs font-medium">{agent.label}</p>
              {ran && (
                <Badge variant="outline" className="h-5 border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-700 dark:text-emerald-400">
                  executed
                </Badge>
              )}
            </div>
            {tools.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">No mapped tools</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {tools.map((tool) => (
                  <li
                    key={tool.id}
                    className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
                  >
                    <Wrench className="h-3 w-3 text-blue-500" />
                    {tool.label}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex h-24 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 px-4 text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}
