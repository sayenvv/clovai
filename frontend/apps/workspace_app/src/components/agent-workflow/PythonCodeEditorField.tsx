import { memo, useCallback, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import { Loader2, Maximize2, Sparkles } from 'lucide-react'
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
}: PythonCodeEditorFieldProps) {
  const [expanded, setExpanded] = useState(false)
  const canGenerate = Boolean(onGenerate) && !disabled && !isGenerating

  return (
    <>
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl border border-orange-500/15 bg-gradient-to-b from-orange-500/[0.04] to-background shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
          'transition-[border-color,box-shadow] focus-within:border-orange-500/30 focus-within:shadow-[0_0_0_3px_rgba(249,115,22,0.08)]',
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/40 to-transparent" />

        <PythonCodeEditorChrome
          fileName={fileName}
          onExpand={() => setExpanded(true)}
          onGenerate={onGenerate}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
        />

        <PythonCodeSurface
          value={value}
          onChange={onChange}
          disabled={disabled}
          minRows={minRows}
        />
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
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
  onGenerate,
  canGenerate,
  isGenerating,
  className,
}: {
  fileName: string
  onExpand?: () => void
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
            label="Expand editor"
            onClick={onExpand}
            isDark={isDark}
            icon={Maximize2}
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
              'inline-flex h-7 w-7 items-center justify-center rounded-lg',
              'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/25',
              'transition-all hover:scale-[1.03] hover:shadow-lg hover:shadow-orange-500/30',
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
        'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        isDark
          ? 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

const PythonCodeSurface = memo(function PythonCodeSurface({
  value,
  onChange,
  disabled,
  minRows,
  className,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  minRows: number
  className?: string
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
          spellCheck={false}
          rows={minRows}
          className={cn(
            'python-code-input relative z-10 block min-h-0 w-full resize-none overflow-auto border-0 bg-transparent shadow-none outline-none',
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
