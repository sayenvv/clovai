import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Frame } from '@/components/Frame'
import { Heading } from '@/components/Heading'
import { Reveal } from '@/components/Reveal'
import { DiffMock, ModelsMock, ReasoningMock, TraceMock } from '@/components/mocks'

type Row = { id: string; label: string; title: string; body: string; points: string[]; visual: ReactNode }

const ROWS: Row[] = [
  {
    id: 'assistant',
    label: 'AI assistant',
    title: 'An assistant that shows its work',
    body: 'Ask for a new workflow, a change or an explanation. Every step it takes comes with a one-line reason, so you always know what it understood, read and changed.',
    points: ['Plans before it builds, and asks when something is unclear', 'Uses only the models and tools in your catalog', 'Answers simple questions instantly, without a model call'],
    visual: <ReasoningMock />,
  },
  {
    id: 'review',
    label: 'Draft review',
    title: 'Review every change before it lands',
    body: 'The assistant never edits your workflow directly. Its draft opens on the canvas with every change marked, and nothing changes until you accept.',
    points: ['New in green, edited in amber, removed in red', 'Accept or discard the whole draft in one step', 'Your current workflow stays one click away'],
    visual: <DiffMock />,
  },
  {
    id: 'runs',
    label: 'Runs',
    title: 'Run with full visibility',
    body: 'Every run is traced step by step: the path it took, how long each step ran, the tokens it used and who approved what.',
    points: ['Approvals pause a run until a person decides', 'Checkpointed, so paused runs resume where they stopped', 'Limits on time, steps, tokens and cost'],
    visual: <TraceMock />,
  },
  {
    id: 'models',
    label: 'Models',
    title: 'The right model for every agent',
    body: 'Pick the workflow’s model in the run chat and every agent follows it. Give any agent its own model client when it needs one.',
    points: ['OpenAI, Azure OpenAI, Anthropic, Gemini, Mistral, Groq, Ollama', 'Anything with an OpenAI-compatible API', 'Keys live in model clients, never in workflows'],
    visual: <ModelsMock />,
  },
]

function FeatureRow({ row, flip }: { row: Row; flip: boolean }) {
  return (
    <div id={row.id} className="grid scroll-mt-16 border-t border-line lg:grid-cols-2">
      <div className={`flex flex-col justify-center px-5 py-14 sm:px-10 lg:py-20 ${flip ? 'lg:order-2 lg:border-l lg:border-line' : ''}`}>
        <Reveal>
          <span className="eyebrow">{row.label}</span>
          <h3 className="mt-4 text-[clamp(1.6rem,2.6vw,2.125rem)] font-semibold leading-tight tracking-[-0.03em] text-bone">{row.title}</h3>
          <p className="mt-4 max-w-lg text-[16.5px] leading-relaxed text-bone-muted">{row.body}</p>
          <ul className="mt-7 space-y-3">
            {row.points.map((point) => (
              <li key={point} className="flex gap-3 text-[15px] text-bone-soft">
                <Check className="mt-0.5 size-4 shrink-0 text-forest-700" strokeWidth={2.5} aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
      <div className={`dot-field bg-night-600 px-5 py-12 sm:px-10 lg:py-16 ${flip ? '' : 'lg:border-l lg:border-line'}`}>
        <Reveal delay={0.1} className="mx-auto max-w-[34rem]">
          {row.visual}
        </Reveal>
      </div>
    </div>
  )
}

export function Product() {
  return (
    <Frame id="product">
      <div className="px-5 pb-14 pt-20 sm:px-10">
        <Heading
          eyebrow="Product"
          title={
            <>
              Everything between an idea and a production run. <em>In one workspace.</em>
            </>
          }
        />
      </div>
      {ROWS.map((row, index) => (
        <FeatureRow key={row.id} row={row} flip={index % 2 === 1} />
      ))}
    </Frame>
  )
}
