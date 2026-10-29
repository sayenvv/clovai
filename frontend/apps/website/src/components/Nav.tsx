import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { ButtonLink } from '@/components/ButtonLink'
import { Logo } from '@/components/Logo'
import { newTab, pages, site, type PageId } from '@/config'

/** The top bar: logo, the site's pages, then sign in and the primary action. A hairline appears on scroll. */
export function Nav({ page }: { page: PageId }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${
        scrolled || open ? 'border-line bg-white/85 backdrop-blur-xl' : 'border-transparent bg-white/0'
      }`}
    >
      <nav aria-label="Main" className="page flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-10">
          <a href="/" aria-label={`${site.name} home`} className="rounded-md">
            <Logo />
          </a>
          <ul className="hidden items-center gap-1 md:flex">
            {pages.map((item) => {
              const current = item.id === page
              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className={`rounded-md px-3 py-2 text-[14px] transition-colors ${current ? 'text-bone' : 'text-bone-muted hover:text-bone'}`}
                  >
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <a href={site.signIn} {...newTab(site.signIn)} className="rounded-md px-3 py-2 text-[14px] text-bone-muted transition-colors hover:text-bone">
            Sign in
          </a>
          <ButtonLink href={site.tryNow} size="sm">
            Start building
          </ButtonLink>
        </div>
        <button
          type="button"
          className="-mr-2 flex size-10 items-center justify-center rounded-md text-bone md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="page h-[calc(100dvh-4rem)] border-t border-line bg-white pb-10 md:hidden"
          >
            <ul className="divide-y divide-line">
              {pages.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.href}
                    aria-current={item.id === page ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`block py-4 text-[17px] ${item.id === page ? 'font-medium text-bone' : 'text-bone-soft'}`}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid gap-2.5">
              <ButtonLink href={site.tryNow} size="lg">
                Start building
              </ButtonLink>
              <ButtonLink href={site.signIn} variant="glass" size="lg">
                Sign in
              </ButtonLink>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
