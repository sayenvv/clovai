import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Badge as BadgeConfig } from '@/types/config'

/** Renders a badge object coming from JSON configuration. */
export const ConfigBadge = memo(function ConfigBadge({
  badge,
  className,
}: {
  badge?: BadgeConfig
  className?: string
}) {
  if (!badge) return null
  return (
    <Badge variant={badge.variant} className={className}>
      {badge.label}
    </Badge>
  )
})
