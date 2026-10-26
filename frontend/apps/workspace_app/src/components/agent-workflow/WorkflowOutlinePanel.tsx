import { memo, useState, type ReactNode } from 'react'
import { Bot, ChevronDown, ChevronRight, ChevronsLeft, FileStack, GitBranch, MoreVertical, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Diagram, DiagramPage } from '@/components/designer/diagram-types'
import { findOrchestration, PATTERN_META } from '@/components/agent-workflow/orchestration-patterns'
import { listAgentNodes, listToolsForAgent } from '@/components/agent-workflow/tool-agent-mapping'
import { cn } from '@/utils/cn'

export interface MapFilters {
  status: 'all' | 'problems'
  showTools: boolean
  fadeHealthy: boolean
}

export const DEFAULT_MAP_FILTERS: MapFilters = { status: 'all', showTools: true, fadeHealthy: true }

/** A section as in the reference: bold title, a short description, then its rows. */
function Section({
  title,
  description,
  onCollapse,
  children,
}: {
  title: string
  description: string
  onCollapse?: () => void
  children: ReactNode
}) {
  return (
    <section className="border-b border-border/80 px-3.5 pb-3 pt-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="flex h-5 w-5 items-center justify-center rounded-[2px] text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground"
            aria-label="Collapse panel"
            title="Collapse panel"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mb-2 mt-0.5 text-[10px] leading-snug text-muted-foreground">{description}</p>
      {children}
    </section>
  )
}

/** "Status: All" style setting that cycles through its values when clicked. */
function FilterRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  const index = options.findIndex((option) => option.value === value)
  const next = options[(index + 1) % options.length]
  return (
    <p className="py-0.5 text-[10.5px] text-foreground">
      {label}:{' '}
      <button type="button" onClick={() => onChange(next.value)} className="text-primary hover:underline">
        {options[index]?.label}
      </button>
    </p>
  )
}

interface WorkflowOutlinePanelProps {
  diagram: Diagram
  pages: DiagramPage[]
  activePageId: string
  onSelectPage: (pageId: string) => void
  onAddPage: () => void
  onRenamePage: (pageId: string, name: string) => void
  onDeletePage: (pageId: string) => void
  onOpenNode: (nodeId: string) => void
  filters: MapFilters
  onFiltersChange: (filters: MapFilters) => void
  workflowName: string
  modelLabel?: string
  version?: number
  statusLabel: string
  onCollapse: () => void
}

/**
 * The panel beside the icon column: the workflow's pages, the map's filters, its agents as a tree,
 * and the scope it runs in (pattern, model, version, status).
 */
export const WorkflowOutlinePanel = memo(function WorkflowOutlinePanel({
  diagram,
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onOpenNode,
  filters,
  onFiltersChange,
  workflowName,
  modelLabel,
  version,
  statusLabel,
  onCollapse,
}: WorkflowOutlinePanelProps) {
  const [agentsOpen, setAgentsOpen] = useState(true)
  const [scopeOpen, setScopeOpen] = useState<Record<string, boolean>>({})
  const agents = listAgentNodes(diagram)
  const orchestration = findOrchestration(diagram)
  const problems = agents.filter((node) => !node.agent?.modelConnectionId && !node.agent?.model).length

  const scopeRows: Array<{ id: string; label: string; value: string; detail: string }> = [
    { id: 'workflow', label: 'Workflow', value: workflowName, detail: `${pages.length} page${pages.length === 1 ? '' : 's'}` },
    {
      id: 'pattern',
      label: 'Pattern',
      value: orchestration ? PATTERN_META[orchestration.pattern].label : 'Sequential',
      detail: orchestration ? `${orchestration.participantIds.length} agents in the team` : 'Runs agents in order',
    },
    { id: 'model', label: 'Model', value: modelLabel || 'Not set', detail: 'Default model client for agents without one' },
    { id: 'version', label: 'Version', value: `v${version ?? 0}`, detail: statusLabel },
  ]

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-[hsl(var(--chrome))] [scrollbar-width:thin]">
      <Section title="Pages" description="Select the workflow page to show on the map and the canvas." onCollapse={onCollapse}>
        <ul className="-mx-1.5">
          {pages.map((page) => {
            const active = page.id === activePageId
            const Icon = page.kind === 'sub' ? GitBranch : FileStack
            return (
              <li key={page.id}>
                <div
                  className={cn(
                    'group flex h-7 items-center gap-2 rounded-[2px] px-1.5 text-[11px]',
                    active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-foreground/[0.05]',
                  )}
                >
                  <button type="button" onClick={() => onSelectPage(page.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{page.name}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] text-foreground/60 hover:bg-foreground/[0.08]"
                        aria-label={`${page.name} options`}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem
                        onSelect={() => {
                          const name = window.prompt('Page name', page.name)?.trim()
                          if (name) onRenamePage(page.id, name)
                        }}
                      >
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={pages.length <= 1} onSelect={() => onDeletePage(page.id)} className="text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={onAddPage}
          className="mt-1.5 flex h-6 items-center gap-1 rounded-[2px] px-1.5 text-[10.5px] text-foreground hover:bg-foreground/[0.06] [&_svg]:text-primary"
        >
          <Plus className="h-3 w-3" /> Add page
        </button>
      </Section>

      <Section title="Filters" description="Select a filter to reduce the map's density.">
        <FilterRow
          label="Status"
          value={filters.status}
          options={[
            { value: 'all', label: 'All' },
            { value: 'problems', label: 'Problems only' },
          ]}
          onChange={(status) => onFiltersChange({ ...filters, status })}
        />
        <FilterRow
          label="Tools"
          value={filters.showTools ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(value) => onFiltersChange({ ...filters, showTools: value === 'on' })}
        />
        <FilterRow
          label="Fade"
          value={filters.fadeHealthy ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(value) => onFiltersChange({ ...filters, fadeHealthy: value === 'on' })}
        />
      </Section>

      <Section title="Agents" description="The agents on this page. Select one to open it on the canvas.">
        <button
          type="button"
          onClick={() => setAgentsOpen((open) => !open)}
          className="-mx-0.5 flex h-6 items-center gap-1 text-[11px] font-medium text-foreground"
        >
          {agentsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          All agents
          <span className="font-normal text-muted-foreground">({agents.length})</span>
        </button>
        {agentsOpen ? (
          <ul className="ml-3.5 mt-0.5">
            {agents.length === 0 ? <li className="py-1 text-[10.5px] text-muted-foreground">No agents yet</li> : null}
            {agents.map((node) => {
              const broken = !node.agent?.modelConnectionId && !node.agent?.model
              const tools = listToolsForAgent(diagram, node.id).length
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onOpenNode(node.id)}
                    className="flex h-6 w-full items-center gap-1.5 rounded-[2px] px-1 text-left text-[10.5px] text-foreground hover:bg-foreground/[0.05]"
                  >
                    <Bot className={cn('h-3 w-3 shrink-0', broken ? 'text-red-600' : 'text-primary')} />
                    <span className="min-w-0 truncate">{node.label}</span>
                    <span className="shrink-0 text-[9.5px] text-muted-foreground">({tools})</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
        {problems > 0 ? (
          <p className="mt-1.5 text-[10px] text-red-600 dark:text-red-400">
            {problems} agent{problems === 1 ? '' : 's'} without a model
          </p>
        ) : null}
      </Section>

      <Section title="Scope" description="Where this workflow runs and what it runs on.">
        <ul className="-mx-0.5">
          {scopeRows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setScopeOpen((open) => ({ ...open, [row.id]: !open[row.id] }))}
                className="flex h-6 w-full items-center gap-1 text-left text-[10.5px] text-foreground"
              >
                {scopeOpen[row.id] ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                {row.label}
                <span className="min-w-0 truncate text-[9.5px] text-muted-foreground">({row.value})</span>
              </button>
              {scopeOpen[row.id] ? <p className="mb-1 ml-4 text-[10px] text-muted-foreground">{row.detail}</p> : null}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
})
