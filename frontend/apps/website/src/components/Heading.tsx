import type { ReactNode } from 'react'
import { Reveal } from '@/components/Reveal'

/** A section's label, title and lead. Put the second half of the title in <em> for the grey second tone. */
export function Heading({ eyebrow, title, lead, align = 'center' }: { eyebrow: string; title: ReactNode; lead?: ReactNode; align?: 'center' | 'left' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-xl'}>
      <Reveal>
        <span className="eyebrow">{eyebrow}</span>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 className="mt-4 text-title font-semibold text-bone [&_em]:not-italic [&_em]:text-bone-faint">
          {title}
        </h2>
      </Reveal>
      {lead ? (
        <Reveal delay={0.16}>
          <p className="mt-5 text-[16.5px] leading-relaxed text-bone-muted sm:text-[17px]">{lead}</p>
        </Reveal>
      ) : null}
    </div>
  )
}
