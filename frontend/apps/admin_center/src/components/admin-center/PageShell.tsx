import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** Same content width and gutters as the workspace console. */
const CONTENT = 'mx-auto w-full max-w-6xl px-4 md:px-6'

/** The page title block. Global controls (notifications, theme, profile) live in the shell's top bar. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn(CONTENT, 'pt-5 md:pt-6', className)}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-0.5 truncate text-base font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
      </div>
    </div>
  )
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(CONTENT, 'pb-6 md:pb-8', className)}>{children}</div>
}

export function EmptyHint({
  title,
  hint,
  className,
}: {
  title: string
  hint: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border/80 bg-card/60 px-4 py-10 text-center',
        className,
      )}
    >
      <p className="text-[12px] font-medium text-foreground">{title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}
