import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { Footer } from '@/components/Footer'
import { Nav } from '@/components/Nav'
import type { PageId } from '@/config'

/** Every page: skip link, the floating nav, the page itself and the footer. */
export function Layout({ page, children }: { page: PageId; children: ReactNode }) {
  return (
    // Animations honour the visitor's "reduce motion" setting
    <MotionConfig reducedMotion="user">
      <div>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-bone focus:px-4 focus:py-2 focus:text-night">
          Skip to content
        </a>
        <Nav page={page} />
        <main id="main">{children}</main>
        <Footer />
      </div>
    </MotionConfig>
  )
}
