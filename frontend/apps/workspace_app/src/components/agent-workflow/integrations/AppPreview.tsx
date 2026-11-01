import { memo, useState, type CSSProperties } from 'react'
import { ArrowUp, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { WorkflowAppConfig } from '@/services/workflow-apps-store'

const RADIUS: Record<WorkflowAppConfig['corners'], string> = { sharp: '4px', rounded: '12px', pill: '22px' }

/** Runs the app's workflow with the visitor's inputs and resolves to the text to show. */
export type AppRunner = (inputs: Record<string, unknown>) => Promise<string>

type AppLook = Pick<
  WorkflowAppConfig,
  'template' | 'title' | 'description' | 'accentColor' | 'theme' | 'corners' | 'welcome' | 'suggestions' | 'fields' | 'submitLabel' | 'showBranding'
>

/**
 * The app a deployment's users see, drawn from its settings: a chat with the workflow or a form. With `run` it is the
 * live app; without, a preview in which sending shows how a reply appears.
 */
export const AppPreview = memo(function AppPreview({
  config,
  device,
  run,
  fill = false,
}: {
  config: AppLook
  device: 'desktop' | 'mobile'
  run?: AppRunner
  /** Fill the page (the published app) instead of a framed preview. */
  fill?: boolean
}) {
  const dark = config.theme === 'dark'
  const style = {
    '--app-accent': config.accentColor,
    '--app-radius': RADIUS[config.corners],
    '--app-bg': dark ? '#0f1115' : '#ffffff',
    '--app-surface': dark ? '#181b21' : '#f5f6f8',
    '--app-text': dark ? '#eceff4' : '#15171c',
    '--app-muted': dark ? '#9aa3b2' : '#667085',
    '--app-border': dark ? '#2a2f38' : '#e4e7ec',
  } as CSSProperties

  return (
    <div
      style={style}
      className={cn(
        'mx-auto flex flex-col overflow-hidden border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text)] shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-[width] duration-300',
        fill
          ? 'h-full w-full max-w-none rounded-none border-0 shadow-none'
          : device === 'mobile'
            ? 'h-full max-h-[720px] min-h-[460px] w-[375px] max-w-full shrink-0 rounded-[28px]'
            : 'h-full max-h-[820px] min-h-[420px] w-full max-w-[960px] rounded-[10px]',
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-[var(--app-border)] px-4 py-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center text-[13px] font-semibold text-white"
          style={{ background: 'var(--app-accent)', borderRadius: 'var(--app-radius)' }}
        >
          {(config.title.trim()[0] || 'A').toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{config.title || 'Untitled app'}</p>
          {config.description ? <p className="truncate text-[11.5px] text-[var(--app-muted)]">{config.description}</p> : null}
        </div>
      </header>
      {config.template === 'chat' ? <ChatTemplate config={config} run={run} /> : <FormTemplate config={config} run={run} />}
      {config.showBranding ? (
        <p className="flex items-center justify-center gap-1 border-t border-[var(--app-border)] py-1.5 text-[10.5px] text-[var(--app-muted)]">
          <Sparkles className="h-3 w-3" /> Powered by Eleven Nodes
        </p>
      ) : null}
    </div>
  )
})

const PREVIEW_REPLY = 'This is a preview: once the app is published, the workflow answers here.'

function ChatTemplate({ config, run }: { config: AppLook; run?: AppRunner }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'app'; text: string }[]>([])
  const [text, setText] = useState('')
  const [waiting, setWaiting] = useState(false)
  const send = async (value: string) => {
    const message = value.trim()
    if (!message || waiting) return
    setMessages((previous) => [...previous, { role: 'user', text: message }])
    setText('')
    if (!run) {
      setMessages((previous) => [...previous, { role: 'app', text: PREVIEW_REPLY }])
      return
    }
    setWaiting(true)
    try {
      const reply = await run({ message })
      setMessages((previous) => [...previous, { role: 'app', text: reply }])
    } catch (error) {
      setMessages((previous) => [...previous, { role: 'app', text: error instanceof Error ? error.message : 'Something went wrong. Try again.' }])
    } finally {
      setWaiting(false)
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {config.welcome ? <Bubble role="app" text={config.welcome} /> : null}
        {messages.map((message, index) => (
          <Bubble key={index} role={message.role} text={message.text} />
        ))}
        {waiting ? (
          <div className="flex justify-start">
            <span className="flex items-center gap-1.5 bg-[var(--app-surface)] px-3 py-2 text-[12px] text-[var(--app-muted)]" style={{ borderRadius: 'var(--app-radius)' }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…
            </span>
          </div>
        ) : null}
        {messages.length === 0 && config.suggestions.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {config.suggestions.filter(Boolean).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="border border-[var(--app-border)] px-3 py-1.5 text-[12px] hover:bg-[var(--app-surface)]"
                style={{ borderRadius: 'var(--app-radius)' }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <form
        className="flex items-end gap-2 border-t border-[var(--app-border)] p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void send(text)
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a message…"
          className="h-10 min-w-0 flex-1 border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[13px] text-[var(--app-text)] outline-none placeholder:text-[var(--app-muted)]"
          style={{ borderRadius: 'var(--app-radius)' }}
        />
        <button
          type="submit"
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center text-white disabled:opacity-50"
          style={{ background: 'var(--app-accent)', borderRadius: 'var(--app-radius)' }}
          disabled={!text.trim() || waiting}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </>
  )
}

function Bubble({ role, text }: { role: 'user' | 'app'; text: string }) {
  return (
    <div className={cn('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
      <p
        className={cn('max-w-[80%] whitespace-pre-wrap px-3 py-2 text-[13px] leading-5', role === 'user' ? 'text-white' : 'bg-[var(--app-surface)]')}
        style={{ borderRadius: 'var(--app-radius)', ...(role === 'user' ? { background: 'var(--app-accent)' } : {}) }}
      >
        {text}
      </p>
    </div>
  )
}

function FormTemplate({ config, run }: { config: AppLook; run?: AppRunner }) {
  const [result, setResult] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const submit = async (form: HTMLFormElement) => {
    if (!run) {
      setResult("This is a preview: once the app is published, the workflow's result shows here.")
      return
    }
    const data = new FormData(form)
    const inputs: Record<string, unknown> = {}
    for (const field of config.fields) {
      const value = data.get(field.name)
      if (value === null || value === '') continue
      inputs[field.name] = field.type === 'number' ? Number(value) : String(value)
    }
    setWaiting(true)
    try {
      setResult(await run(inputs))
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Something went wrong. Try again.')
    } finally {
      setWaiting(false)
    }
  }
  return (
    <form
      className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5"
      onSubmit={(event) => {
        event.preventDefault()
        void submit(event.currentTarget)
      }}
    >
      {config.welcome ? <p className="text-[13px] text-[var(--app-muted)]">{config.welcome}</p> : null}
      {config.fields.map((field) => (
        <label key={field.name} className="block space-y-1">
          <span className="text-[12px] font-medium">
            {field.label || field.name}
            {field.required ? <span className="text-[var(--app-accent)]"> *</span> : null}
          </span>
          {field.type === 'textarea' ? (
            <textarea
              name={field.name}
              rows={3}
              required={field.required}
              className="w-full resize-none border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[13px] text-[var(--app-text)] outline-none"
              style={{ borderRadius: 'var(--app-radius)' }}
            />
          ) : (
            <input
              name={field.name}
              type={field.type}
              required={field.required}
              className="h-10 w-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[13px] text-[var(--app-text)] outline-none"
              style={{ borderRadius: 'var(--app-radius)' }}
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={waiting}
        className="flex h-10 items-center gap-2 px-5 text-[13px] font-medium text-white disabled:opacity-70"
        style={{ background: 'var(--app-accent)', borderRadius: 'var(--app-radius)' }}
      >
        {waiting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {config.submitLabel || 'Run'}
      </button>
      {result ? (
        <p className="whitespace-pre-wrap bg-[var(--app-surface)] px-3 py-2 text-[12.5px]" style={{ borderRadius: 'var(--app-radius)' }}>
          {result}
        </p>
      ) : null}
    </form>
  )
}
