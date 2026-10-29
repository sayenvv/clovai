import { Frame } from '@/components/Frame'
import { Logo } from '@/components/Logo'
import { newTab, site } from '@/config'

const COLUMNS: Array<{ title: string; links: Array<[label: string, href: string]> }> = [
  {
    title: 'Product',
    links: [
      ['How it works', '/#how-it-works'],
      ['AI assistant', '/#assistant'],
      ['Draft review', '/#review'],
      ['Runs', '/#runs'],
      ['Models', '/#models'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Documentation', '/docs/'],
      ['Quickstart', '/docs/#quickstart'],
      ['Pricing', '/pricing/'],
      ['Community', '/community/'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['Security', '/#security'],
      ['FAQ', '/#faq'],
      ['Contact', site.contact],
    ],
  },
  {
    title: 'Get started',
    links: [
      ['Start building', site.tryNow],
      ['Sign in', site.signIn],
    ],
  },
]

export function Footer() {
  return (
    <footer>
      <Frame inner="grid gap-12 px-5 py-16 sm:px-10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-[14px] leading-relaxed text-bone-muted">The workspace for AI agent workflows you can see, review and trust.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-10 text-[14px] sm:grid-cols-4">
          {COLUMNS.map((column) => (
            <div key={column.title} className="space-y-3">
              <p className="font-medium text-bone">{column.title}</p>
              {column.links.map(([label, href]) => (
                <a key={label} href={href} {...newTab(href)} className="block text-bone-muted transition-colors hover:text-bone">
                  {label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </Frame>
      <Frame inner="flex flex-col gap-2 px-5 py-6 text-[13px] text-bone-faint sm:flex-row sm:justify-between sm:px-10">
        <p>
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
        <p>Built on Microsoft Agent Framework</p>
      </Frame>
      <div className="h-px bg-line" aria-hidden />
    </footer>
  )
}
