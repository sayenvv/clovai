import { Badge } from '@/components/ui/badge'
import type { SpanStatus } from '@/services/traces-api'
import { cn } from '@/utils/cn'

const STATUS: Record<SpanStatus | 'RUNNING', { label: string; tone: string }> = {
  OK: { label: 'Succeeded', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  UNSET: { label: 'Succeeded', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  ERROR: { label: 'Failed', tone: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300' },
  RUNNING: { label: 'Running', tone: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300' },
}

export function TraceStatusBadge({ status }: { status: SpanStatus | 'RUNNING' }) {
  const { label, tone } = STATUS[status]
  return (
    <Badge variant="outline" className={cn('text-[10px] font-normal', tone)}>
      {label}
    </Badge>
  )
}

/** Bar colour per span kind in the waterfall. */
export function spanTone(operation: string | null, name: string, failed: boolean): string {
  if (failed) return 'bg-red-500/80'
  if (operation === 'invoke_agent') return 'bg-violet-500/80'
  if (operation === 'chat') return 'bg-sky-500/80'
  if (operation === 'execute_tool') return 'bg-amber-500/80'
  if (name.startsWith('executor.')) return 'bg-emerald-500/70'
  return 'bg-foreground/40'
}

export const SPAN_LEGEND = [
  { label: 'Agent', tone: 'bg-violet-500/80' },
  { label: 'Model call', tone: 'bg-sky-500/80' },
  { label: 'Tool call', tone: 'bg-amber-500/80' },
  { label: 'Executor', tone: 'bg-emerald-500/70' },
  { label: 'Workflow', tone: 'bg-foreground/40' },
  { label: 'Error', tone: 'bg-red-500/80' },
]
