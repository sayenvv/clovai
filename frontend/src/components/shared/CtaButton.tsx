import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Icon } from '@/components/shared/Icon'
import type { CtaButton as CtaButtonConfig } from '@/types/config'

interface ConfigCtaProps {
  cta: CtaButtonConfig
  size?: ButtonProps['size']
  className?: string
}

/** Renders a CTA button object coming from JSON configuration.
 *  Handles internal routing, external links, hash anchors and icons. */
export const CtaButton = memo(function CtaButton({ cta, size, className }: ConfigCtaProps) {
  const icon = cta.icon ? <Icon name={cta.icon} aria-hidden /> : null
  const content = (
    <>
      {cta.iconPosition === 'left' && icon}
      {cta.label}
      {cta.iconPosition === 'right' && icon}
    </>
  )

  const isHashLink = cta.href.includes('#')

  return (
    <Button asChild variant={cta.variant} size={size} className={className}>
      {cta.isExternal ? (
        <a href={cta.href} target="_blank" rel="noreferrer noopener">
          {content}
        </a>
      ) : isHashLink ? (
        <a href={cta.href}>{content}</a>
      ) : (
        <Link to={cta.href}>{content}</Link>
      )}
    </Button>
  )
})
