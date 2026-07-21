import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

/** Soft glass card with a subtle brand-edge highlight — Orbit-inspired, Eleven Nodes palette. */
export function PremiumCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-sm',
        'ring-1 ring-inset ring-primary/[0.04]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
        aria-hidden
      />
      {children}
    </div>
  )
}
