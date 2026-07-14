import { memo, type MouseEvent, type PointerEvent } from 'react'
import { Bot, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  childKindForPalette,
  isExternalAgentPalette,
  resolveExternalAgent,
} from '@/components/agent-workflow/agent-workflow-defaults'
import { AgentNodeAvatar } from '@/components/agent-workflow/external-agent-ui'
import { isExecutorNode, isMcpToolNode, isToolNode } from '@/components/agent-workflow/tool-agent-mapping'
import type { DiagramNode } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'

/** Dock / config actions from the agent card. */
export type AgentAttachAction =
  | 'model'
  | 'tool'
  | 'skill'
  | 'integration'
  | 'memory'
  | 'mcp'
  | 'knowledge'
  | 'config'

export interface MappedChildCounts {
  tool: number
  skill: number
  memory: number
  integration: number
  mcp: number
}

export type AgentDockSlot = {
  id: 'model' | 'memory' | 'tool' | 'knowledge'
  label: string
  action: AgentAttachAction
  required?: boolean
  /** Horizontal center as a fraction of node width (0–1) for map-line anchors. */
  x: number
}

/**
 * Bottom capability docks — diamonds on the edge, dangling `+` when empty.
 * Keep `x` in sync with DesignerCanvas mapping lines.
 */
export const AGENT_DOCK_SLOTS: AgentDockSlot[] = [
  { id: 'model', label: 'Chat Model', action: 'model', required: true, x: 0.14 },
  { id: 'memory', label: 'Memory', action: 'memory', x: 0.38 },
  { id: 'tool', label: 'Tool', action: 'tool', x: 0.62 },
  { id: 'knowledge', label: 'Knowledge', action: 'knowledge', x: 0.86 },
]

/** Space reserved visually under the card for labels / plus. */
export const AGENT_DOCK_HANG = 44

const TYPE_LABELS: Record<string, string> = {
  llm: 'AI Agent',
  specialist: 'Specialist',
  tool: 'Tool',
  planner: 'Planner',
  human: 'Human review',
  router: 'Router',
  trigger: 'Trigger',
  memory: 'Memory',
  output: 'Output',
  control: 'Control',
  executor: 'Executor',
}

function stopCanvas(event: MouseEvent | PointerEvent) {
  event.stopPropagation()
  event.preventDefault()
}

function childKindLabel(paletteId: string): string {
  const kind = childKindForPalette(paletteId)
  switch (kind) {
    case 'mcp':
      return 'MCP'
    case 'skill':
      return 'Skill'
    case 'integration':
      return 'Integration'
    case 'memory':
      return 'Memory'
    default:
      return 'Tool'
  }
}

interface AgentNodeCardProps {
  node: DiagramNode
  item: PaletteItem
  isSelected: boolean
  isDark: boolean
  className?: string
  mappedUnderLabel?: string
  mappedChildren?: MappedChildCounts
  onAttachAction?: (agentId: string, action: AgentAttachAction) => void
}

export const AgentNodeCard = memo(function AgentNodeCard({
  node,
  item,
  isSelected,
  className,
  mappedUnderLabel,
  mappedChildren = { tool: 0, skill: 0, memory: 0, integration: 0, mcp: 0 },
  onAttachAction,
}: AgentNodeCardProps) {
  const agent = node.agent
  const toolNode = isToolNode(node)
  const mcpTool = isMcpToolNode(node)
  const executorNode = isExecutorNode(node)
  const externalAgent = resolveExternalAgent(node.paletteId)
  const title =
    node.label?.trim() ||
    (externalAgent ? externalAgent.label : TYPE_LABELS[agent?.agentType ?? 'llm'] ?? item.label)

  if (toolNode || executorNode) {
    const kind = executorNode ? 'Executor' : childKindLabel(node.paletteId)

    return (
      <div
        className={cn(
          'flex h-full w-full items-center gap-2 overflow-hidden rounded-[10px]',
          'border border-[#3F3F46] bg-[#27272A] px-2.5',
          'transition-[border-color,box-shadow] duration-150',
          isSelected && 'border-[#71717A] shadow-[0_0_0_1px_rgba(113,113,122,0.35)]',
          className,
        )}
        title={mappedUnderLabel ? `${title} · under ${mappedUnderLabel}` : title}
      >
        <div className="flex size-6 shrink-0 items-center justify-center text-[#A1A1AA]">
          <AgentNodeAvatar
            paletteId={node.paletteId}
            toolNode={toolNode && !mcpTool}
            size="xs"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-tight text-[#F4F4F5]">{title}</p>
          <p className="mt-px truncate text-[10px] leading-tight text-[#71717A]">{kind}</p>
        </div>
      </div>
    )
  }

  const configured = Boolean(agent?.model?.trim())
  const tools = mappedChildren.tool + mappedChildren.mcp
  const memory = mappedChildren.memory
  const knowledge = mappedChildren.skill + mappedChildren.integration

  const slotConnected = (id: AgentDockSlot['id']) => {
    if (id === 'model') return configured
    if (id === 'tool') return tools > 0
    if (id === 'memory') return memory > 0
    return knowledge > 0
  }

  const slotCount = (id: AgentDockSlot['id']) => {
    if (id === 'model') return configured ? 1 : 0
    if (id === 'tool') return tools
    if (id === 'memory') return memory
    return knowledge
  }

  /** Empty ports always show +; multi docks keep + when selected so more can be added. */
  const showPlus = (slot: AgentDockSlot, connected: boolean) => {
    if (!onAttachAction) return false
    if (!connected) return true
    return (slot.id === 'tool' || slot.id === 'knowledge') && isSelected
  }

  return (
    <div className={cn('agent-wf-node group relative h-full w-full overflow-visible', className)}>
      {/* Card — icon + title only */}
      <div
        className={cn(
          'flex h-full w-full items-center gap-2.5 overflow-hidden rounded-[12px]',
          'border border-[#3F3F46] bg-[#27272A] px-3',
          'shadow-[0_2px_10px_rgba(0,0,0,0.28)]',
          'transition-[border-color,box-shadow] duration-150',
          'hover:border-[#52525B]',
          isSelected && 'border-[#71717A] shadow-[0_0_0_1px_rgba(161,161,170,0.35),0_4px_14px_rgba(0,0,0,0.35)]',
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center text-[#E4E4E7]" aria-hidden>
          {isExternalAgentPalette(node.paletteId) ? (
            <AgentNodeAvatar paletteId={node.paletteId} size="sm" />
          ) : (
            <Bot className="size-5 stroke-[1.5]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium leading-none tracking-[-0.01em] text-[#FAFAFA]">
            {title}
          </div>
        </div>
      </div>

      {/* Docks */}
      <div className="pointer-events-none absolute inset-x-0 top-full z-20">
        {AGENT_DOCK_SLOTS.map((slot) => {
          const connected = slotConnected(slot.id)
          const count = slotCount(slot.id)
          const plus = showPlus(slot, connected)

          return (
            <div
              key={slot.id}
              className="pointer-events-none absolute top-0 -translate-x-1/2"
              style={{ left: `${slot.x * 100}%` }}
            >
              <button
                type="button"
                disabled={!onAttachAction}
                className={cn(
                  'pointer-events-auto absolute top-0 left-1/2 flex size-3.5 -translate-x-1/2 -translate-y-1/2',
                  'items-center justify-center',
                  'focus-visible:outline-none',
                  !onAttachAction && 'cursor-default',
                )}
                title={
                  connected
                    ? count > 1
                      ? `${slot.label} · ${count}`
                      : slot.label
                    : `Add ${slot.label.toLowerCase()}`
                }
                aria-label={`${slot.label}${count > 0 ? ` (${count})` : ''}`}
                onPointerDown={stopCanvas}
                onClick={(event) => {
                  stopCanvas(event)
                  onAttachAction?.(node.id, slot.action)
                }}
              >
                <span
                  className={cn(
                    'block size-2 rotate-45 border transition-colors duration-150',
                    connected
                      ? 'border-[#A1A1AA] bg-[#27272A]'
                      : 'border-[#52525B] bg-[#27272A] group-hover:border-[#71717A]',
                  )}
                  aria-hidden
                />
              </button>

              <span
                className={cn(
                  'pointer-events-none absolute top-[8px] left-1/2 -translate-x-1/2 whitespace-nowrap',
                  'text-[9px] font-medium leading-none tracking-wide',
                  connected ? 'text-[#A1A1AA]' : 'text-[#52525B]',
                )}
              >
                {slot.label}
                {slot.required ? <span className="text-[#737373]">*</span> : null}
              </span>

              {plus ? (
                <div className="pointer-events-none absolute top-[22px] left-1/2 flex -translate-x-1/2 flex-col items-center">
                  <span className="h-2.5 w-px bg-[#3F3F46]" aria-hidden />
                  <button
                    type="button"
                    className={cn(
                      'pointer-events-auto flex size-5 items-center justify-center rounded-[4px]',
                      'border border-[#3F3F46] bg-[#18181B] text-[#A1A1AA]',
                      'transition-[border-color,color,background-color] duration-150',
                      'hover:border-[#71717A] hover:bg-[#27272A] hover:text-[#E4E4E7]',
                      'focus-visible:outline-none',
                    )}
                    title={`Add ${slot.label.toLowerCase()}`}
                    aria-label={`Add ${slot.label}`}
                    onPointerDown={stopCanvas}
                    onClick={(event) => {
                      stopCanvas(event)
                      onAttachAction?.(node.id, slot.action)
                    }}
                  >
                    <Plus className="size-3" strokeWidth={2} />
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
})
