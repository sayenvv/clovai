import { MessageSquareText, PanelsTopLeft, Play } from 'lucide-react'
import { Frame } from '@/components/Frame'
import { Heading } from '@/components/Heading'
import { Reveal } from '@/components/Reveal'

const PILLARS = [
  { icon: MessageSquareText, title: 'Describe', body: 'Tell the assistant what the workflow should do. It plans the steps and builds them on the canvas, explaining each move.' },
  { icon: PanelsTopLeft, title: 'Review', body: 'Every change is marked on the canvas before it lands. Accept the draft, or discard it and keep what you had.' },
  { icon: Play, title: 'Run', body: 'Run it from the chat with the model you pick. Approvals pause for a person; every step is traced.' },
]

export function Pillars() {
  return (
    <Frame id="how-it-works" inner="">
      <div className="px-5 pb-14 pt-20 sm:px-10">
        <Heading
          eyebrow="How it works"
          title={
            <>
              From an idea to a running workflow. <em>In three steps.</em>
            </>
          }
        />
      </div>
      <ol className="grid border-t border-line md:grid-cols-3">
        {PILLARS.map((pillar, index) => (
          <li key={pillar.title} className="border-b border-line md:border-b-0 md:border-r md:last:border-r-0">
            <Reveal delay={index * 0.08} className="h-full">
              <div className="h-full p-8 sm:p-10">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-night-900 text-forest-700 ring-1 ring-inset ring-line">
                    <pillar.icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="font-mono text-[12px] text-bone-faint">0{index + 1}</span>
                </div>
                <h3 className="mt-8 text-[19px] font-semibold tracking-[-0.02em] text-bone">{pillar.title}</h3>
                <p className="mt-2 leading-relaxed text-bone-muted">{pillar.body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </Frame>
  )
}
