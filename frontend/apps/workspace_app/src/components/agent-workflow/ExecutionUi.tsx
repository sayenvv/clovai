import type { ReactNode } from 'react'
import { CircleSlash, Clock, Cpu } from 'lucide-react'
import { cn } from '@/utils/cn'
import { ChatMarkdown } from '@/components/agent-workflow/ChatMarkdown'
import { asMarkdown, type ModelCallState } from '@/components/agent-workflow/execution-telemetry'

/** "Model called" yes / no / unknown, with the number of calls when there were any. */
export function ModelCalledBadge({ state, calls, className }: { state: ModelCallState; calls?: number; className?: string }) {
  const label =
    state === 'called'
      ? `Model called${calls && calls > 1 ? ` ×${calls}` : ''}`
      : state === 'not-called'
        ? 'No model call'
        : 'Model call unknown'
  return (
    <span
      title={
        state === 'called'
          ? `This step called a model ${calls ?? ''} time${calls === 1 ? '' : 's'}.`
          : state === 'not-called'
            ? 'This step ran without calling a model (code, a validator, a router or an aggregator).'
            : 'Not known: this run has no server trace.'
      }
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
        state === 'called'
          ? 'border-sky-500/30 bg-sky-500/[0.08] text-sky-700 dark:text-sky-300'
          : state === 'not-called'
            ? 'border-border bg-foreground/[0.04] text-muted-foreground'
            : 'border-dashed border-border text-muted-foreground',
        className,
      )}
    >
      {state === 'not-called' ? <CircleSlash className="h-2.5 w-2.5" /> : <Cpu className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <h3 className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h3>
      {aside}
    </div>
  )
}

export function Stat({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Clock
  label: string
  value: string
  detail?: string
  tone?: string
}) {
  return (
    <div className="min-w-0 rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn('mt-1 truncate text-[20px] font-semibold leading-7 tabular-nums tracking-[-0.01em] text-foreground', tone)}>
        {value}
      </div>
      {detail ? <div className="truncate text-[10.5px] tabular-nums text-muted-foreground">{detail}</div> : null}
    </div>
  )
}

export function Legend({ items }: { items: Array<{ label: string; swatch: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-[2px]', item.swatch)} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/** A shared hover card for every chart mark, following the pointer. */
export function IoBlock({ label, text, empty }: { label: string; text: string; empty: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="max-h-72 overflow-y-auto rounded-[3px] border border-border/70 bg-background px-3 py-2">
        {text.trim() ? (
          <ChatMarkdown content={asMarkdown(text)} className="text-[12px]" />
        ) : (
          <p className="text-[11.5px] text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  )
}
