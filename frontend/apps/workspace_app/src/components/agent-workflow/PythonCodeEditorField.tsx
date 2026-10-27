import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import { Loader2, Maximize2, Minimize2, Sparkles } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/utils/cn'

interface PythonCodeEditorFieldProps {
  value: string
  onChange: (value: string) => void
  fileName?: string
  onGenerate?: () => void
  isGenerating?: boolean
  disabled?: boolean
  minRows?: number
  className?: string
  /**
   * Maximize in place instead of the expand dialog: the expand button calls this, and the
   * host grows the editor to fill its view. `maximized` switches the button to restore.
   */
  onToggleMaximize?: () => void
  maximized?: boolean
  /** `false` drops the expand button (hosts that already give the code the whole view). */
  expandable?: boolean
  /** Grow to the container's height instead of `minRows` (the container must have one). */
  fill?: boolean
  /** An IDE-style status bar under the code: cursor position, line count and language. */
  statusBar?: boolean
}

const EDITOR_FONT =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace'
const EDITOR_FONT_SIZE = '11px'
const EDITOR_LINE_HEIGHT = '1.55'
const EDITOR_PADDING_X = 12
const EDITOR_PADDING_Y = 12

function lineCountFor(value: string): number {
  return Math.max(1, value.split('\n').length)
}

function displayCode(value: string): string {
  const normalized = value.replace(/\t/g, '  ')
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`
}

/** Editable Python surface with IDE chrome, syntax highlighting, expand dialog, and optional AI generate. */
export const PythonCodeEditorField = memo(function PythonCodeEditorField({
  value,
  onChange,
  fileName = 'handler.py',
  onGenerate,
  isGenerating = false,
  disabled = false,
  minRows = 12,
  className,
  onToggleMaximize,
  maximized = false,
  expandable = true,
  fill = false,
  statusBar = false,
}: PythonCodeEditorFieldProps) {
  const [expanded, setExpanded] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const stretch = fill || maximized
  const canGenerate = Boolean(onGenerate) && !disabled && !isGenerating

  return (
    <>
      <div
        className={cn(
          'group relative overflow-hidden rounded-[3px] border border-border bg-background',
          stretch && 'flex h-full flex-col',
          'transition-[border-color,box-shadow] focus-within:border-orange-500/30 focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.08)]',
          className,
        )}
      >
        <PythonCodeEditorChrome
          fileName={fileName}
          onExpand={expandable ? onToggleMaximize ?? (() => setExpanded(true)) : undefined}
          expanded={maximized}
          onGenerate={onGenerate}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
        />

        <PythonCodeSurface
          value={value}
          onChange={onChange}
          disabled={disabled}
          minRows={minRows}
          className={stretch ? 'min-h-0 flex-1' : undefined}
          onCursorChange={statusBar ? setCursor : undefined}
        />
        {statusBar ? <PythonStatusBar value={value} cursor={cursor} readOnly={disabled} /> : null}
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-[3px]">
          <DialogHeader className="border-b border-border px-4 py-3 text-left">
            <DialogTitle className="text-base">Handler source</DialogTitle>
            <DialogDescription className="text-xs">
              Python handler for this executor — imports must use <code className="text-[10px]">elevennodes</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col border-b border-border">
            <PythonCodeEditorChrome
              fileName={fileName}
              onGenerate={onGenerate}
              canGenerate={canGenerate}
              isGenerating={isGenerating}
              className="border-b border-border/80"
            />
            <PythonCodeSurface
              value={value}
              onChange={onChange}
              disabled={disabled}
              minRows={24}
              className="min-h-[60vh] flex-1"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})

function PythonCodeEditorChrome({
  fileName,
  onExpand,
  expanded = false,
  onGenerate,
  canGenerate,
  isGenerating,
  className,
}: {
  fileName: string
  onExpand?: () => void
  expanded?: boolean
  onGenerate?: () => void
  canGenerate: boolean
  isGenerating: boolean
  className?: string
}) {
  const { isDark } = useTheme()

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-2.5 py-1.5',
        isDark ? 'bg-[#252526]' : 'bg-muted/80',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'truncate font-mono text-[10px]',
            isDark ? 'text-[#cccccc]' : 'text-muted-foreground',
          )}
        >
          {fileName}
        </span>
        <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-700 dark:text-orange-300">
          Python
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onExpand ? (
          <ChromeButton
            label={expanded ? 'Restore editor' : 'Expand editor'}
            onClick={onExpand}
            isDark={isDark}
            icon={expanded ? Minimize2 : Maximize2}
          />
        ) : null}
        {onGenerate ? (
          <button
            type="button"
            disabled={!canGenerate}
            onClick={onGenerate}
            title="Generate handler code with AI"
            aria-label="Generate handler code with AI"
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-[3px]',
              'bg-primary text-primary-foreground',
              'transition-all hover:shadow-orange-500/30',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
            )}
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ChromeButton({
  label,
  onClick,
  isDark,
  icon: Icon,
}: {
  label: string
  onClick: () => void
  isDark: boolean
  icon: typeof Maximize2
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-[2px] transition-colors',
        isDark
          ? 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

/** The bar under the code: where the caret is on the left, the file's facts on the right. */
function PythonStatusBar({
  value,
  cursor,
  readOnly,
}: {
  value: string
  cursor: { line: number; column: number }
  readOnly: boolean
}) {
  const { isDark } = useTheme()
  const lines = lineCountFor(value)
  return (
    <div
      className={cn(
        'flex h-6 shrink-0 items-center gap-3 border-t px-2.5 font-mono text-[10px] tabular-nums',
        isDark ? 'border-[#3c3c3c] bg-[#252526] text-[#9d9d9d]' : 'border-border bg-muted/60 text-muted-foreground',
      )}
    >
      <span>
        Ln {cursor.line}, Col {cursor.column}
      </span>
      {readOnly ? <span className="text-amber-600 dark:text-amber-400">Read-only</span> : null}
      <span className="ml-auto">{lines} {lines === 1 ? 'line' : 'lines'}</span>
      <span>Spaces: 2</span>
      <span>UTF-8</span>
      <span className="flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden />
        Python
      </span>
    </div>
  )
}

const PythonCodeSurface = memo(function PythonCodeSurface({
  value,
  onChange,
  disabled,
  minRows,
  onCursorChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  minRows: number
  className?: string
  onCursorChange?: (cursor: { line: number; column: number }) => void
}) {
  const { isDark } = useTheme()
  const syntaxStyle = isDark ? vscDarkPlus : vs
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const [scrollOffset, setScrollOffset] = useState({ top: 0, left: 0 })
  const lineCount = useMemo(() => lineCountFor(value), [value])
  const highlightedCode = useMemo(() => displayCode(value), [value])

  const syncScroll = useCallback((target: HTMLTextAreaElement) => {
    setScrollOffset({ top: target.scrollTop, left: target.scrollLeft })
    if (gutterRef.current) gutterRef.current.scrollTop = target.scrollTop
  }, [])

  const reportCursor = (textarea: HTMLTextAreaElement) => {
    if (!onCursorChange) return
    const before = textarea.value.slice(0, textarea.selectionStart)
    const lastBreak = before.lastIndexOf('\n')
    onCursorChange({ line: before.split('\n').length, column: before.length - lastBreak })
  }

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    syncScroll(event.currentTarget)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const textarea = event.currentTarget
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const next = `${value.slice(0, start)}  ${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      textarea.selectionStart = start + 2
      textarea.selectionEnd = start + 2
    })
  }

  const editorSurfaceStyle = {
    fontFamily: EDITOR_FONT,
    fontSize: EDITOR_FONT_SIZE,
    lineHeight: EDITOR_LINE_HEIGHT,
    padding: `${EDITOR_PADDING_Y}px ${EDITOR_PADDING_X}px`,
    tabSize: 2,
  } as const

  return (
    <div
      className={cn(
        'flex min-h-0 overflow-hidden',
        isDark ? 'bg-[#1e1e1e]' : 'bg-white',
        className,
      )}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className={cn(
          'shrink-0 overflow-hidden border-r text-right font-mono select-none',
          isDark ? 'border-[#3c3c3c] bg-[#1e1e1e] text-[#858585]' : 'border-border bg-muted/30 text-muted-foreground/70',
        )}
        style={{
          width: '2.75rem',
          fontSize: EDITOR_FONT_SIZE,
          lineHeight: EDITOR_LINE_HEIGHT,
          paddingTop: EDITOR_PADDING_Y,
          paddingBottom: EDITOR_PADDING_Y,
          paddingRight: 8,
        }}
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index + 1} className="px-1">
            {index + 1}
          </div>
        ))}
      </div>

      <div className="relative min-h-0 min-w-0 flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <div
            style={{
              transform: `translate(${-scrollOffset.left}px, ${-scrollOffset.top}px)`,
            }}
          >
            <SyntaxHighlighter
              language="python"
              style={syntaxStyle}
              PreTag="div"
              wrapLongLines={false}
              showLineNumbers={false}
              customStyle={{
                margin: 0,
                background: 'transparent',
                ...editorSurfaceStyle,
              }}
              codeTagProps={{
                style: {
                  fontFamily: EDITOR_FONT,
                  fontSize: EDITOR_FONT_SIZE,
                  lineHeight: EDITOR_LINE_HEIGHT,
                  tabSize: 2,
                },
              }}
            >
              {highlightedCode}
            </SyntaxHighlighter>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onSelect={(event) => reportCursor(event.currentTarget)}
          spellCheck={false}
          rows={minRows}
          className={cn(
            'python-code-input relative z-10 block h-full min-h-0 w-full resize-none overflow-auto border-0 bg-transparent shadow-none outline-none',
            'font-mono focus-visible:ring-0 focus-visible:ring-offset-0',
            isDark ? 'caret-[#aeafad]' : 'caret-foreground',
            'text-transparent selection:bg-orange-500/30',
            disabled && 'cursor-not-allowed opacity-60',
          )}
          style={{
            ...editorSurfaceStyle,
            WebkitTextFillColor: 'transparent',
            whiteSpace: 'pre',
            overflowWrap: 'normal',
          }}
        />
      </div>
    </div>
  )
})
