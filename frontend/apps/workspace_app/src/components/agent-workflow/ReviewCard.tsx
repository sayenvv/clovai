import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { NODE_ICON_TILE } from '@/components/agent-workflow/node-surface'
import { cn } from '@/utils/cn'

/**
 * The card a run shows while it waits for a person: the manager's plan in the Workflow AI
 * chat, or a human-in-the-loop handoff in the run chat. Neutral, so it matches the theme;
 * the only colour is the small "awaiting review" dot.
 */
export function ReviewCard({
  icon: Icon,
  title,
  subtitle,
  status = 'Awaiting review',
  children,
  footer,
  className,
}: {
  icon: LucideIcon
  title: string
  subtitle?: ReactNode
  status?: string
  children: ReactNode
  footer: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}
      aria-label={title}
    >
      <header className="flex items-start gap-3 border-b border-border/70 px-3.5 py-3">
        <span className={cn(NODE_ICON_TILE, 'size-8')}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold leading-tight text-foreground">{title}</p>
          {subtitle ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{subtitle}</p> : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
          </span>
          {status}
        </span>
      </header>
      <div className="space-y-2.5 px-3.5 py-3">{children}</div>
      <footer className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/30 px-3.5 py-2.5">
        {footer}
      </footer>
    </section>
  )
}

/** Recessed panel for the content under review (a plan, an agent's output). */
export function ReviewContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('max-h-72 overflow-y-auto rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5', className)}>
      {children}
    </div>
  )
}

/** Feedback box, styled like the chat composer. */
export function ReviewFeedbackInput({
  value,
  onChange,
  placeholder,
  disabled,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  /** Called on ⌘/Ctrl + Enter. */
  onSubmit?: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-background transition-[border-color,box-shadow] focus-within:border-foreground/25 focus-within:shadow-sm">
      <Textarea
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[60px] resize-none border-0 bg-transparent px-3 py-2 text-[12.5px] leading-relaxed shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
        onKeyDown={(event) => {
          if (onSubmit && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
    </div>
  )
}
