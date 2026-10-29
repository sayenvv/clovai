import { FileClock, Lock, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Frame } from '@/components/Frame'
import { Reveal } from '@/components/Reveal'

const ITEMS = [
  { icon: Lock, title: 'Secrets by reference', body: 'Keys live in managed model clients and are referenced by id. They never appear in a workflow, log or response.' },
  { icon: ShieldCheck, title: 'A guarded assistant', body: 'What tools return is treated as data, never as instructions. Test runs wait for your confirmation.' },
  { icon: SlidersHorizontal, title: 'Admin control', body: 'Admins choose the models and tools on offer, and publish the assistant everyone uses.' },
  { icon: FileClock, title: 'A full audit trail', body: 'Every run keeps its inputs, outputs, steps, approvals and token usage.' },
]

/** The page's one dark band. */
export function Security() {
  return (
    <Frame id="security" className="bg-forest text-white" inner="md:!border-white/10">
      <div className="px-5 pb-14 pt-20 sm:px-10">
        <Reveal className="max-w-2xl">
          <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-white/55">
            <span className="size-1.5 rounded-[1px] bg-white/70" aria-hidden />
            Security
          </span>
          <h2 className="mt-4 text-title font-semibold">
            Built for teams that need control. <span className="text-white/45">Every step has an owner.</span>
          </h2>
        </Reveal>
      </div>
      <ul className="grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item, index) => (
          <li key={item.title} className="border-b border-white/10 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0">
            <Reveal delay={index * 0.06} className="h-full">
              <div className="h-full p-8">
                <item.icon className="size-5 text-white/80" aria-hidden />
                <h3 className="mt-5 font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/60">{item.body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Frame>
  )
}
