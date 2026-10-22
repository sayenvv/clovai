import { Suspense, lazy, memo, useMemo, useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Diagram, DiagramDocument } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import { buildWorkflowSpec } from '@/components/agent-workflow/build-workflow-spec'
import {
  generateWorkflowCode,
  WORKFLOW_CODE_FORMATS,
  type WorkflowCodeFormat,
} from '@/components/agent-workflow/generate-workflow-code'
import { ensureDocumentWorkspaceId } from '@/components/agent-workflow/workflow-build-storage'
import { useCopyToClipboard } from '@/hooks/use-clipboard'
import { downloadText } from '@/utils/download'
import { slugifyFilename } from '@/utils/slug'
import { cn } from '@/utils/cn'

const CodeEditorView = lazy(() =>
  import('@/components/designer/CodeEditorView').then((module) => ({
    default: module.CodeEditorView,
  })),
)

interface WorkflowBuildCodeViewProps {
  doc: DiagramDocument
  pageId: string
  pageName: string
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  serverModelConfig?: WorkflowModelConfig
  onBackToCanvas?: () => void
}

function syntaxLanguage(format: WorkflowCodeFormat): 'json' | 'python' {
  return format
}

/** IDE-style view of workflow build spec and generated Python code. */
export const WorkflowBuildCodeView = memo(function WorkflowBuildCodeView({
  doc,
  pageId,
  pageName,
  diagram,
  paletteById,
  serverModelConfig,
  onBackToCanvas,
}: WorkflowBuildCodeViewProps) {
  const [format, setFormat] = useState<WorkflowCodeFormat>('json')
  const { copied, copy, resetCopied } = useCopyToClipboard()

  const spec = useMemo(() => {
    const withWorkspace = ensureDocumentWorkspaceId(doc)
    return buildWorkflowSpec({
      doc: withWorkspace,
      pageId,
      diagram,
      paletteById,
      workspaceId: withWorkspace.workspaceId!,
      serverModelConfig,
    })
  }, [doc, pageId, diagram, paletteById, serverModelConfig])

  const activeFormat =
    WORKFLOW_CODE_FORMATS.find((option) => option.id === format) ?? WORKFLOW_CODE_FORMATS[0]

  const code = useMemo(() => {
    if (format === 'json') return JSON.stringify(spec, null, 2)
    return generateWorkflowCode(spec)
  }, [spec, format])

  const fileName = `${slugifyFilename(pageName)}.${activeFormat.extension}`

  const handleFormatChange = (value: string) => {
    setFormat(value as WorkflowCodeFormat)
    resetCopied()
  }

  const handleCopy = () => {
    const label = format === 'json' ? 'build spec JSON' : activeFormat.label
    copy(code, `Copied ${label}`)
  }

  const handleDownload = () => {
    downloadText(code, fileName)
    toast.success(`Downloaded ${activeFormat.label}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs
        value={format}
        onValueChange={handleFormatChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex shrink-0 items-center gap-2 border-b bg-muted/20 px-2 py-1.5">
          {onBackToCanvas ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
              onClick={onBackToCanvas}
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              Canvas
            </Button>
          ) : null}
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {WORKFLOW_CODE_FORMATS.map((option) => (
              <TabsTrigger
                key={option.id}
                value={option.id}
                className="h-7 px-2.5 text-[11px] data-[state=active]:bg-muted"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Badge variant="secondary" className="ml-auto shrink-0 px-1.5 py-0 text-[10px]">
            {format === 'json' ? 'Build spec' : 'Generated'}
          </Badge>
        </div>

        <TabsContent
          value={format}
          className={cn('mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden')}
        >
          <Suspense
            fallback={
              <pre className="min-h-0 flex-1 overflow-auto bg-[#1e1e1e] p-3 font-mono text-[11px] leading-relaxed text-[#cccccc]">
                {code}
              </pre>
            }
          >
            <CodeEditorView
              code={code}
              language={syntaxLanguage(format)}
              fileName={fileName}
              copied={copied}
              onCopy={handleCopy}
              onDownload={handleDownload}
              className="min-h-0 flex-1"
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
})
