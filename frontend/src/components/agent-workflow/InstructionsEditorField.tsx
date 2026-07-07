import { memo, useEffect, useState } from 'react'
import { Eye, Loader2, Pencil, Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownContent } from '@/components/shared/MarkdownContent'
import { cn } from '@/utils/cn'

type InstructionsViewMode = 'edit' | 'preview'

interface InstructionsEditorFieldProps {
  value: string
  onChange: (value: string) => void
  onGenerate: () => void
  isGenerating?: boolean
  disabled?: boolean
  rows?: number
  /** Increment to switch to preview after AI generation. */
  previewToken?: number
}

/** Markdown instructions editor with AI generate and live preview. */
export const InstructionsEditorField = memo(function InstructionsEditorField({
  value,
  onChange,
  onGenerate,
  isGenerating = false,
  disabled = false,
  rows = 7,
  previewToken = 0,
}: InstructionsEditorFieldProps) {
  const [viewMode, setViewMode] = useState<InstructionsViewMode>('edit')
  const canGenerate = !disabled && !isGenerating

  useEffect(() => {
    if (previewToken > 0) setViewMode('preview')
  }, [previewToken])

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-violet-500/15 bg-gradient-to-b from-violet-500/[0.04] to-background shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        'transition-[border-color,box-shadow] focus-within:border-violet-500/30 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.08)]',
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

      <div className="flex items-center justify-between gap-2 border-b border-violet-500/10 px-2.5 py-1.5">
        <div className="inline-flex rounded-md border border-border/80 bg-background/80 p-0.5">
          <ViewModeButton
            active={viewMode === 'edit'}
            onClick={() => setViewMode('edit')}
            icon={Pencil}
            label="Edit"
          />
          <ViewModeButton
            active={viewMode === 'preview'}
            onClick={() => setViewMode('preview')}
            icon={Eye}
            label="Preview"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] text-muted-foreground/80 sm:inline">Markdown</span>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={onGenerate}
            title="Generate markdown instructions from agent name and description"
            aria-label="Generate instructions with AI"
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-lg',
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

      {viewMode === 'edit' ? (
        <Textarea
          rows={rows}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={'## Role\nDescribe what this agent does…\n\n## Guidelines\n- Use workflow context\n- Call tools when helpful'}
          className={cn(
            'min-h-[9.5rem] resize-none border-0 bg-transparent px-3.5 py-3 font-mono text-xs leading-relaxed shadow-none',
            'placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0',
          )}
        />
      ) : (
        <div className="min-h-[9.5rem] overflow-y-auto px-3.5 py-3">
          <MarkdownContent content={value} emptyMessage="Generate or write markdown instructions to preview them here." />
        </div>
      )}
    </div>
  )
})

function ViewModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Pencil
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors',
        active
          ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}
