import { memo } from 'react'
import { memberAvatarColor, memberInitials } from '@/components/designer/share-settings'
import { cn } from '@/utils/cn'

const SIZE_CLASS = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-9 w-9 text-[10px]',
} as const

interface UserAvatarProps {
  seed: string
  initials?: string
  name?: string
  size?: keyof typeof SIZE_CLASS
  className?: string
  ringClassName?: string
  showOnline?: boolean
}

/** Initials-only avatar circle. */
export const UserAvatar = memo(function UserAvatar({
  seed,
  initials,
  name,
  size = 'sm',
  className,
  ringClassName = 'ring-2 ring-background',
  showOnline,
}: UserAvatarProps) {
  const label = initials ?? memberInitials(seed)
  const sizeClass = SIZE_CLASS[size]

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        title={name}
        aria-label={name}
        className={cn(
          'flex items-center justify-center rounded-full font-semibold text-white',
          sizeClass,
          ringClassName,
        )}
        style={{ backgroundColor: memberAvatarColor(seed) }}
      >
        {label}
      </span>
      {showOnline && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border border-background bg-emerald-500',
            size === 'md' ? 'h-2 w-2 border-2' : size === 'sm' ? 'h-2 w-2' : 'h-1.5 w-1.5',
          )}
        />
      )}
    </span>
  )
})
