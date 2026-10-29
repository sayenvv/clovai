import {
  Activity,
  Bot,
  GitBranch,
  History,
  Hourglass,
  Layers,
  MessageCircleQuestion,
  Radio,
  Repeat,
  Split,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { Frame } from '@/components/Frame'
import { Heading } from '@/components/Heading'
import { Reveal } from '@/components/Reveal'

/** The step types the engine runs today (app/workflows/build/executors), plus what every run gets. */
const ITEMS = [
  { icon: Bot, title: 'Agents', body: 'A model with instructions, tools, memory and structured output.' },
  { icon: Wrench, title: 'Tools', body: 'Call a function, an API or an MCP server directly.' },
  { icon: GitBranch, title: 'Conditions', body: 'Route the run on what earlier steps produced.' },
  { icon: Split, title: 'Parallel branches', body: 'Fan out into branches and join again.' },
  { icon: Repeat, title: 'Loops', body: 'Run steps for each item in a list, in turn or in parallel.' },
  { icon: Layers, title: 'Subworkflows', body: 'Reuse a saved workflow as a single step.' },
  { icon: UserCheck, title: 'Approval gates', body: 'Pause for a decision; rejected work can loop back.' },
  { icon: MessageCircleQuestion, title: 'Ask the user', body: 'Stop mid-run for an answer, then continue.' },
  { icon: Radio, title: 'Wait for an event', body: 'Hold until an outside system signals, with a timeout.' },
  { icon: Hourglass, title: 'Delays', body: 'Wait a set time before the next step.' },
  { icon: History, title: 'Checkpoints', body: 'Paused runs resume exactly where they stopped.' },
  { icon: Activity, title: 'Traces and limits', body: 'Every step and token recorded; caps on time and cost.' },
]

export function Capabilities() {
  return (
    <Frame id="capabilities">
      <div className="px-5 pb-14 pt-20 sm:px-10">
        <Heading
          eyebrow="Capabilities"
          title={
            <>
              Built for real workflows. <em>Not demos.</em>
            </>
          }
          lead="The building blocks of production automation, on Microsoft Agent Framework."
        />
      </div>
      <ul className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item, index) => (
          <li key={item.title} className="border-b border-line sm:[&:nth-child(odd)]:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
            <Reveal delay={(index % 3) * 0.06} className="h-full">
              <div className="group h-full p-8 transition-colors hover:bg-night-600">
                <item.icon className="size-5 text-bone-soft transition-colors group-hover:text-forest-700" aria-hidden />
                <h3 className="mt-5 font-semibold text-bone">{item.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-bone-muted">{item.body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Frame>
  )
}
