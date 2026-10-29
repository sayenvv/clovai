import { Frame } from '@/components/Frame'

const PROVIDERS: Array<[file: string, name: string]> = [
  ['openai', 'OpenAI'],
  ['azure', 'Azure OpenAI'],
  ['anthropic', 'Anthropic'],
  ['gemini', 'Gemini'],
  ['mistral', 'Mistral'],
  ['groq', 'Groq'],
  ['ollama', 'Ollama'],
]

/** The model providers built in, as a row of cells; anything OpenAI-compatible closes the row. */
export function Providers() {
  return (
    <Frame>
      <p className="px-5 pt-8 text-center text-[13px] text-bone-muted sm:px-10">Works with the model providers your team already uses</p>
      <ul className="mt-6 grid grid-cols-2 border-t border-line sm:grid-cols-4 lg:grid-cols-8">
        {PROVIDERS.map(([file, name]) => (
          <li key={file} className="group flex h-20 items-center justify-center gap-2.5 border-b border-r border-line px-3 lg:border-b-0">
            <img src={`/providers/${file}.svg`} alt="" className="size-5 opacity-70 grayscale transition duration-300 group-hover:opacity-100 group-hover:grayscale-0" />
            <span className="text-[13.5px] font-medium text-bone-muted transition-colors group-hover:text-bone">{name}</span>
          </li>
        ))}
        <li className="flex h-20 items-center justify-center whitespace-nowrap px-2 text-[12.5px] text-bone-faint">+ OpenAI-compatible</li>
      </ul>
    </Frame>
  )
}
