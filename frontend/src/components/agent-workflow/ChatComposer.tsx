import { useState, type ReactNode } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  /** Called on ⌘/Ctrl + Enter when `canSubmit`. */
  onSubmit: () => void
  canSubmit: boolean
  disabled?: boolean
  placeholder?: string
  /** Left side of the toolbar row (e.g. file upload). */
  leading?: ReactNode
  /** Right side of the toolbar row (send / stop button). */
  action: ReactNode
  hint?: ReactNode
  /** Shown above the text box (e.g. attached file chips). */
  header?: ReactNode
  /** Enables dropping files onto the composer. */
  onFilesDropped?: (files: File[]) => void
  autoFocus?: boolean
}

/** Rounded message box shared by the run and generate chats in the right panel. */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  canSubmit,
  disabled = false,
  placeholder = 'Type a message',
  leading,
  action,
  hint,
  header,
  onFilesDropped,
  autoFocus = false,
}: ChatComposerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dropEnabled = Boolean(onFilesDropped) && !disabled

  return (
    <>
      <div
        className={cn(
          'rounded-[22px] border border-border/60 bg-background p-2.5 shadow-sm transition-colors focus-within:border-ring/40 focus-within:ring-2 focus-within:ring-ring/10 dark:border-zinc-700/70 dark:focus-within:border-zinc-600 dark:focus-within:ring-zinc-500/10',
          isDragging && 'border-dashed border-primary/50 bg-primary/[0.03]',
        )}
        onDragOver={(event) => {
          if (!dropEnabled) return
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false)
        }}
        onDrop={(event) => {
          if (!dropEnabled) return
          event.preventDefault()
          setIsDragging(false)
          const files = Array.from(event.dataTransfer.files ?? [])
          if (files.length > 0) onFilesDropped?.(files)
        }}
      >
        {header}
        <Textarea
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="min-h-[52px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 dark:text-white dark:placeholder:text-zinc-500"
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              if (canSubmit) onSubmit()
            }
          }}
        />
        <div className="flex items-center gap-1 pt-1">
          {leading}
          <div className="ml-auto">{action}</div>
        </div>
      </div>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </>
  )
}
