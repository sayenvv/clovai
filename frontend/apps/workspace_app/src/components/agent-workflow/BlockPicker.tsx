import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CircleStop, GitFork, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  CAPABILITY_VISUALS,
  LIBRARY_AGENTS,
  LIBRARY_ORCHESTRATORS,
  ORCHESTRATOR_TILE,
} from '@/components/agent-workflow/AgentLibrarySidebar'
import { AGENT_CAPABILITIES, type AgentCapabilityKind } from '@/components/agent-workflow/agent-capabilities'

export interface BlockPickerState {
  x: number
  y: number
  /** Shown as the picker's title, e.g. "Add after Researcher". */
  title: string
  /** Tools, skills and other capabilities can go under the source agent (adding after an agent). */
  allowCapabilities: boolean
  /** Offer End (not when inserting between two nodes). */
  allowEnd: boolean
}

interface PickerItem {
  key: string
  group: string
  label: string
  description: string
  icon: LucideIcon
  tile: string
  pick: () => void
}

/**
 * A searchable menu of everything that can follow a node: orchestrators and agents (added and
 * connected) and, under an agent, its tools, skills, integrations, MCP servers and memory.
 */
export const BlockPicker = memo(function BlockPicker({
  state,
  onPickBlock,
  onPickCapability,
  onClose,
}: {
  state: BlockPickerState
  onPickBlock: (paletteId: string) => void
  onPickCapability: (capabilityId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const items = useMemo<PickerItem[]>(() => {
    const blocks: PickerItem[] = [
      ...LIBRARY_ORCHESTRATORS.map((item) => ({
        key: item.paletteId,
        group: 'Orchestration',
        label: item.label,
        description: item.description,
        icon: item.icon,
        tile: ORCHESTRATOR_TILE,
        pick: () => onPickBlock(item.paletteId),
      })),
      ...LIBRARY_AGENTS.map((item) => ({
        key: item.paletteId,
        group: 'Agents',
        label: item.label,
        description: item.description,
        icon: item.icon,
        tile: 'bg-foreground/10 text-foreground ring-foreground/20',
        pick: () => onPickBlock(item.paletteId),
      })),
    ]
    blocks.push({
      key: 'aw-switch',
      group: 'Flow',
      label: 'Switch',
      description: 'Route to one next agent by case; the connector without a condition is the default',
      icon: GitFork,
      tile: 'bg-muted text-foreground/70 ring-border',
      pick: () => onPickBlock('aw-switch'),
    })
    if (state.allowEnd) {
      blocks.push({
        key: 'aw-end',
        group: 'Flow',
        label: 'End',
        description: 'Finish the workflow here',
        icon: CircleStop,
        tile: 'bg-muted text-foreground/70 ring-border',
        pick: () => onPickBlock('aw-end'),
      })
    }
    if (!state.allowCapabilities) return blocks
    const capabilities: PickerItem[] = AGENT_CAPABILITIES.map((capability) => {
      const visual = CAPABILITY_VISUALS[capability.kind as AgentCapabilityKind]
      return {
        key: capability.id,
        group: visual.title,
        label: capability.label,
        description: capability.description,
        icon: visual.icon,
        tile: visual.tile,
        pick: () => onPickCapability(capability.id),
      }
    })
    return [...blocks, ...capabilities]
  }, [state.allowCapabilities, state.allowEnd, onPickBlock, onPickCapability])

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? items.filter((item) => `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(needle))
    : items
  useEffect(() => setHighlight(0), [needle])

  const choose = (item: PickerItem | undefined) => {
    if (!item) return
    item.pick()
    onClose()
  }

  // Keep the menu on screen.
  const width = 320
  const height = 420
  const left = Math.max(8, Math.min(state.x, window.innerWidth - width - 8))
  const top = Math.max(8, Math.min(state.y, window.innerHeight - height - 8))

  let lastGroup = ''
  return (
    <>
      <button type="button" className="fixed inset-0 z-[60] cursor-default" aria-label="Close" onClick={onClose} />
      <div
        className="fixed z-[70] flex flex-col overflow-hidden rounded-xl border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
        style={{ left, top, width, maxHeight: height }}
        role="dialog"
        aria-label={state.title}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border/70 p-2">
          <p className="truncate px-1 pb-1.5 text-[11px] font-medium text-muted-foreground">{state.title}</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') onClose()
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setHighlight((value) => Math.min(value + 1, shown.length - 1))
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setHighlight((value) => Math.max(value - 1, 0))
                }
                if (event.key === 'Enter') choose(shown[highlight])
              }}
              placeholder="Search agents, tools, skills…"
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {shown.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing matches.</p>
          ) : (
            shown.map((item, index) => {
              const heading = item.group !== lastGroup ? item.group : null
              lastGroup = item.group
              const Icon = item.icon
              return (
                <div key={`${item.group}-${item.key}`}>
                  {heading ? (
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {heading}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(item)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                      index === highlight ? 'bg-muted' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset', item.tile)}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-foreground">{item.label}</span>
                      <span className="block truncate text-[10.5px] text-muted-foreground">{item.description}</span>
                    </span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
})
