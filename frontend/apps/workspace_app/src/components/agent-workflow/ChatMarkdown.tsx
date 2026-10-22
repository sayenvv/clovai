import { isValidElement, memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/utils/cn'

const CURSOR = '\u258D'

/**
 * Reveal `target` a few characters per frame so a reply that arrives in one
 * burst still reads as a live stream. Large backlogs drain faster.
 */
export function useSmoothText(target: string, animate: boolean): string {
  const [shown, setShown] = useState(() => (animate ? '' : target))
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    if (!target.startsWith(shown)) {
      setShown((current) => {
        let shared = 0
        while (shared < current.length && current[shared] === target[shared]) shared += 1
        return target.slice(0, shared)
      })
    }
  }, [target, shown])

  const behind = shown.length < target.length
  useEffect(() => {
    if (!behind) return
    let frame = 0
    const tick = () => {
      setShown((current) => {
        const full = targetRef.current
        if (current.length >= full.length) return current
        const remaining = full.length - current.length
        const step = Math.max(3, Math.ceil(remaining / 60))
        return full.slice(0, current.length + step)
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [behind])

  return shown
}

interface ChatMarkdownProps {
  content: string
  streaming?: boolean
  className?: string
}

export const ChatMarkdown = memo(function ChatMarkdown({ content, streaming = false, className }: ChatMarkdownProps) {
  const body = streaming ? `${content}${CURSOR}` : fenceJson(content)
  return (
    <div className={cn('chat-markdown min-w-0 break-words text-[13px] leading-6 text-foreground', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  )
})

const components = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-2 mt-4 text-base font-semibold tracking-tight first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-2 mt-4 text-[14px] font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-1.5 mt-3 text-[13px] font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="mb-1 mt-3 text-[13px] font-medium text-muted-foreground first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: ReactNode }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-2 ml-5 list-disc space-y-1 marker:text-muted-foreground first:mt-0 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-muted-foreground first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="pl-1 [&>p]:my-0">{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    if (className?.includes('language-')) {
      return <code className="font-mono text-[12px] leading-5">{children}</code>
    }
    return (
      <code className="rounded border border-border/60 bg-muted/70 px-1 py-px font-mono text-[12px]">{children}</code>
    )
  },
  pre: ({ children }: { children?: ReactNode }) => <CodeBlock>{children}</CodeBlock>,
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-3 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-border/70" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-b border-border/70 px-3 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-b border-border/40 px-3 py-1.5 align-top">{children}</td>
  ),
}

/** A fenced block with its language and a copy button above the code. */
function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLPreElement>(null)
  const code = isValidElement<{ className?: string }>(children) ? children.props.className : undefined
  const language = /language-(\w+)/.exec(code ?? '')?.[1]
  const copy = () => {
    const text = ref.current?.innerText ?? ''
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border/70 bg-muted/50 first:mt-0 last:mb-0">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">{language ?? 'code'}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={ref} className="max-h-96 overflow-auto p-3">
        {children}
      </pre>
    </div>
  )
}

/**
 * Put JSON that a reply pastes inline into a pretty-printed ```json block.
 *
 * Models often write JSON straight into prose, with raw line breaks inside
 * strings or literal "\\n" between fields, so each candidate is repaired before
 * it is parsed. Text already inside a fence is left alone.
 */
export function fenceJson(text: string): string {
  return text
    .split(/(```[\s\S]*?(?:```|$))/)
    .map((part) => (part.startsWith('```') ? part : fenceJsonInProse(part)))
    .join('')
}

function fenceJsonInProse(text: string): string {
  let result = ''
  let index = 0
  while (index < text.length) {
    const start = text.slice(index).search(/[{[]/)
    if (start < 0) break
    const open = index + start
    const close = matchingBracket(text, open)
    const parsed = close < 0 ? undefined : parseLenient(text.slice(open, close + 1))
    if (!isStructured(parsed)) {
      result += text.slice(index, open + 1)
      index = open + 1
      continue
    }
    const before = text.slice(index, open).replace(/[ \t]+$/, '')
    result += `${before}${before && !before.endsWith('\n') ? '\n\n' : ''}\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`
    index = close + 1
  }
  return result + text.slice(index)
}

/** A non-empty object, or a list of objects: worth a block. Short lists like ``[1]`` stay in the prose. */
function isStructured(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => typeof item === 'object' && item !== null)
  return typeof value === 'object' && value !== null && Object.keys(value).length > 0
}

/** The index of the bracket that closes the one at ``open``, ignoring brackets inside strings; -1 if none. */
function matchingBracket(text: string, open: number): number {
  let depth = 0
  let inString = false
  for (let i = open; i < text.length; i += 1) {
    const char = text[i]
    if (inString) {
      if (char === '\\') i += 1
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '{' || char === '[') depth += 1
    else if (char === '}' || char === ']') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/** JSON.parse after escaping raw line breaks in strings and dropping literal "\\n" between tokens. */
function parseLenient(candidate: string): unknown {
  let repaired = ''
  let inString = false
  for (let i = 0; i < candidate.length; i += 1) {
    const char = candidate[i]
    if (inString) {
      if (char === '\\') {
        repaired += char + (candidate[i + 1] ?? '')
        i += 1
      } else if (char === '\n') repaired += '\\n'
      else if (char === '\r') repaired += ''
      else if (char === '\t') repaired += '\\t'
      else {
        if (char === '"') inString = false
        repaired += char
      }
    } else if (char === '\\' && 'nrt'.includes(candidate[i + 1] ?? '')) {
      repaired += ' '
      i += 1
    } else {
      if (char === '"') inString = true
      repaired += char
    }
  }
  try {
    return JSON.parse(repaired)
  } catch {
    return undefined
  }
}
