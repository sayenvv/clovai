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
    <div className={cn('overflow-hidden rounded-[3px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      {children}
    </div>
  )
}
