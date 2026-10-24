import { memo, useRef } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { normalizeDocument, type DiagramDocument } from '@/components/designer/diagram-types'

interface ImportWorkflowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The file's workflow, whose nodes are copied onto the current canvas. */
  onImportDocument: (document: DiagramDocument) => void
}

/** Import a workflow JSON file and copy its nodes onto the current canvas. */
export const ImportWorkflowDialog = memo(function ImportWorkflowDialog({
  open,
  onOpenChange,
  onImportDocument,
}: ImportWorkflowDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImportFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        onImportDocument(normalizeDocument(JSON.parse(String(reader.result))))
        onOpenChange(false)
      } catch {
        toast.error('Invalid workflow JSON file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import workflow</DialogTitle>
          <DialogDescription>Import a workflow file and copy its nodes onto this canvas.</DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleImportFile(file)
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Choose workflow JSON file…
        </Button>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
