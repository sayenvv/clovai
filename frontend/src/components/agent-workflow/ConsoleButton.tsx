import { memo } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

interface ConsoleButtonProps {
  className?: string
  size?: 'sm' | 'md'
}

/** Portal-style Console entry — same idea as AWS / Azure console launchers. */
export const ConsoleButton = memo(function ConsoleButton({
  className,
  size = 'sm',
}: ConsoleButtonProps) {
  return (
    <Link
      to={ROUTES.agentWorkflowDashboard}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-gradient-to-r from-red-600 to-rose-600 font-semibold text-white shadow-[0_8px_18px_-12px_rgba(220,38,38,0.95)] transition-[transform,box-shadow,filter] hover:brightness-110 hover:shadow-[0_10px_22px_-12px_rgba(220,38,38,1)] active:scale-[0.98]',
        size === 'sm' ? 'h-8 px-2.5 text-[12px]' : 'h-9 px-3 text-[13px]',
        className,
      )}
    >
      <LayoutDashboard className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      Console
    </Link>
  )
})
