import { memo, useRef, useState, type DragEvent } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface ExecutionFileUploadButtonProps {
  disabled?: boolean
  onInputLoaded: (value: string) => void
  variant?: 'inline' | 'icon'
  className?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isTextFile(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    /\.(csv|json|log|md|txt|xml|yaml|yml)$/i.test(file.name)
  )
}

async function readFileInput(file: File): Promise<string> {
  return file.text()
}

export const ExecutionFileUploadButton = memo(function ExecutionFileUploadButton({
  disabled = false,
  onInputLoaded,
  variant = 'inline',
  className,
}: ExecutionFileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ name: string; sizeLabel: string } | null>(null)

  const handleFile = async (file: File) => {
    if (!isTextFile(file)) {
      toast.error('Upload a text, JSON, CSV, Markdown, XML, or YAML file.')
      return
    }

    try {
      const value = await readFileInput(file)
      onInputLoaded(value)
      setAttachedFile({ name: file.name, sizeLabel: formatFileSize(file.size) })
      toast.success(`Attached ${file.name}`)
    } catch {
      toast.error('Could not read that file.')
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = event.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  if (variant === 'icon') {
    return (
      <div
        className={cn(isDragging && 'rounded-md ring-2 ring-foreground/30', className)}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.json,.log,.md,.txt,.xml,.yaml,.yml,application/json,text/*"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.currentTarget.value = ''
            if (file) void handleFile(file)
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          aria-label={attachedFile ? `Replace ${attachedFile.name}` : 'Attach file'}
          title={attachedFile ? `${attachedFile.name} · ${attachedFile.sizeLabel}` : 'Attach file'}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-transparent p-1 transition-colors',
        isDragging && 'border-dashed border-primary/40 bg-primary/5',
        className,
      )}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".csv,.json,.log,.md,.txt,.xml,.yaml,.yml,application/json,text/*"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.currentTarget.value = ''
          if (file) void handleFile(file)
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full border border-border bg-background shadow-sm hover:bg-accent"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label="Attach file"
        title="Attach file"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {attachedFile ? (
        <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 shadow-sm">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">{attachedFile.name}</span>
            <span className="block text-[10px] text-muted-foreground">{attachedFile.sizeLabel}</span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full"
            onClick={() => setAttachedFile(null)}
            aria-label="Remove attached file"
            title="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          Attach a file or drop it here
        </span>
      )}
    </div>
  )
})
