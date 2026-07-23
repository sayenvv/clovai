import { memo, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface MobilePageShellProps {
  children: ReactNode
  className?: string
  /** Soft canvas background vs solid card surface */
  tone?: 'canvas' | 'surface'
}

/** Full-screen mobile page body under the app header / above the tab bar. */
export const MobilePageShell = memo(function MobilePageShell({
  children,
  className,
  tone = 'surface',
}: MobilePageShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden',
        tone === 'canvas' ? 'bg-[hsl(var(--canvas))]' : 'bg-background',
        className,
      )}
    >
      {children}
    </div>
  )
})
