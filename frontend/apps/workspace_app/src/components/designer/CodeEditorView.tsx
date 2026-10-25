import { memo, useCallback, useEffect, useState } from 'react'
import { Check, ChevronsDownUp, ChevronsUpDown, Copy, Download } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/utils/cn'
import type { CodeLanguage } from './diagram-codegen'
import { JsonFoldingView, jsonFoldRanges } from './JsonFoldingView'

const SYNTAX_LANGUAGE: Record<CodeLanguage | 'json', string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  csharp: 'csharp',
  go: 'go',
  pseudocode: 'plaintext',
  json: 'json',
}

interface CodeEditorViewProps {
  code: string
  language: CodeLanguage | 'json'
  fileName: string
  copied: boolean
  onCopy: () => void
  onDownload: () => void
  className?: string
}

/** Read-only code surface with IDE-style syntax colors and preserved indentation. */
export const CodeEditorView = memo(function CodeEditorView({
  code,
  language,
  fileName,
  copied,
  onCopy,
  onDownload,
  className,
}: CodeEditorViewProps) {
  const { isDark } = useTheme()
  const syntaxStyle = isDark ? vscDarkPlus : vs
  const foldable = language === 'json'
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())

  // Line numbers shift when the code changes, so fresh code starts fully expanded.
  useEffect(() => setCollapsed(new Set()), [code])

  const toggleFold = useCallback((line: number) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }, [])

  // Collapse all keeps the root open so its top-level keys stay visible.
  const collapseAll = useCallback(() => {
    const starts = [...jsonFoldRanges(code.split('\n')).keys()].filter((line) => line > 0)
    setCollapsed(new Set(starts))
  }, [code])

  return (
    <div
      className={cn(
        'code-editor-view flex min-h-0 flex-1 flex-col',
        isDark ? 'bg-[#1e1e1e]' : 'bg-white',
        className,
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b px-2 py-1',
          isDark ? 'border-[#3c3c3c] bg-[#252526]' : 'border-border bg-muted/80',
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-mono text-[10px]',
            isDark ? 'text-[#cccccc]' : 'text-muted-foreground',
          )}
        >
          {fileName}
        </span>
        <div className="flex shrink-0 gap-1">
          {foldable ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-2 text-[10px]',
                  isDark && 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white',
                )}
                onClick={collapseAll}
              >
                <ChevronsDownUp className="h-3 w-3" /> Collapse all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-2 text-[10px]',
                  isDark && 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white',
                )}
                onClick={() => setCollapsed(new Set())}
              >
                <ChevronsUpDown className="h-3 w-3" /> Expand all
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2 text-[10px]',
              isDark && 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white',
            )}
            onClick={onCopy}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2 text-[10px]',
              isDark && 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white',
            )}
            onClick={onDownload}
          >
            <Download className="h-3 w-3" /> Save
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {foldable ? (
          <JsonFoldingView code={code} isDark={isDark} collapsed={collapsed} onToggle={toggleFold} />
        ) : (
          <SyntaxHighlighter
            language={SYNTAX_LANGUAGE[language]}
            style={syntaxStyle}
            showLineNumbers
            wrapLongLines={false}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '12px 0',
              background: isDark ? '#1e1e1e' : '#ffffff',
              fontSize: '11px',
              lineHeight: '1.55',
            }}
            codeTagProps={{
              style: {
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                tabSize: 2,
              },
            }}
            lineNumberStyle={{
              minWidth: '2.75em',
              paddingRight: '1em',
              paddingLeft: '0.75em',
              textAlign: 'right',
              userSelect: 'none',
              opacity: isDark ? 0.45 : 0.55,
              color: isDark ? undefined : '#237893',
              background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
            }}
          >
            {code.replace(/\t/g, '  ')}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  )
})
