import { memo } from 'react'
import { cn } from '@/utils/cn'

export const LOGO_SRC = '/logo.png'
export const LOGO_SIZE = 36
/** Compact logo for tool / flowchart workspace chrome */
export const LOGO_SIZE_WORKSPACE = 28

interface LogoProps {
  src?: string
  size?: number
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | 'full'
  className?: string
}

const ROUNDED: Record<NonNullable<LogoProps['rounded']>, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
}

/** App logo mark — colorful circular emblem. */
export const Logo = memo(function Logo({
  src = LOGO_SRC,
  size = LOGO_SIZE,
  rounded = 'lg',
  className,
}: LogoProps) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden', ROUNDED[rounded], className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain"
        decoding="async"
      />
    </span>
  )
})
