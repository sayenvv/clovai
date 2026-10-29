import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUp, Bot, Check, ChevronDown, Mail, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'
import { useInViewport } from '@/hooks/use-in-viewport'

/**
 * Product mockups for the home page's feature rows, drawn to match the workspace: its chat, canvas, run trace and
 * model picker. They animate once (or cycle) while on screen, and sit still for reduced motion.
 */

const ORANGE_DOT = 'bg-[#EB6115] shadow-[0_0_8px_rgba(235,97,21,0.55)]'

export function Window({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(23,23,23,0.08),0_16px_40px_-24px_rgba(23,23,23,0.35)] ${className}`}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-ink/10" />
          <span className="size-2 rounded-full bg-ink/10" />
          <span className="size-2 rounded-full bg-ink/10" />
        </div>
        <span className="text-[12px] text-bone-muted">{title}</span>
      </div>
      {children}
    </div>
  )
}

/** How many items of a sequence are shown: they arrive one by one once on screen. */
function useArrivals(count: number, gap: number, delay = 300) {
  const [ref, inView] = useInViewport({ once: true })
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setShown(count)
      return
    }
    const timers = Array.from({ length: count }, (_, index) => window.setTimeout(() => setShown(index + 1), delay + index * gap))
    return () => timers.forEach(window.clearTimeout)
  }, [inView, reduced, count, gap, delay])
  return [ref, shown] as const
}

const REASONS = [
  { title: 'Understood the request', reason: 'You want a manager to sign off before any email is sent.' },
  { title: 'Read the workflow', reason: 'Email Writer currently sends straight to Send email.' },
  { title: 'Edited the draft', tag: '3 changes', reason: 'Added Manager approval between them.' },
  { title: 'Checked the draft', reason: 'No issues.' },
]

/** The assistant's turn: the request, its steps with reasons, and the reply. */
export function ReasoningMock() {
  const [ref, shown] = useArrivals(REASONS.length + 1, 650)
  return (
    <Window title="ElevenNodes AI">
      <div ref={ref} className="space-y-4 p-5 text-[13px]">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-night-900 px-3.5 py-2 leading-relaxed text-bone">
          Add a manager approval before the email goes out.
        </p>
        <ol className="relative space-y-3 pl-5">
          <span className="absolute bottom-2 left-[3px] top-2 w-px bg-line" aria-hidden />
          {REASONS.map((step, index) => (
            <motion.li
              key={step.title}
              initial={false}
              animate={{ opacity: index < shown ? 1 : 0, x: index < shown ? 0 : -6 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="relative"
            >
              <span className={`absolute -left-5 top-[7px] size-[7px] rounded-full ${ORANGE_DOT}`} aria-hidden />
              <p className="font-medium text-bone-soft">
                {step.title}
                {step.tag ? <span className="ml-1.5 font-normal text-bone-faint">· {step.tag}</span> : null}
              </p>
              <p className="mt-0.5 leading-snug text-bone-muted">{step.reason}</p>
            </motion.li>
          ))}
        </ol>
        <motion.div initial={false} animate={{ opacity: shown > REASONS.length ? 1 : 0, y: shown > REASONS.length ? 0 : 6 }} transition={{ duration: 0.4 }}>
          <p className="leading-relaxed text-bone">
            Added <strong className="font-medium">Manager approval</strong> before Send email. A rejected draft goes back to Email
            Writer, up to 3 times. Review the changes on the canvas.
          </p>
          <p className="mt-2 font-mono text-[11px] text-bone-faint">Thought for 7s · 2.9k tokens</p>
        </motion.div>
      </div>
    </Window>
  )
}

/** Scales a fixed-size drawing to the width it is given. */
function Fit({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [width])
  return (
    <div ref={ref} style={{ height: height * scale }} className="relative w-full">
      <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

type Mark = 'new' | 'edited' | 'removed' | undefined
const MARK: Record<Exclude<Mark, undefined>, { ring: string; badge: string; label: string }> = {
  new: { ring: 'shadow-[0_0_0_2px_#16A34A,0_0_0_6px_rgba(22,163,74,0.12)]', badge: 'bg-[#16A34A]', label: 'New' },
  edited: { ring: 'shadow-[0_0_0_2px_#D99A06,0_0_0_6px_rgba(217,154,6,0.12)]', badge: 'bg-[#D99A06]', label: 'Edited' },
  removed: { ring: 'shadow-[0_0_0_2px_#E5484D] opacity-60', badge: 'bg-[#E5484D]', label: 'Removed' },
}

function Node({ x, y, label, meta, icon: Icon, mark, tile }: { x: number; y: number; label: string; meta: string; icon: typeof Bot; mark?: Mark; tile: string }) {
  return (
    <div className="absolute" style={{ left: x, top: y, width: 168, height: 60 }}>
      <div
        className={`flex h-full items-center gap-2.5 rounded-xl bg-white px-3 ${
          mark ? MARK[mark].ring : 'shadow-[0_0_0_1px_rgba(23,23,23,0.1),0_6px_14px_-10px_rgba(23,23,23,0.35)]'
        } ${mark === 'removed' ? 'border border-dashed border-[#E5484D]' : ''}`}
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tile}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className={`truncate text-[13px] font-semibold text-bone ${mark === 'removed' ? 'line-through decoration-[#E5484D]/60' : ''}`}>{label}</p>
          <p className="text-[11px] text-bone-muted">{meta}</p>
        </div>
      </div>
      {mark ? (
        <span className={`absolute -top-2.5 left-3 rounded-full px-1.5 py-px text-[10px] font-semibold text-white ${MARK[mark].badge}`}>{MARK[mark].label}</span>
      ) : null}
    </div>
  )
}

/** The draft on the canvas: every change marked, and the bar to accept it. */
export function DiffMock() {
  const [ref, shown] = useArrivals(1, 0, 400)
  const drawn = shown > 0
  const line = (d: string, color: string, dashed = false, delay = 0) => (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={color === '#16A34A' ? 2 : 1.5}
      strokeDasharray={dashed ? '5 5' : undefined}
      initial={false}
      animate={{ pathLength: drawn ? 1 : 0 }}
      transition={{ duration: 0.7, delay }}
    />
  )
  return (
    <Window title="Lead follow-up · draft">
      <div ref={ref} className="dot-field relative bg-night-600 px-5 pb-6 pt-16">
        <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white py-1 pl-3 pr-1 text-[12px] shadow-[0_0_0_1px_rgba(23,23,23,0.08),0_4px_12px_-6px_rgba(23,23,23,0.25)]">
          <span className="hidden text-bone-soft sm:inline">Previewing changes</span>
          <span className="rounded-full bg-[#16A34A]/10 px-1.5 py-px font-medium text-[#15803D]">1 new</span>
          <span className="rounded-full bg-[#D99A06]/10 px-1.5 py-px font-medium text-[#A16207]">1 edited</span>
          <span className="rounded-full bg-[#E5484D]/10 px-1.5 py-px font-medium text-[#C2262B]">1 removed</span>
          <span className="rounded-full bg-forest-700 px-2.5 py-0.5 font-medium text-white">Accept</span>
        </div>
        <Fit width={580} height={230}>
          <svg width={580} height={230} className="absolute inset-0" aria-hidden>
            {line('M 176 40 L 206 40', 'rgba(23,23,23,0.28)')}
            {line('M 382 40 L 412 40', '#16A34A', false, 0.2)}
            {line('M 496 70 L 496 160', '#16A34A', false, 0.4)}
            {line('M 290 70 L 290 160', '#E5484D', true, 0.3)}
          </svg>
          <Node x={8} y={10} label="Lead Intake" meta="Agent" icon={Bot} tile="bg-[#EB6115]/10 text-[#C9500C]" />
          <Node x={206} y={10} label="Email Writer" meta="Agent · instructions" icon={Bot} tile="bg-[#EB6115]/10 text-[#C9500C]" mark="edited" />
          <Node x={412} y={10} label="Manager approval" meta="Approval" icon={ShieldCheck} tile="bg-amber-500/12 text-amber-600" mark="new" />
          <Node x={206} y={160} label="Slack notify" meta="Tool" icon={MessageSquareText} tile="bg-sky-500/10 text-sky-600" mark="removed" />
          <Node x={412} y={160} label="Send email" meta="Tool" icon={Mail} tile="bg-sky-500/10 text-sky-600" />
        </Fit>
      </div>
    </Window>
  )
}

const SPANS = [
  { name: 'Lead Intake', from: 0, to: 0.8, note: '1.2k tokens', tone: 'bg-forest-700' },
  { name: 'Email Writer', from: 0.8, to: 2.6, note: '2.4k tokens', tone: 'bg-forest-700' },
  { name: 'Manager approval', from: 2.6, to: 3.6, note: 'approved', tone: 'bg-[#D99A06]' },
  { name: 'Send email', from: 3.6, to: 4.1, note: '0.5s', tone: 'bg-forest-700' },
]
const TOTAL = 4.4

/** A finished run: status, totals and the time each step took. */
export function TraceMock() {
  const [ref, shown] = useArrivals(SPANS.length, 380, 300)
  return (
    <Window title="Run #1842">
      <div ref={ref} className="p-5 text-[12.5px]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1BA672]/10 px-2 py-0.5 font-medium text-[#157F57]">
            <Check className="size-3.5" strokeWidth={3} aria-hidden /> Succeeded
          </span>
          <span className="font-mono text-bone-muted">4.1s</span>
          <span className="font-mono text-bone-muted">3,642 tokens</span>
          <span className="font-mono text-bone-muted">4 steps</span>
        </div>
        <div className="mt-5 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 border-b border-line pb-2 font-mono text-[10.5px] text-bone-faint">
          <span>Step</span>
          <span className="flex justify-between">
            <span>0s</span>
            <span>1s</span>
            <span>2s</span>
            <span>3s</span>
            <span>4s</span>
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {SPANS.map((span, index) => (
            <li key={span.name} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-x-4">
              <span className="flex items-center gap-2 truncate text-bone-soft">
                <span className={`size-1.5 shrink-0 rounded-full ${index < shown ? 'bg-[#1BA672]' : 'bg-ink/15'}`} aria-hidden />
                {span.name}
              </span>
              <span className="relative h-7">
                <span className="absolute inset-y-0 left-0 right-0 border-l border-dashed border-line" aria-hidden />
                <motion.span
                  initial={false}
                  animate={{ width: index < shown ? `${((span.to - span.from) / TOTAL) * 100}%` : '0%' }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className={`absolute inset-y-1 flex items-center overflow-hidden rounded ${span.tone} px-2 font-mono text-[10.5px] text-white`}
                  style={{ left: `${(span.from / TOTAL) * 100}%` }}
                >
                  <span className="truncate">{span.note}</span>
                </motion.span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Window>
  )
}

const MODELS = [
  { name: 'GPT Luna', model: 'gpt-luna' },
  { name: 'Mistral Large', model: 'mistral-large' },
]

/** The run chat's model picker, and the agents that follow it (or keep their own). */
export function ModelsMock() {
  const [ref, inView] = useInViewport()
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!inView || reduced) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % MODELS.length), 2600)
    return () => window.clearInterval(timer)
  }, [inView, reduced])
  const current = MODELS[index]
  const agents: Array<[string, boolean]> = [
    ['Lead Intake', true],
    ['Email Writer', true],
    ['Legal check', false],
  ]
  return (
    <Window title="Run workflow">
      <div ref={ref} className="space-y-4 p-5 text-[12.5px]">
        <div className="rounded-xl p-3 shadow-[0_0_0_1px_rgba(23,23,23,0.1)]">
          <p className="text-[13px] text-bone-faint">Message the workflow…</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-night-900 px-2.5 text-[12px] font-medium text-bone">
              <Sparkles className="size-3.5 text-forest-700" aria-hidden />
              <span className="inline-flex h-4 min-w-[6.5rem] items-center overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={current.name} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.2 }}>
                    {current.name}
                  </motion.span>
                </AnimatePresence>
              </span>
              <ChevronDown className="size-3.5 text-bone-faint" aria-hidden />
            </span>
            <span className="flex size-7 items-center justify-center rounded-full bg-forest-700 text-white">
              <ArrowUp className="size-3.5" aria-hidden />
            </span>
          </div>
        </div>
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-bone-faint">Agents</p>
          <ul className="mt-2 divide-y divide-line rounded-xl shadow-[0_0_0_1px_rgba(23,23,23,0.08)]">
            {agents.map(([name, inherits], row) => (
              <li key={name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="flex items-center gap-2 text-bone-soft">
                  <Bot className="size-3.5 text-bone-faint" aria-hidden />
                  {name}
                </span>
                <span className="inline-flex h-4 items-center gap-1.5 overflow-hidden font-mono text-[11.5px] text-bone-soft">
                  <span className={`size-1.5 shrink-0 rounded-full ${inherits ? 'bg-sky-500' : 'bg-[#1BA672]'}`} aria-hidden />
                  {inherits ? (
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={current.model} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.2, delay: 0.08 * row }}>
                        {current.model}
                      </motion.span>
                    </AnimatePresence>
                  ) : (
                    <span>claude-sonnet</span>
                  )}
                  <span className="font-sans text-bone-faint">· {inherits ? 'workflow' : 'own'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Window>
  )
}
