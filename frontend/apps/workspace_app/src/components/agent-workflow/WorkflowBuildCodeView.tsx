import { pageWorkflowId } from '@/components/agent-workflow/page-workflow-id'
import { Suspense, lazy, memo, useMemo } from 'react'
import { toast } from 'sonner'
import type { Diagram, DiagramDocument } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import { buildWorkflowSpec } from '@/components/agent-workflow/build-workflow-spec'
import { buildWorkflowDocument } from '@/components/agent-workflow/workflow-document'
import { useWorkflowConfiguration, type WorkflowConfiguration } from '@/services/workflow-configuration-store'
import { ensureDocumentWorkspaceId } from '@/components/agent-workflow/workflow-build-storage'
import { useCopyToClipboard } from '@/hooks/use-clipboard'
import { downloadText } from '@/utils/download'
import { slugifyFilename } from '@/utils/slug'

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
  /** Default values from `designer.configuration` in mega-menu.json. */
  configurationDefaults?: Partial<WorkflowConfiguration>
}

/** IDE-style view of the workflow build spec JSON. */
export const WorkflowBuildCodeView = memo(function WorkflowBuildCodeView({
  doc,
  pageId,
  pageName,
  diagram,
  paletteById,
  serverModelConfig,
  configurationDefaults,
}: WorkflowBuildCodeViewProps) {
  const configuration = useWorkflowConfiguration(
    pageWorkflowId(doc, pageId),
    configurationDefaults,
  )
  const { copied, copy } = useCopyToClipboard()

  const spec = useMemo(() => {
    const withWorkspace = ensureDocumentWorkspaceId(doc)
    return buildWorkflowSpec({
      doc: withWorkspace,
      pageId,
      diagram,
      paletteById,
      workspaceId: withWorkspace.workspaceId!,
      serverModelConfig,
      configuration,
    })
  }, [doc, pageId, diagram, paletteById, serverModelConfig, configuration])

  // The pattern's own object holds its connections; agents and tools are shared (see workflow-document).
  const code = useMemo(() => JSON.stringify(buildWorkflowDocument(spec, diagram), null, 2), [spec, diagram])

  const fileName = `${slugifyFilename(pageName)}.json`

  const handleCopy = () => copy(code, 'Copied build spec JSON')

  const handleDownload = () => {
    downloadText(code, fileName)
    toast.success('Downloaded JSON')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense
        fallback={
          <pre className="min-h-0 flex-1 overflow-auto bg-[#1e1e1e] p-3 font-mono text-[11px] leading-relaxed text-[#cccccc]">
            {code}
          </pre>
        }
      >
        <CodeEditorView
          code={code}
          language="json"
          fileName={fileName}
          copied={copied}
          onCopy={handleCopy}
          onDownload={handleDownload}
          className="min-h-0 flex-1"
        />
      </Suspense>
    </div>
  )
})
