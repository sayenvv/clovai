import { memo, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { byOrder } from '@/utils/collection'
import { useAppConfig } from '@/hooks/use-app-config'
import { Icon } from '@/components/shared/Icon'
import { ConfigBadge } from '@/components/shared/ConfigBadge'
import type { Link as LinkConfig } from '@/types/config'

const FooterLink = memo(function FooterLink({ link }: { link: LinkConfig }) {
  const inner = (
    <span className="inline-flex items-center gap-2">
      {link.label}
      <ConfigBadge badge={link.badge} className="px-1.5 py-0 text-[10px]" />
    </span>
  )
  const className = 'text-sm text-muted-foreground transition-colors hover:text-foreground'

  if (link.isExternal) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer noopener" className={className}>
        {inner}
      </a>
    )
  }
  if (link.href.includes('#')) {
    return (
      <a href={link.href} className={className}>
        {inner}
      </a>
    )
  }
  return (
    <Link to={link.href} className={className}>
      {inner}
    </Link>
  )
})

export const Footer = memo(function Footer() {
  const { footer, navbar } = useAppConfig()
  const columns = useMemo(() => byOrder(footer.columns), [footer.columns])

  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-14 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Link to={navbar.logo.href} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-white">
                <Icon name={navbar.logo.icon} className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="text-lg font-bold tracking-tight">{navbar.logo.text}</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{footer.description}</p>
            <div className="mt-5 flex gap-1">
              {footer.socials.map((social) => (
                <a
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={social.label}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {social.icon && <Icon name={social.icon} className="h-4 w-4" aria-hidden />}
                </a>
              ))}
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.id}>
              <h4 className="mb-4 text-sm font-semibold">{column.title}</h4>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <FooterLink link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">{footer.copyright}</p>
          <div className="flex gap-6">
            {footer.legalLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
})
