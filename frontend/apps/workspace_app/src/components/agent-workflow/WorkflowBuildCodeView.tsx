import { pageWorkflowId } from '@/components/agent-workflow/page-workflow-id'
import { Suspense, lazy, memo, useMemo } from 'react'
import { toast } from 'sonner'
import type { Diagram, DiagramDocument } from '@/components/designer/diagram-types'
import type { PaletteItem } from '@/types/config'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'
import { buildWorkflowV4 } from '@/components/agent-workflow/build-workflow-v4'
import { useGenerationSpec } from '@/hooks/use-generation-spec'
import { useWorkflowConfiguration, type WorkflowConfiguration } from '@/services/workflow-configuration-store'
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

/** IDE-style view of the workflow's 4.0 JSON: what Save stores and Run executes. */
export const WorkflowBuildCodeView = memo(function WorkflowBuildCodeView({
  doc,
  pageId,
  pageName,
  diagram,
  serverModelConfig,
  configurationDefaults,
}: WorkflowBuildCodeViewProps) {
  const configuration = useWorkflowConfiguration(
    pageWorkflowId(doc, pageId),
    configurationDefaults,
  )
  const { copied, copy } = useCopyToClipboard()

  // 4.0 follows the generation spec published in the Admin Center.
  const generationSpec = useGenerationSpec()
  const generation = generationSpec.data

  const code = useMemo(() => {
    if (!generation) {
      const reason = generationSpec.error instanceof Error ? generationSpec.error.message : 'Loading the generation spec…'
      return JSON.stringify({ error: reason }, null, 2)
    }
    const workflow = buildWorkflowV4({ doc, pageId, diagram, spec: generation.document, serverModelConfig, configuration })
    return JSON.stringify(workflow, null, 2)
  }, [generation, generationSpec.error, doc, pageId, diagram, serverModelConfig, configuration])

  const fileName = `${slugifyFilename(pageName)}.json`

  const handleCopy = () => copy(code, 'Copied workflow JSON')

  const handleDownload = () => {
    downloadText(code, fileName)
    toast.success('Downloaded JSON')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-[11px]">
        <span className="text-muted-foreground">
          Workflow 4.0
          {generation && ` · generation spec ${generation.version === 0 ? 'built-in' : `v${generation.version}`}`}
        </span>
      </div>
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
