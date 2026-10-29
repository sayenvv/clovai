import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { ButtonLink } from '@/components/ButtonLink'
import { FlowStage } from '@/components/FlowStage'
import { Frame } from '@/components/Frame'
import { site } from '@/config'

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
})

const PROOF = ['Built on Microsoft Agent Framework', 'Bring your own model clients', 'Human approvals built in']

export function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  // The product settles flat as the page scrolls
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.35'] })
  const tilt = useTransform(scrollYProgress, [0, 1], [10, 0])

  return (
    <>
      <Frame bare inner="px-5 pb-16 pt-36 text-center sm:px-10 sm:pt-44">
        <motion.a
          {...rise(0)}
          href="#review"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-[13px] text-bone-soft transition-colors hover:border-ink/20"
        >
          <span className="rounded-full bg-forest-700 px-2 py-0.5 text-[11px] font-medium text-white">New</span>
          Review every AI change on the canvas
          <ArrowRight className="size-3.5 text-bone-faint" aria-hidden />
        </motion.a>

        <motion.h1 {...rise(0.08)} className="mx-auto mt-7 max-w-[62rem] text-hero font-semibold text-bone">
          Build AI agent workflows
          <br />
          <span className="text-bone-faint">you can see, review and trust.</span>
        </motion.h1>

        <motion.p {...rise(0.16)} className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-bone-muted sm:text-[18.5px]">
          Describe a workflow in plain words. Eleven Nodes builds it on a visual canvas, explains every step it takes, and runs
          it with approvals, traces and the models you choose.
        </motion.p>

        <motion.div {...rise(0.24)} className="mt-9 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <ButtonLink href={site.tryNow} size="lg" arrow>
            Start building
          </ButtonLink>
          <ButtonLink href="/docs/" variant="glass" size="lg">
            Read the docs
          </ButtonLink>
        </motion.div>

        <motion.ul {...rise(0.32)} className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-bone-muted">
          {PROOF.map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="size-3.5 text-forest-700" strokeWidth={2.5} aria-hidden />
              {item}
            </li>
          ))}
        </motion.ul>
      </Frame>

      {/* The product, on the canvas */}
      <Frame className="bg-night-600" inner="dot-field overflow-hidden px-3 py-10 sm:px-10 sm:py-16 [perspective:1600px]">
        <div ref={ref}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ rotateX: tilt, transformOrigin: 'center top' }}
            className="mx-auto max-w-6xl"
          >
            <FlowStage />
          </motion.div>
        </div>
      </Frame>
    </>
  )
}
