import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** A content card in the workspace app's style: hairline border on the card surface. */
export function PremiumCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm', className)}>
      {children}
    </div>
  )
}
