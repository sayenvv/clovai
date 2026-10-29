import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Bug, Check, Copy, Lightbulb, PenLine, Share2 } from 'lucide-react'
import { Heading } from '@/components/Heading'
import { Reveal } from '@/components/Reveal'
import { SpotlightCard } from '@/components/SpotlightCard'
import { DiscordMark, GitHubMark, XMark, YouTubeMark } from '@/content/brands'
import { community, newTab, site } from '@/config'
import { FinalCta } from '@/sections/FinalCta'

const CHANNELS = [
  { key: 'discord', name: 'Discord', mark: DiscordMark, body: 'Chat with other builders, ask questions and show what you made.', action: 'Join the server' },
  { key: 'github', name: 'GitHub', mark: GitHubMark, body: 'Follow releases, report issues and join the discussions.', action: 'Open GitHub' },
  { key: 'x', name: 'X', mark: XMark, body: 'Product news, tips and the workflows people are building.', action: 'Follow us' },
  { key: 'youtube', name: 'YouTube', mark: YouTubeMark, body: 'Walkthroughs, from a first workflow to production patterns.', action: 'Watch' },
] as const

/** Workflow ideas: each is the sentence to give the assistant, and the steps it tends to produce. */
const IDEAS = [
  { title: 'Lead follow-up', steps: ['Lead intake', 'Email writer', 'Manager approval'], prompt: 'Draft a follow-up email for every new lead, and have a manager approve it before it goes out.' },
  { title: 'Weekly support digest', steps: ['Fetch tickets', 'Summarise', 'Post to channel'], prompt: 'Every Monday, summarise open support tickets and post the digest to the team channel.' },
  { title: 'Invoice check', steps: ['Read invoice', 'Match the order', 'Finance approval'], prompt: 'Check each incoming invoice against its purchase order, and send mismatches to finance for approval.' },
  { title: 'Research brief', steps: ['Search', 'Summarise sources', 'Write the brief'], prompt: 'Research a company from its name and write a one-page brief with sources.' },
  { title: 'Meeting notes to tasks', steps: ['Read notes', 'Extract actions', 'Create tasks'], prompt: 'Turn meeting notes into a list of action items with owners and due dates.' },
  { title: 'Content review', steps: ['Draft', 'Brand check', 'Editor approval'], prompt: 'Draft a blog post from an outline, check it against our style guide, and have an editor approve it.' },
]

const WAYS = [
  { icon: Share2, title: 'Share a workflow', body: 'Built something useful? Share the idea so others can start from it.' },
  { icon: Lightbulb, title: 'Suggest a feature', body: 'Tell us what would make your workflows easier to build or run.' },
  { icon: Bug, title: 'Report a problem', body: 'Something not working as it should? We want to hear about it.' },
  { icon: PenLine, title: 'Improve the docs', body: 'Spotted something unclear or missing in the docs? Let us know.' },
]

function CopyPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked: the prompt is on screen to copy by hand
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-bone-muted ring-1 ring-ink/10 transition-colors hover:bg-ink/[0.04] hover:text-bone"
      aria-label={`Copy the prompt: ${prompt}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={copied ? 'done' : 'copy'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
          {copied ? <Check className="size-3.5 text-done" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        </motion.span>
      </AnimatePresence>
      {copied ? 'Copied' : 'Copy prompt'}
    </button>
  )
}

export function Community() {
  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-36 sm:pt-44">
        <div className="page relative">
          <Heading eyebrow="Community" title={<>Build together. <em>Learn from each other.</em></>} lead="Ask questions, share what you made and learn from people building agent workflows every day." />
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHANNELS.map((channel, index) => {
              const href = community[channel.key]
              return (
                <Reveal key={channel.key} delay={index * 0.06} className="h-full">
                  <SpotlightCard className="h-full">
                    <div className="flex h-full flex-col p-7">
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-bone text-white shadow-[0_10px_24px_-10px_rgba(22,19,15,0.6)]">
                        <channel.mark className="size-6" />
                      </span>
                      <h2 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-bone">{channel.name}</h2>
                      <p className="mt-2 flex-1 leading-relaxed text-bone-muted">{channel.body}</p>
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="group mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-ember-600">
                          {channel.action}
                          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                        </a>
                      ) : (
                        <span className="mt-6 inline-flex w-fit items-center rounded-full bg-ink/[0.05] px-3 py-1 text-[12.5px] font-medium text-bone-muted">Coming soon</span>
                      )}
                    </div>
                  </SpotlightCard>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="page">
          <Heading eyebrow="Start from an idea" title={<>Workflows people <em>build</em></>} lead="Copy a prompt, paste it into the assistant and review what it builds. Every one is a starting point to make your own." />
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {IDEAS.map((idea, index) => (
              <Reveal key={idea.title} delay={(index % 3) * 0.06} className="h-full">
                <div className="glass flex h-full flex-col rounded-3xl p-6">
                  <p className="text-[17px] font-semibold tracking-[-0.02em] text-bone">{idea.title}</p>
                  {/* The steps it builds, drawn like a small flow */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2">
                    {idea.steps.map((step, stepIndex) => (
                      // The arrow travels with the step it leads to, so a wrapped line never ends on a dangling arrow
                      <span key={step} className="flex items-center gap-1">
                        {stepIndex > 0 ? <ArrowRight className="size-3 text-bone-faint" aria-hidden /> : null}
                        <span className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium text-bone-soft shadow-[0_0_0_1px_rgba(31,28,26,0.08),0_3px_8px_-4px_rgba(31,28,26,0.2)]">{step}</span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-5 flex-1 rounded-2xl bg-ink/[0.03] p-4 text-[14px] italic leading-relaxed text-bone-soft">“{idea.prompt}”</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <CopyPrompt prompt={idea.prompt} />
                    <a href={site.tryNow} {...newTab(site.tryNow)} className="group inline-flex items-center gap-1 text-[13.5px] font-medium text-ember-600">
                      Build it
                      <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-6 pt-10">
        <div className="page">
          <Heading eyebrow="Get involved" title={<>Help shape <em>what's next</em></>} />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-ink/[0.07] ring-1 ring-ink/[0.07] sm:grid-cols-2 lg:grid-cols-4">
            {WAYS.map((way, index) => (
              <Reveal key={way.title} delay={index * 0.06} className="bg-white">
                <a href={site.contact} className="group block h-full p-8 transition-colors hover:bg-night">
                  <way.icon className="size-5 text-ember" aria-hidden />
                  <p className="mt-5 font-semibold text-bone">{way.title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-bone-muted">{way.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-[13.5px] font-medium text-ember-600">
                    Write to us <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  )
}
