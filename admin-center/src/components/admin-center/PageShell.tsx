import type { ReactNode } from 'react'
import { AdminNotificationsMenu } from '@/components/admin-center/AdminNotificationsMenu'
import { AdminProfileMenu } from '@/components/admin-center/AdminProfileMenu'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { cn } from '@/utils/cn'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'relative z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 truncate text-[11.5px] leading-none text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <span className="mx-1 hidden h-6 w-px bg-border/60 md:block" aria-hidden />
        <AdminNotificationsMenu />
        <ThemeToggle />
        <AdminProfileMenu />
      </div>
    </header>
  )
}

export function PageBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', className)}>{children}</div>
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
        'rounded-xl border border-dashed border-border/80 bg-card/40 px-4 py-12 text-center',
        className,
      )}
    >
      <p className="text-[12px] font-medium text-foreground">{title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}
