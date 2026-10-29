import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Heading } from '@/components/Heading'
import { Frame } from '@/components/Frame'

const QUESTIONS = [
  { q: 'What is Eleven Nodes?', a: 'A workspace for building and running AI agent workflows. You describe what you need, an assistant builds it, and you review every change on a visual canvas before it runs.' },
  { q: 'Do I need to write code?', a: 'No. The assistant and the canvas cover most workflows. When you need exact logic, tools, transform steps and conditions fit in alongside the agents.' },
  { q: 'Which models can I use?', a: 'OpenAI, Azure OpenAI, Anthropic, Gemini, Mistral, Groq and Ollama are built in, and anything with an OpenAI-compatible API works too. Use the model clients your admin adds or your own; each workflow has a default model, and any agent can use its own.' },
  { q: 'Can a person approve steps before they happen?', a: 'Yes. Add an approval anywhere. The run pauses until someone approves; a rejection can send the work back for another try.' },
  { q: 'How do I see what a run did?', a: 'Every run is traced: the path it took, each agent’s output, how long each step took and the tokens it used.' },
  { q: 'What is it built on?', a: 'Microsoft Agent Framework. Runs checkpoint as they go, so a run paused for an approval picks up exactly where it stopped.' },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <Frame id="faq" inner="grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="px-5 pb-6 pt-20 sm:px-10 lg:border-r lg:border-line lg:pb-20">
        <Heading align="left" eyebrow="FAQ" title={<>Questions, <em>answered.</em></>} lead="Anything else? We’re happy to walk you through it." />
      </div>
      <ul className="divide-y divide-line border-t border-line lg:border-t-0">
        {QUESTIONS.map((item, index) => {
          const expanded = open === index
          return (
            <li key={item.q}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : index)}
                className="flex w-full items-center justify-between gap-6 px-5 py-6 text-left text-[16px] font-medium text-bone transition-colors hover:bg-night-600 sm:px-10"
              >
                {item.q}
                <motion.span animate={{ rotate: expanded ? 45 : 0 }} transition={{ duration: 0.25 }} className="shrink-0 text-bone-faint">
                  <Plus className="size-5" aria-hidden />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {expanded ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="max-w-2xl px-5 pb-7 leading-relaxed text-bone-muted sm:px-10">{item.a}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </Frame>
  )
}
