import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Layout } from '@/components/Layout'
import type { PageId } from '@/config'
import '@/index.css'

/** Renders one page of the site into #root inside the shared layout. */
export function mount(page: PageId, content: ReactNode) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Layout page={page}>{content}</Layout>
    </StrictMode>,
  )
}
