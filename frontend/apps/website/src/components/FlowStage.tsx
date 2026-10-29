import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useInViewport } from '@/hooks/use-in-viewport'
import { Bot, Check, Flag, Play, ShieldCheck, Sparkles } from 'lucide-react'

/**
 * The hero's story, on one clock that loops: a request is typed, the assistant reasons, two new steps grow onto
 * the canvas, the draft is accepted, and a run flows through it (pausing at the approval) to a finished toast.
 * Everything below is derived from `t`, so it stays in sync and simply stops when off screen.
 */

const LOOP = 15600
const TICK = 40
/** What a visitor who prefers no motion sees: the run just finished. */
const STILL = 12400

const PROMPT = 'Draft a follow-up email for every new lead, and have a manager approve it before it goes out.'
const TYPE_FROM = 300
const TYPE_MS = 22

const STEPS = [
  { at: 2500, title: 'Understood the request', reason: 'Each new lead gets a drafted email; a manager signs off first.' },
  { at: 3300, title: 'Read the workflow', reason: 'Lead Intake already extracts the lead details.' },
  { at: 4300, title: 'Edited the draft', reason: 'Adding Email Writer and an approval after it.', tag: '4 changes' },
  { at: 6000, title: 'Checked the draft', reason: 'No issues.' },
]
const REVIEW_AT = 6500
const PRESS_AT = 7300
const ACCEPTED_AT = 7700
const DONE_AT = 11600

// The canvas, in stage units (scaled to fit)
const STAGE_W = 960
const STAGE_H = 300
const NODE_Y = 118
const NODE_H = 64
const MID = NODE_Y + NODE_H / 2

type Kind = 'cap' | 'agent' | 'approval'
type Node = { id: string; x: number; w: number; label: string; meta: string; kind: Kind; appearAt?: number; running?: [number, number]; tokens?: string }

const NODES: Node[] = [
  { id: 'start', x: 30, w: 108, label: 'Start', meta: 'New lead', kind: 'cap', running: [8200, 8300] },
  { id: 'intake', x: 178, w: 176, label: 'Lead Intake', meta: 'Agent', kind: 'agent', running: [8750, 9350], tokens: '1.2k tokens' },
  { id: 'writer', x: 394, w: 176, label: 'Email Writer', meta: 'Agent', kind: 'agent', appearAt: 5000, running: [9450, 10000], tokens: '2.4k tokens' },
  { id: 'approval', x: 610, w: 176, label: 'Approval', meta: 'Manager', kind: 'approval', appearAt: 5500, running: [10050, 10850] },
  { id: 'end', x: 826, w: 108, label: 'End', meta: 'Sent', kind: 'cap', running: [11300, 11350] },
]
const byId = Object.fromEntries(NODES.map((node) => [node.id, node]))
const right = (id: string) => byId[id].x + byId[id].w
const center = (id: string) => byId[id].x + byId[id].w / 2

type Edge = { from: string; to: string; showFrom?: number; hideAt?: number; added?: boolean }
const EDGES: Edge[] = [
  { from: 'start', to: 'intake' },
  { from: 'intake', to: 'end', hideAt: 4900 },
  { from: 'intake', to: 'writer', showFrom: 5150, added: true },
  { from: 'writer', to: 'approval', showFrom: 5650, added: true },
  { from: 'approval', to: 'end', showFrom: 5850, added: true },
]

// Where the run's light is: [time, x] keyframes, holding at the approval while it waits
const PULSE: Array<[number, number]> = [
  [8200, center('start')],
  [8800, center('intake')],
  [9400, center('intake')],
  [9500, center('writer')],
  [10000, center('writer')],
  [10100, center('approval')],
  [10850, center('approval')],
  [11300, center('end')],
]

function pulseX(t: number): number | null {
  if (t < PULSE[0][0] || t > PULSE[PULSE.length - 1][0] + 200) return null
  for (let i = 1; i < PULSE.length; i++) {
    const [t1, x1] = PULSE[i]
    const [t0, x0] = PULSE[i - 1]
    if (t <= t1) return x0 + ((x1 - x0) * (t - t0)) / Math.max(1, t1 - t0)
  }
  return PULSE[PULSE.length - 1][1]
}

type Status = 'idle' | 'running' | 'waiting' | 'done'
function statusOf(node: Node, t: number): Status {
  if (!node.running || t < node.running[0]) return 'idle'
  if (t < node.running[1]) return node.kind === 'approval' ? 'waiting' : 'running'
  return 'done'
}

function useClock(): [number, React.RefObject<HTMLDivElement | null>] {
  const [ref, inView] = useInViewport({ margin: '-10% 0px' })
  const reduced = useReducedMotion()
  const [t, setT] = useState(reduced ? STILL : 0)
  useEffect(() => {
    if (reduced) {
      setT(STILL)
      return
    }
    if (!inView) return
    const timer = window.setInterval(() => setT((value) => (value + TICK) % LOOP), TICK)
    return () => window.clearInterval(timer)
  }, [inView, reduced])
  return [t, ref]
}

const ICONS = { cap: Flag, agent: Bot, approval: ShieldCheck }

function CanvasNode({ node, t }: { node: Node; t: number }) {
  const visible = node.appearAt === undefined || t >= node.appearAt
  const isNew = node.appearAt !== undefined && t < ACCEPTED_AT
  const status = statusOf(node, t)
  const Icon = node.id === 'start' ? Play : ICONS[node.kind]
  const cap = node.kind === 'cap'
  const ring =
    status === 'running'
      ? 'shadow-[0_0_0_2px_#EB6115,0_0_32px_-6px_rgba(235,97,21,0.6)]'
      : status === 'waiting'
        ? 'shadow-[0_0_0_2px_#D99A06,0_0_28px_-6px_rgba(217,154,6,0.55)]'
        : status === 'done'
          ? 'shadow-[0_0_0_1.5px_rgba(27,166,114,0.7),0_8px_20px_-10px_rgba(27,166,114,0.4)]'
          : isNew
            ? 'shadow-[0_0_0_2px_#16A34A,0_0_36px_-6px_rgba(22,163,74,0.55)]'
            : 'shadow-[0_0_0_1px_rgba(31,28,26,0.09),0_6px_16px_-8px_rgba(31,28,26,0.18)]'

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, scale: 0.6, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="absolute"
          style={{ left: node.x, top: NODE_Y, width: node.w, height: NODE_H }}
        >
          <div
            className={`flex h-full items-center gap-3 bg-gradient-to-b from-white to-[#FBFAF7] px-3 transition-shadow duration-500 ${ring} ${
              cap ? 'justify-center rounded-full' : 'rounded-2xl'
            }`}
          >
            {cap ? null : (
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                  node.kind === 'approval' ? 'bg-edited/15 text-edited' : 'bg-ember/15 text-ember-300'
                }`}
              >
                <Icon className="size-[18px]" aria-hidden />
              </span>
            )}
            <div className={cap ? 'text-center' : 'min-w-0'}>
              <p className="truncate text-[14px] font-semibold text-bone">{node.label}</p>
              <p className="truncate text-[11.5px] text-bone-muted">
                {status === 'waiting' ? 'Waiting for manager' : status === 'done' && node.kind === 'approval' ? 'Approved' : node.meta}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {isNew ? (
              <motion.span
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -top-3 left-3 rounded-full bg-added px-2 py-0.5 text-[10.5px] font-semibold text-white shadow-[0_4px_14px_-2px_rgba(22,163,74,0.6)]"
              >
                New
              </motion.span>
            ) : null}
            {status === 'done' ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-done text-night shadow-[0_0_0_3px_#FFFFFF]"
              >
                <Check className="size-3" strokeWidth={3.5} aria-hidden />
              </motion.span>
            ) : null}
            {status === 'done' && node.tokens ? (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-1/2 top-[calc(100%+10px)] -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-[10.5px] text-bone-soft ring-1 ring-ink/10"
              >
                {node.tokens}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function Canvas({ t }: { t: number }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const element = wrap.current
    if (!element) return
    // Narrow screens keep the steps readable and crop to the middle of the flow rather than shrinking it all
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1.15, Math.max(0.62, entry.contentRect.width / STAGE_W))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const x = pulseX(t)
  const accepted = t >= ACCEPTED_AT
  const loopShown = t >= 6050

  return (
    <div ref={wrap} className="dot-field relative h-full min-h-[18rem] overflow-hidden">
      <div className="absolute left-1/2 top-1/2" style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <svg width={STAGE_W} height={STAGE_H} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {EDGES.map((edge) => {
            const shown = (edge.showFrom === undefined || t >= edge.showFrom) && (edge.hideAt === undefined || t < edge.hideAt)
            const fresh = edge.added && !accepted
            return (
              <motion.path
                key={`${edge.from}-${edge.to}`}
                d={`M ${right(edge.from) + 4} ${MID} L ${byId[edge.to].x - 4} ${MID}`}
                fill="none"
                stroke={fresh ? '#16A34A' : 'rgba(31,28,26,0.22)'}
                strokeWidth={fresh ? 2 : 1.5}
                strokeLinecap="round"
                initial={false}
                animate={{ pathLength: shown ? 1 : 0, opacity: shown ? 1 : 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
              />
            )
          })}
          {/* Rejected work goes back to the writer */}
          <motion.path
            d={`M ${center('approval')} ${NODE_Y + NODE_H + 4} C ${center('approval')} 278, ${right('writer') - 22} 278, ${right('writer') - 22} ${NODE_Y + NODE_H + 6}`}
            fill="none"
            stroke={accepted ? 'rgba(31,28,26,0.2)' : '#16A34A'}
            strokeWidth="1.5"
            strokeDasharray="4 6"
            className="animate-dash"
            initial={false}
            animate={{ pathLength: loopShown ? 1 : 0, opacity: loopShown ? 0.9 : 0 }}
            transition={{ duration: 0.7 }}
          />
          {x !== null ? (
            <g filter="url(#glow)">
              <circle cx={x} cy={MID} r="7" fill="#EB6115" />
              <circle cx={x} cy={MID} r="3" fill="#FFF3EA" />
            </g>
          ) : null}
        </svg>
        <motion.span
          className="absolute font-mono text-[11px] text-bone-faint"
          style={{ left: (right('writer') + center('approval')) / 2 - 50, top: 272 }}
          animate={{ opacity: loopShown ? 1 : 0 }}
        >
          rejected → revise
        </motion.span>
        {NODES.map((node) => (
          <CanvasNode key={node.id} node={node} t={t} />
        ))}
      </div>

      {/* The review bar while the draft waits, then the run's result */}
      <AnimatePresence mode="wait">
        {t >= REVIEW_AT && t < ACCEPTED_AT ? (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-4 pr-1.5 text-[12px]"
          >
            <span className="hidden text-bone-soft sm:inline">Previewing changes</span>
            <span className="rounded-full bg-added/15 px-2 py-0.5 font-medium text-added">2 new</span>
            <motion.span
              animate={t >= PRESS_AT ? { scale: [1, 0.9, 1] } : {}}
              transition={{ duration: 0.35 }}
              className="rounded-full bg-bone px-3 py-1 font-medium text-night"
            >
              Accept
            </motion.span>
          </motion.div>
        ) : t >= DONE_AT ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[12px]"
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-done text-night">
              <Check className="size-2.5" strokeWidth={4} aria-hidden />
            </span>
            <span className="font-medium text-bone">Run completed</span>
            <span className="hidden font-mono text-bone-muted sm:inline">3.2s · 3.6k tokens</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function Assistant({ t }: { t: number }) {
  const typed = PROMPT.slice(0, Math.max(0, Math.floor((t - TYPE_FROM) / TYPE_MS)))
  const typing = typed.length > 0 && typed.length < PROMPT.length
  const steps = STEPS.filter((step) => t >= step.at)
  return (
    <div className="flex h-full flex-col border-r border-ink/[0.07] bg-ink/[0.015]">
      <div className="flex items-center gap-2.5 border-b border-ink/[0.07] px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-ember to-ember-600 text-white shadow-[0_6px_18px_-6px_rgba(235,97,21,0.7)]">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        <span className="text-[13px] font-semibold text-bone">ElevenNodes AI</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-bone-faint">
          <span className="size-1.5 rounded-full bg-done" aria-hidden /> Online
        </span>
      </div>
      {/* Anchored to the newest message, like a chat: older lines slide up out of view */}
      <div className="flex min-h-0 flex-1 flex-col justify-end space-y-4 overflow-hidden p-4 text-[12.5px]">
        {typed ? (
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-ink/[0.07] px-3.5 py-2.5 leading-relaxed text-bone">
            {typed}
            {typing ? <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-blink bg-ember" aria-hidden /> : null}
          </div>
        ) : null}
        <ol className="relative space-y-3 pl-5">
          {steps.length ? <span className="absolute bottom-2 left-[3px] top-2 w-px bg-ink/10" aria-hidden /> : null}
          <AnimatePresence initial={false}>
            {steps.map((step) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="relative"
              >
                <span className="absolute -left-5 top-1.5 size-[7px] rounded-full bg-ember shadow-[0_0_8px_rgba(235,97,21,0.6)]" aria-hidden />
                <p className="font-medium text-bone-soft">
                  {step.title}
                  {step.tag ? <span className="ml-1.5 font-normal text-bone-faint">· {step.tag}</span> : null}
                </p>
                <p className="mt-0.5 leading-snug text-bone-muted">{step.reason}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
        <AnimatePresence mode="wait">
          {t >= DONE_AT ? (
            <motion.p key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="leading-relaxed text-bone-soft">
              Done. The run finished in 3.2s; the manager approved the email.
            </motion.p>
          ) : t >= ACCEPTED_AT ? (
            <motion.p key="running" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-bone-muted">
              Accepted. Running it now…
            </motion.p>
          ) : t >= REVIEW_AT ? (
            <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="rounded-2xl bg-ink/[0.04] p-3 ring-1 ring-ink/[0.08]">
              <div className="flex items-center justify-between">
                <p className="font-medium text-bone">Changes ready to review</p>
                <span className="rounded-full bg-added/15 px-1.5 py-px text-[10.5px] font-medium text-added">2 new</span>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <motion.span
                  animate={t >= PRESS_AT ? { scale: [1, 0.9, 1] } : {}}
                  transition={{ duration: 0.35 }}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-bone px-2.5 text-[11.5px] font-medium text-night"
                >
                  <Check className="size-3.5" aria-hidden /> Accept
                </motion.span>
                <span className="inline-flex h-7 items-center rounded-lg px-2.5 text-[11.5px] text-bone-muted ring-1 ring-ink/10">Discard</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function FlowStage() {
  const [t, ref] = useClock()
  return (
    <div ref={ref} className="glass overflow-hidden rounded-xl" role="img" aria-label="The assistant turns a request into two new workflow steps, the draft is accepted, and a run flows through it to completion">
      <div className="flex items-center gap-3 border-b border-ink/[0.07] px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-ink/15" />
          <span className="size-2.5 rounded-full bg-ink/15" />
          <span className="size-2.5 rounded-full bg-ink/15" />
        </div>
        <span className="mx-auto rounded-md bg-ink/[0.05] px-3 py-1 font-mono text-[11px] text-bone-faint ring-1 ring-ink/[0.06]">Lead follow-up</span>
        <span className="w-12" aria-hidden />
      </div>
      <div className="grid md:h-[26rem] md:grid-cols-[19rem_minmax(0,1fr)] md:grid-rows-[26rem]">
        <div className="hidden min-h-0 overflow-hidden md:block">
          <Assistant t={t} />
        </div>
        <Canvas t={t} />
      </div>
    </div>
  )
}
