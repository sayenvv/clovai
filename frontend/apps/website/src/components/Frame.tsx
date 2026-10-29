import type { ReactNode } from 'react'

/** A small plus where grid lines cross. */
function Cross({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 11 11" className={`absolute z-10 hidden size-[11px] text-bone-faint/70 md:block ${className}`} aria-hidden>
      <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

/**
 * A section on the page grid: a hairline across the top, hairline rails at the sides of the content column, and
 * a plus where they cross. Sections stack into one continuous frame, which is what makes the page read as built.
 */
export function Frame({
  id,
  children,
  className = '',
  inner = '',
  bare = false,
}: {
  id?: string
  children: ReactNode
  /** On the full-width band (background, colour). */
  className?: string
  /** On the framed column (padding, layout). */
  inner?: string
  /** No top hairline (the first section under the nav). */
  bare?: boolean
}) {
  return (
    <section id={id} className={`relative scroll-mt-16 ${bare ? '' : 'border-t border-line'} ${className}`}>
      <div className={`relative mx-auto w-full max-w-page md:border-x md:border-line ${inner}`}>
        {bare ? null : (
          <>
            <Cross className="-left-[6px] -top-[6px]" />
            <Cross className="-right-[6px] -top-[6px]" />
          </>
        )}
        {children}
      </div>
    </section>
  )
}
