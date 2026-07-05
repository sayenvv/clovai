import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Menu, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { visibleSorted } from '@/utils/collection'
import { useAppConfig } from '@/hooks/use-app-config'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/shared/Icon'
import { CtaButton } from '@/components/shared/CtaButton'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { MegaMenu } from './MegaMenu'
import { MobileMenu } from './MobileMenu'
import type { NavItem } from '@/types/config'

const HOVER_CLOSE_DELAY = 120

export const Navbar = memo(function Navbar() {
  const { navbar, megaMenu } = useAppConfig()
  const location = useLocation()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const items = useMemo(() => visibleSorted(navbar.items), [navbar.items])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menus on navigation.
  useEffect(() => {
    setOpenMenuId(null)
    setMobileOpen(false)
  }, [location.pathname])

  const openMenu = useCallback((id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenMenuId(id)
  }, [])

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenMenuId(null), HOVER_CLOSE_DELAY)
  }, [])

  const renderItem = (item: NavItem) => {
    if (item.type === 'megaMenu') {
      const isOpen = openMenuId === item.id
      return (
        <div
          key={item.id}
          className="relative"
          onMouseEnter={() => openMenu(item.id)}
          onMouseLeave={scheduleClose}
        >
          <button
            className={cn(
              'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
              isOpen && 'text-foreground',
            )}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            onClick={() => (isOpen ? setOpenMenuId(null) : openMenu(item.id))}
          >
            {item.label}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          <AnimatePresence>
            {isOpen && (
              <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2">
                <MegaMenu config={megaMenu} onNavigate={() => setOpenMenuId(null)} />
              </div>
            )}
          </AnimatePresence>
        </div>
      )
    }

    const href = item.href ?? '/'
    const isHash = href.includes('#')
    const className =
      'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'

    return isHash ? (
      <a key={item.id} href={href} className={className}>
        {item.label}
      </a>
    ) : (
      <Link key={item.id} to={href} className={className}>
        {item.label}
      </Link>
    )
  }

  return (
    <header
      className={cn(
        'top-0 z-40 w-full transition-all duration-300',
        navbar.sticky && 'sticky',
        scrolled ? 'glass border-b shadow-sm' : 'bg-transparent',
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <Link to={navbar.logo.href} className="flex items-center gap-2.5" aria-label={navbar.logo.text}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-md shadow-primary/25">
            <Icon name={navbar.logo.icon} className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight">{navbar.logo.text}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {items.map(renderItem)}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {navbar.actions.map((action) => (
            <CtaButton key={action.id} cta={action} size="sm" />
          ))}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b bg-background lg:hidden"
          >
            <MobileMenu
              items={items}
              megaMenu={megaMenu}
              actions={navbar.actions}
              onNavigate={() => setMobileOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
})
