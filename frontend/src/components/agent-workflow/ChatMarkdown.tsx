import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
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
  const body = streaming ? `${content}${CURSOR}` : content
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
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border/70 bg-muted/50 p-3 first:mt-0 last:mb-0">
      {children}
    </pre>
  ),
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
