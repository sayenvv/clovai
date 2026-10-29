import { ButtonLink } from '@/components/ButtonLink'
import { Frame } from '@/components/Frame'
import { Reveal } from '@/components/Reveal'
import { site } from '@/config'

export function FinalCta() {
  return (
    <Frame inner="dot-field bg-night-600 px-5 py-24 text-center sm:px-10 sm:py-28">
      <Reveal>
        <h2 className="mx-auto max-w-3xl text-title font-semibold text-bone">
          Start with one sentence. <span className="text-bone-faint">Ship a workflow you trust.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-bone-muted">
          Describe it, review it on the canvas, and run it with the model you choose.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <ButtonLink href={site.tryNow} size="lg" arrow>
            Start building
          </ButtonLink>
          <ButtonLink href={site.contact} variant="glass" size="lg">
            Talk to us
          </ButtonLink>
        </div>
      </Reveal>
    </Frame>
  )
}
