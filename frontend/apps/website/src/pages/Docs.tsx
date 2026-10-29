import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, Search } from 'lucide-react'
import { DOCS } from '@/content/docs'
import { newTab, site } from '@/config'

const ALL = DOCS.flatMap((group) => group.sections.map((section) => ({ ...section, group: group.title })))

/** The section whose heading was last scrolled past the top third of the screen. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * 0.3
      let current = ids[0]
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top ?? Infinity
        if (top - line <= 0) current = id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ids])
  return active
}

export function Docs() {
  const [query, setQuery] = useState('')
  // Phones: the contents fold away under one button, so the reading starts at the top of the screen
  const [contentsOpen, setContentsOpen] = useState(false)
  const ids = useMemo(() => ALL.map((section) => section.id), [])
  const active = useActiveSection(ids)
  const needle = query.trim().toLowerCase()
  const groups = DOCS.map((group) => ({
    ...group,
    sections: group.sections.filter((section) => !needle || `${section.title} ${section.summary}`.toLowerCase().includes(needle)),
  })).filter((group) => group.sections.length > 0)
  const activeGroup = ALL.find((section) => section.id === active)?.group

  return (
    <div className="page grid gap-10 pb-24 pt-32 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
      {/* Sidebar: search, then every section by group */}
      <aside className="lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pb-10">
        <label className="glass flex h-10 items-center gap-2 rounded-xl px-3 text-[13.5px]">
          <Search className="size-4 text-bone-faint" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the docs"
            className="w-full bg-transparent text-bone outline-none placeholder:text-bone-faint"
            aria-label="Search the docs"
          />
        </label>
        <button
          type="button"
          onClick={() => setContentsOpen((value) => !value)}
          aria-expanded={contentsOpen}
          aria-controls="docs-contents"
          className="glass mt-3 flex h-10 w-full items-center justify-between rounded-xl px-3 text-[13.5px] font-medium text-bone lg:hidden"
        >
          Contents
          <ChevronDown className={`size-4 text-bone-muted transition-transform ${contentsOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <nav
          id="docs-contents"
          aria-label="Documentation"
          className={`mt-6 space-y-6 ${contentsOpen || query ? 'block' : 'hidden'} lg:block`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setContentsOpen(false)
          }}
        >
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-bone-faint">{group.title}</p>
              <ul className="mt-2 space-y-0.5">
                {group.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={active === section.id ? 'true' : undefined}
                      className={`block rounded-lg px-3 py-1.5 text-[14px] transition-colors ${
                        active === section.id ? 'bg-forest/[0.07] font-medium text-forest-700' : 'text-bone-muted hover:bg-ink/[0.04] hover:text-bone'
                      }`}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {groups.length === 0 ? <p className="px-3 text-[13.5px] text-bone-muted">Nothing matches “{query}”.</p> : null}
        </nav>
      </aside>

      <article className="min-w-0">
        <header className="border-b border-ink/[0.07] pb-10">
          <span className="eyebrow">Documentation</span>
          <h1 className="text-sheen mt-5 text-title font-semibold">Build, review and run agent workflows</h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-bone-muted">
            Everything you need to go from an idea to a running workflow, and to keep it running well.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ['Quickstart', 'From a sentence to a finished run', '#quickstart'],
              ['Working with the assistant', 'What it can do, and how it shows its work', '#assistant'],
            ].map(([title, hint, href]) => (
              <a key={title} href={href} className="glass group flex items-center justify-between rounded-2xl px-5 py-4 transition-transform duration-300 hover:-translate-y-0.5">
                <span>
                  <span className="block font-medium text-bone">{title}</span>
                  <span className="mt-0.5 block text-[13.5px] text-bone-muted">{hint}</span>
                </span>
                <ArrowRight className="size-4 text-bone-faint transition-transform group-hover:translate-x-1 group-hover:text-ember" aria-hidden />
              </a>
            ))}
          </div>
        </header>

        {DOCS.map((group) => (
          <div key={group.title}>
            {group.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28 border-b border-ink/[0.07] py-12 last:border-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ember-600">{group.title}</p>
                <h2 className="mt-3 text-[clamp(1.6rem,2.6vw,2.1rem)] font-semibold tracking-[-0.03em] text-bone">{section.title}</h2>
                <div className="doc mt-5">{section.body}</div>
              </section>
            ))}
          </div>
        ))}

        <div className="glass mt-6 flex flex-col items-start justify-between gap-4 rounded-3xl p-7 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-semibold text-bone">Ready to try it?</p>
            <p className="mt-1 text-bone-muted">The quickest way to learn is to build something.</p>
          </div>
          <a href={site.tryNow} {...newTab(site.tryNow)} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-700 px-5 text-sm font-medium text-white transition-colors hover:bg-forest-800">
            Open the workspace <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </article>

      {/* On this page: the current group's sections */}
      <aside className="hidden xl:block">
        <div className="sticky top-28">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-faint">On this page</p>
          <ul className="mt-3 space-y-2 border-l border-ink/[0.08]">
            {ALL.filter((section) => section.group === activeGroup).map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={`-ml-px block border-l-2 pl-3 text-[13px] transition-colors ${
                    active === section.id ? 'border-ember text-bone' : 'border-transparent text-bone-muted hover:text-bone'
                  }`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
