import { memo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/utils/cn'

interface MarkdownContentProps {
  content: string
  className?: string
  emptyMessage?: string
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className,
  emptyMessage = 'Nothing to preview yet.',
}: MarkdownContentProps) {
  const trimmed = content.trim()
  if (!trimmed) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className={cn('markdown-content space-y-2 text-xs leading-relaxed text-foreground', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {trimmed}
      </ReactMarkdown>
    </div>
  )
})

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-sm font-semibold tracking-tight text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-3 text-xs font-semibold uppercase tracking-wide text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-2 text-xs font-semibold text-foreground">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
  code: ({ children, className }: { children?: ReactNode; className?: string }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-md border border-border bg-muted/60 p-2 font-mono text-[11px] text-foreground">
          {children}
        </code>
      )
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
        {children}
      </code>
    )
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-2 font-mono text-[11px]">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-violet-500/40 pl-3 text-xs italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-violet-600 underline underline-offset-2 hover:text-violet-500 dark:text-violet-400"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border border-border px-2 py-1 text-muted-foreground">{children}</td>
  ),
}
