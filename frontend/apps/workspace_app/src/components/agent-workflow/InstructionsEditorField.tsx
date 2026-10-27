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
        'group relative overflow-hidden rounded-[3px] border border-border bg-background',
        'transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-2.5 py-1.5">
        <div className="inline-flex rounded-[2px] border border-border/80 bg-background/80 p-0.5">
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
              'inline-flex h-7 w-7 items-center justify-center rounded-[3px]',
              'bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
              'transition-all hover:scale-[1.03]',
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
          ? 'bg-foreground/15 text-foreground dark:text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}
