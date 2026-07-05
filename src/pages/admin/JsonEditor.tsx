import { memo, useMemo } from 'react'
import { Braces, WrapText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
}

/** Minimal JSON editor: monospace textarea with line/char stats and a
 *  pretty-print action. */
export const JsonEditor = memo(function JsonEditor({ value, onChange }: JsonEditorProps) {
  const stats = useMemo(() => {
    const lines = value ? value.split('\n').length : 0
    return { lines, chars: value.length }
  }, [value])

  const format = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2))
    } catch {
      // Leave content untouched when it isn't parseable; validation will surface the error.
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Braces className="h-3.5 w-3.5" aria-hidden />
          config.json
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {stats.lines} lines · {stats.chars.toLocaleString()} chars
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={format}>
            <WrapText className="h-3.5 w-3.5" /> Format
          </Button>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        placeholder='{ "meta": { "name": "...", "version": "1.0.0" }, ... }'
        className="min-h-[320px] resize-y rounded-none border-0 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-0"
        aria-label="JSON configuration editor"
      />
    </div>
  )
})
