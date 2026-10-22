import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  AlignLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Maximize,
  Minimize,
  Minimize2,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

const LINE_HEIGHT = 20 // px; the gutter, highlight layer and textarea all share it.
const INDENT = '  '

export type JsonParse = { value: Record<string, unknown>; error?: undefined } | { value?: undefined; error: JsonError }

export interface JsonError {
  message: string
  /** 1-based, when the parser reported a position. */
  line?: number
  column?: number
}

/** Parse ``text`` as a JSON object, with the error's line and column when there is one. */
export function parseJsonObject(text: string): JsonParse {
  try {
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { error: { message: 'The definition must be a JSON object.' } }
    }
    return { value: value as Record<string, unknown> }
  } catch (error) {
    return { error: locate(text, error instanceof Error ? error.message : 'Invalid JSON') }
  }
}

/**
 * A JSON editor with line numbers, syntax colours, format / minify / copy, and the
 * error line marked. A transparent textarea sits over the coloured layer, so editing,
 * undo and selection stay native. Lines don't wrap, so each number matches one line.
 *
 * Objects and arrays that span lines can be collapsed from the gutter. While anything
 * is collapsed the text is view-only (the textarea shows the folded text); typing
 * expands everything first, so hidden text is never edited by accident.
 */
export function JsonEditor({
  value,
  onChange,
  parse,
  onSave,
  readOnly = false,
  status,
  className,
}: {
  value: string
  onChange: (next: string) => void
  /** The parse of ``value``; the caller owns it so it can also gate saving. */
  parse: JsonParse
  /** Called on ⌘/Ctrl+S. */
  onSave?: () => void
  readOnly?: boolean
  /** Shown at the right of the footer, such as "Unsaved changes". */
  status?: ReactNode
  className?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [copied, setCopied] = useState(false)
  const [maximized, setMaximized] = useState(false)

  // Esc leaves the maximized view.
  useEffect(() => {
    if (!maximized) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMaximized(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maximized])

  const lines = useMemo(() => value.split('\n'), [value])
  const folds = useMemo(() => foldRanges(value), [value])
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())
  // Only folds that still exist count; an edit can remove a block.
  const activeFolds = useMemo(() => [...collapsed].filter((start) => folds.has(start)), [collapsed, folds])
  const folded = activeFolds.length > 0
  const rows = useMemo(() => visibleRows(lines, folds, new Set(activeFolds)), [lines, folds, activeFolds])
  const shownText = useMemo(() => (folded ? rows.map((row) => row.text).join('\n') : value), [folded, rows, value])
  const widest = useMemo(() => rows.reduce((max, row) => Math.max(max, row.text.length), 0), [rows])
  const errorLine = parse.error?.line

  const toggleFold = (start: number) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(start)) next.delete(start)
      else next.add(start)
      return next
    })
  // Collapse everything below the root, so the top-level keys stay visible.
  const collapseAll = () => setCollapsed(new Set([...folds.keys()].filter((start) => start !== 0)))
  const expandAll = () => setCollapsed(new Set())

  const replaceAll = (next: string) => {
    expandAll()
    // execCommand keeps the change on the textarea's undo stack; fall back when unsupported.
    const textarea = textareaRef.current
    if (textarea && !readOnly) {
      textarea.focus()
      textarea.select()
      if (document.execCommand?.('insertText', false, next)) return
    }
    onChange(next)
  }

  const format = () => parse.value && replaceAll(JSON.stringify(parse.value, null, 2))
  const minify = () => parse.value && replaceAll(JSON.stringify(parse.value))
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      onSave?.()
      return
    }
    if (folded && !readOnly && isEdit(event)) {
      // Editing needs the whole text: expand, and let the user type again on the full view.
      event.preventDefault()
      expandAll()
      return
    }
    if (event.key === 'Tab' && !readOnly) {
      event.preventDefault()
      const target = event.currentTarget
      const { selectionStart: start, selectionEnd: end } = target
      if (start === end && !event.shiftKey) {
        document.execCommand('insertText', false, INDENT)
        return
      }
      // Indent or outdent every selected line.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const block = value.slice(lineStart, end)
      const changed = event.shiftKey
        ? block.replace(/^ {1,2}/gm, '')
        : block.replace(/^/gm, INDENT)
      target.setSelectionRange(lineStart, end)
      document.execCommand('insertText', false, changed)
      target.setSelectionRange(lineStart, lineStart + changed.length)
    }
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        maximized ? 'fixed inset-0 z-50 bg-card shadow-2xl' : className,
      )}
      role={maximized ? 'dialog' : undefined}
      aria-modal={maximized || undefined}
      aria-label={maximized ? 'JSON editor' : undefined}
    >
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <span className="mr-auto px-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          JSON
        </span>
        <ToolbarButton onClick={format} disabled={!parse.value || readOnly} label="Format" icon={AlignLeft} />
        <ToolbarButton onClick={minify} disabled={!parse.value || readOnly} label="Minify" icon={Minimize2} />
        <ToolbarButton onClick={copy} label={copied ? 'Copied' : 'Copy'} icon={copied ? Check : Copy} />
        <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden />
        <ToolbarButton onClick={collapseAll} disabled={folds.size < 2} label="Collapse all" icon={ChevronsDownUp} />
        <ToolbarButton onClick={expandAll} disabled={!folded} label="Expand all" icon={ChevronsUpDown} />
        <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden />
        <ToolbarButton
          onClick={() => setMaximized((value) => !value)}
          label={maximized ? 'Exit full screen' : 'Maximize'}
          icon={maximized ? Minimize : Maximize}
        />
      </div>

      <div
        className="relative min-h-[420px] flex-1 overflow-auto bg-muted/20"
        style={maximized ? undefined : { maxHeight: '68vh' }}
      >
        <div className="flex min-w-full w-max">
          <div
            className="sticky left-0 z-10 shrink-0 select-none border-r border-border/60 bg-card py-2.5 pl-3 pr-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground/60"
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          >
            {rows.map((row) => (
              <div key={row.index} className="flex items-center justify-end gap-0.5">
                <span
                  className={cn(
                    'min-w-[2ch] rounded-sm px-0.5',
                    row.index + 1 === errorLine && 'bg-destructive/15 font-semibold text-destructive',
                  )}
                >
                  {row.index + 1}
                </span>
                {folds.has(row.index) ? (
                  <button
                    type="button"
                    onClick={() => toggleFold(row.index)}
                    className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                    aria-label={`${row.collapsed ? 'Expand' : 'Collapse'} lines ${row.index + 1}–${(folds.get(row.index) ?? row.index) + 1}`}
                    aria-expanded={!row.collapsed}
                  >
                    {row.collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                ) : (
                  <span className="w-4" aria-hidden />
                )}
              </div>
            ))}
          </div>

          <div className="relative flex-1">
            <pre
              aria-hidden
              className="pointer-events-none m-0 whitespace-pre px-3 py-2.5 font-mono text-[12px] text-foreground"
              style={{ lineHeight: `${LINE_HEIGHT}px` }}
            >
              {rows.map((row) => (
                <div
                  key={row.index}
                  className={cn(row.index + 1 === errorLine && '-mx-3 bg-destructive/[0.07] px-3')}
                  style={{ minHeight: LINE_HEIGHT }}
                >
                  {row.collapsed ? (
                    <>
                      {highlight(row.head)}
                      <button
                        type="button"
                        onClick={() => toggleFold(row.index)}
                        className="pointer-events-auto relative z-10 mx-0.5 rounded bg-muted px-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title={`${row.hidden} hidden lines — click to expand`}
                      >
                        …
                      </button>
                      {highlight(row.tail)}
                    </>
                  ) : (
                    highlight(row.text)
                  )}
                </div>
              ))}
            </pre>
            <textarea
              ref={textareaRef}
              value={shownText}
              onChange={(event) => {
                if (!folded) onChange(event.target.value)
              }}
              onKeyDown={onKeyDown}
              readOnly={readOnly || folded}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              wrap="off"
              aria-label="JSON"
              className="absolute inset-0 resize-none overflow-hidden whitespace-pre bg-transparent px-3 py-2.5 font-mono text-[12px] text-transparent caret-foreground outline-none selection:bg-sky-500/25"
              style={{ lineHeight: `${LINE_HEIGHT}px`, minWidth: `calc(${widest}ch + 1.5rem)` }}
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-8 items-center gap-3 border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
        {parse.error ? (
          <span className="flex min-w-0 items-center gap-1.5 text-destructive">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {parse.error.line ? `Line ${parse.error.line}, column ${parse.error.column}: ` : ''}
              {parse.error.message}
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Valid JSON
          </span>
        )}
        <span className="ml-auto shrink-0 tabular-nums">
          {lines.length} lines · {value.length.toLocaleString()} chars
        </span>
        {folded ? <span className="shrink-0 text-sky-600 dark:text-sky-400">Collapsed view · type to edit</span> : null}
        {status ? <span className="shrink-0">{status}</span> : null}
        {maximized ? <span className="hidden shrink-0 sm:inline">Esc to exit</span> : null}
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  disabled,
  label,
  icon: Icon,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  icon: typeof Copy
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}

interface Row {
  /** 0-based line in the full text. */
  index: number
  text: string
  collapsed: boolean
  /** For a collapsed row: the text before and after the fold marker, and how many lines it hides. */
  head: string
  tail: string
  hidden: number
}

const FOLD_MARKER = ' … '

/** The rows to show: every line, except those inside a collapsed block, which become one row. */
function visibleRows(lines: string[], folds: ReadonlyMap<number, number>, collapsed: ReadonlySet<number>): Row[] {
  const rows: Row[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const end = folds.get(index)
    if (end !== undefined && collapsed.has(index)) {
      const head = lines[index]
      const tail = lines[end].trim()
      rows.push({ index, text: head + FOLD_MARKER + tail, collapsed: true, head, tail, hidden: end - index - 1 })
      index = end
    } else {
      rows.push({ index, text: lines[index], collapsed: false, head: '', tail: '', hidden: 0 })
    }
  }
  return rows
}

/**
 * Each line that opens an object or array closed on a later line, mapped to that closing line.
 * Brackets inside strings are ignored. When one line opens several, the outermost wins.
 */
function foldRanges(text: string): Map<number, number> {
  const ranges = new Map<number, number>()
  const open: number[] = [] // the line each unclosed bracket started on
  let line = 0
  let inString = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '\n') {
      line += 1
    } else if (inString) {
      if (char === '\\') i += 1
      else if (char === '"') inString = false
    } else if (char === '"') {
      inString = true
    } else if (char === '{' || char === '[') {
      open.push(line)
    } else if (char === '}' || char === ']') {
      const start = open.pop()
      if (start !== undefined && line > start) {
        const existing = ranges.get(start)
        if (existing === undefined || line > existing) ranges.set(start, line)
      }
    }
  }
  return ranges
}

/** A key press that would change the text. */
function isEdit(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return ['v', 'x', 'z', 'y'].includes(event.key.toLowerCase())
  return event.key.length === 1 || ['Backspace', 'Delete', 'Enter', 'Tab'].includes(event.key)
}

// One token at a time: a string (and whether a colon follows, making it a key), a number,
// a literal, punctuation, or anything else.
const TOKEN = /("(?:[^"\\]|\\.)*"?)(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g

const TONE = {
  key: 'text-sky-700 dark:text-sky-300',
  string: 'text-emerald-700 dark:text-emerald-300',
  number: 'text-amber-700 dark:text-amber-300',
  literal: 'text-violet-700 dark:text-violet-300',
  punctuation: 'text-muted-foreground',
}

function highlight(line: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > last) parts.push(line.slice(last, index))
    const [whole, string, colon, number, literal, punctuation] = match
    if (string !== undefined) {
      parts.push(
        <span key={index} className={colon ? TONE.key : TONE.string}>
          {string}
        </span>,
      )
      if (colon) parts.push(<span key={`${index}:`} className={TONE.punctuation}>{colon}</span>)
    } else if (number !== undefined) {
      parts.push(<span key={index} className={TONE.number}>{number}</span>)
    } else if (literal !== undefined) {
      parts.push(<span key={index} className={TONE.literal}>{literal}</span>)
    } else if (punctuation !== undefined) {
      parts.push(<span key={index} className={TONE.punctuation}>{punctuation}</span>)
    } else {
      parts.push(whole)
    }
    last = index + whole.length
  }
  if (last < line.length) parts.push(line.slice(last))
  // An empty line still needs content so it keeps its height.
  return parts.length ? parts : ['​']
}

/** Turn a JSON.parse message into a line and column. Browsers report "position N" or "line L column C". */
function locate(text: string, message: string): JsonError {
  const lineColumn = /line (\d+) column (\d+)/i.exec(message)
  if (lineColumn) {
    return { message: tidy(message), line: Number(lineColumn[1]), column: Number(lineColumn[2]) }
  }
  const position = /position (\d+)/i.exec(message)
  if (position) {
    const offset = Number(position[1])
    const before = text.slice(0, offset)
    const line = before.split('\n').length
    return { message: tidy(message), line, column: offset - before.lastIndexOf('\n') }
  }
  if (/unexpected end/i.test(message)) {
    const line = text.split('\n').length
    return { message: tidy(message), line, column: text.length - text.lastIndexOf('\n') }
  }
  return { message: tidy(message) }
}

function tidy(message: string): string {
  // Drop the position details we already show, and the quoted source some browsers append.
  return message
    .replace(/\s*\(line \d+ column \d+\)/i, '')
    .replace(/\s*(at|in JSON at) position \d+.*$/i, '')
    .replace(/,?\s*"[^"]*"\s*is not valid JSON$/i, ' is not valid JSON')
}
