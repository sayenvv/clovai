import { memo } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'

interface InstructionsEditorFieldProps {
  value: string
  onChange: (value: string) => void
  onGenerate: () => void
  isGenerating?: boolean
  disabled?: boolean
  rows?: number
}

/** Instructions textarea with an inset AI generate control. */
export const InstructionsEditorField = memo(function InstructionsEditorField({
  value,
  onChange,
  onGenerate,
  isGenerating = false,
  disabled = false,
  rows = 7,
}: InstructionsEditorFieldProps) {
  const canGenerate = !disabled && !isGenerating

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-violet-500/15 bg-gradient-to-b from-violet-500/[0.04] to-background shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        'transition-[border-color,box-shadow] focus-within:border-violet-500/30 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.08)]',
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

      <Textarea
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Define how this agent should behave, what to prioritize, and how to use tools…"
        className={cn(
          'min-h-[9.5rem] resize-none border-0 bg-transparent px-3.5 pb-12 pt-3 font-mono text-xs leading-relaxed shadow-none',
          'placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0',
        )}
      />

      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
        <span className="pointer-events-none hidden text-[10px] text-muted-foreground/80 sm:inline">
          AI assist
        </span>
        <button
          type="button"
          disabled={!canGenerate}
          onClick={onGenerate}
          title="Generate instructions from agent name and description"
          aria-label="Generate instructions with AI"
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-lg',
            'bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/25',
            'transition-all hover:scale-[1.03] hover:shadow-lg hover:shadow-violet-500/30',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
          )}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
})
