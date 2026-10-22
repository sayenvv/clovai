import { memo, useCallback, useRef, useState, type DragEvent } from 'react'
import { FileJson, UploadCloud } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatBytes } from '@/utils/format'

interface UploadDropzoneProps {
  onFileRead: (content: string, fileName: string) => void
}

/** Drag & drop / click-to-browse upload area for JSON configuration files. */
export const UploadDropzone = memo(function UploadDropzone({ onFileRead }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readFile = useCallback(
    (file: File) => {
      setError(null)
      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        setError('Please upload a .json file.')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setFileInfo({ name: file.name, size: file.size })
        onFileRead(String(reader.result), file.name)
      }
      reader.onerror = () => setError('Could not read the file. Please try again.')
      reader.readAsText(file)
    },
    [onFileRead],
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragging(false)
      const file = event.dataTransfer.files[0]
      if (file) readFile(file)
    },
    [readFile],
  )

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload JSON configuration file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium">
            Drop your JSON file here, or <span className="text-primary">browse</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Accepts a single .json configuration file</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) readFile(file)
            event.target.value = ''
          }}
        />
      </div>

      {fileInfo && !error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <FileJson className="h-4 w-4 text-primary" aria-hidden />
          <span className="font-medium">{fileInfo.name}</span>
          <span className="text-muted-foreground">{formatBytes(fileInfo.size)}</span>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  )
})
