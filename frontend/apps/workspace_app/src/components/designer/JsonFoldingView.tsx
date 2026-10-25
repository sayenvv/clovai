import { memo, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Matching close line for every line that opens an object or array (pretty-printed JSON). */
export function jsonFoldRanges(lines: string[]): Map<number, number> {
  const ranges = new Map<number, number>()
  const stack: number[] = []
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (/^[}\]]/.test(trimmed)) {
      const start = stack.pop()
      if (start !== undefined) ranges.set(start, index)
    }
    if (/[{[]$/.test(trimmed)) stack.push(index)
  })
  return ranges
}

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

function highlight(line: string, isDark: boolean) {
  const colors = isDark
    ? {
        key: '#9cdcfe',
        string: '#ce9178',
        literal: '#569cd6',
        number: '#b5cea8',
      }
    : {
        key: '#0451a5',
        string: '#a31515',
        literal: '#0000ff',
        number: '#098658',
      }
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > last) parts.push(line.slice(last, index))
    const [text, str, colon, literal] = match
    const color = str ? (colon ? colors.key : colors.string) : literal ? colors.literal : colors.number
    parts.push(
      <span key={index} style={{ color }}>
        {str ?? text}
      </span>,
    )
    if (str && colon) parts.push(colon)
    last = index + text.length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

interface JsonFoldingViewProps {
  code: string
  isDark: boolean
  /** Line indexes whose object/array is collapsed. */
  collapsed: Set<number>
  onToggle: (line: number) => void
}

/** Read-only JSON with line numbers and a fold toggle beside every object and array. */
export const JsonFoldingView = memo(function JsonFoldingView({
  code,
  isDark,
  collapsed,
  onToggle,
}: JsonFoldingViewProps) {
  const lines = useMemo(() => code.replace(/\t/g, '  ').split('\n'), [code])
  const ranges = useMemo(() => jsonFoldRanges(lines), [lines])

  const rows: React.ReactNode[] = []
  for (let index = 0; index < lines.length; index++) {
    const end = ranges.get(index)
    const folded = end !== undefined && collapsed.has(index)
    const line = lines[index]
    const Chevron = folded ? ChevronRight : ChevronDown
    rows.push(
      <div
        key={index}
        className={cn('group flex', isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]')}
      >
        <span
          className={cn(
            'w-[3.25em] shrink-0 select-none pr-1 text-right',
            isDark ? 'bg-black/20 text-[#858585]' : 'bg-black/[0.04] text-[#237893]',
          )}
        >
          {index + 1}
        </span>
        <span className="flex w-5 shrink-0 select-none items-center justify-center">
          {end !== undefined ? (
            <button
              type="button"
              aria-label={folded ? 'Expand' : 'Collapse'}
              onClick={() => onToggle(index)}
              className={cn(
                'rounded-sm',
                folded ? 'opacity-100' : 'opacity-40 group-hover:opacity-100',
                isDark ? 'text-[#c5c5c5] hover:bg-white/10' : 'text-muted-foreground hover:bg-black/10',
              )}
            >
              <Chevron className="h-3 w-3" />
            </button>
          ) : null}
        </span>
        <span className="whitespace-pre pr-4">
          {highlight(line, isDark)}
          {folded ? (
            <>
              <button
                type="button"
                onClick={() => onToggle(index)}
                className={cn(
                  'mx-1 rounded px-1 text-[10px]',
                  isDark
                    ? 'bg-white/10 text-[#cccccc] hover:bg-white/20'
                    : 'bg-black/[0.06] text-muted-foreground hover:bg-black/10',
                )}
              >
                … {end - index - 1} lines
              </button>
              {lines[end].trim()}
            </>
          ) : null}
        </span>
      </div>,
    )
    if (folded) index = end
  }

  return (
    <div
      className={cn('py-3 text-[11px] leading-[1.55]', isDark ? 'text-[#d4d4d4]' : 'text-[#1f1f1f]')}
      style={{
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      }}
    >
      {rows}
    </div>
  )
})
