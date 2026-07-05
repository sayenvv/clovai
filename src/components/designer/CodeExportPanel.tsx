import { Suspense, lazy, memo, useMemo, useState } from 'react'
import { Code2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CODE_PANEL_WIDTH } from '@/constants/designer'
import { useCopyToClipboard } from '@/hooks/use-clipboard'
import { useHorizontalResize } from '@/hooks/use-horizontal-resize'
import { downloadText } from '@/utils/download'
import { slugifyFilename } from '@/utils/slug'
import { cn } from '@/utils/cn'
import { DesignerPanelHeader } from './DesignerPanelHeader'
import { DesignerResizeHandle } from './DesignerResizeHandle'
import type { CodeLanguage } from './diagram-codegen'
import { CodeIntegrationGuide } from './CodeIntegrationGuide'
import { CODE_LANGUAGES, generateDiagramCode } from './diagram-codegen'
import type { Diagram } from './diagram-types'
import type { PaletteItem } from '@/types/config'

const CodeEditorView = lazy(() =>
  import('./CodeEditorView').then((module) => ({ default: module.CodeEditorView })),
)

interface CodeExportPanelProps {
  diagram: Diagram
  paletteById: Map<string, PaletteItem>
  pageName: string
  toolTitle: string
  onClose: () => void
}

/** Right sidebar: sample workflow code from the active diagram page.
 *  Drag the left edge to resize. Full API export integration comes later. */
export const CodeExportPanel = memo(function CodeExportPanel({
  diagram,
  paletteById,
  pageName,
  toolTitle,
  onClose,
}: CodeExportPanelProps) {
  const [language, setLanguage] = useState<CodeLanguage>('javascript')
  const { width, onResizePointerDown } = useHorizontalResize({
    initialWidth: CODE_PANEL_WIDTH.default,
    minWidth: CODE_PANEL_WIDTH.min,
    maxWidth: CODE_PANEL_WIDTH.max,
    invert: true,
  })
  const { copied, copy, resetCopied } = useCopyToClipboard()

  const code = useMemo(
    () => generateDiagramCode(diagram, paletteById, language, pageName),
    [diagram, paletteById, language, pageName],
  )

  const activeLanguage = CODE_LANGUAGES.find((option) => option.id === language) ?? CODE_LANGUAGES[0]
  const fileName = `${slugifyFilename(pageName)}.${activeLanguage.extension}`

  const handleLanguageChange = (value: string) => {
    setLanguage(value as CodeLanguage)
    resetCopied()
  }

  const copyCode = () => copy(code, `Copied ${activeLanguage.label} sample`)

  const downloadCode = () => {
    downloadText(code, fileName)
    toast.success(`Downloaded ${activeLanguage.label} sample`)
  }

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l bg-background"
      style={{ width }}
      aria-label="Build as code"
    >
      <DesignerResizeHandle
        side="left"
        onPointerDown={onResizePointerDown}
        ariaLabel="Resize code panel"
      />

      <DesignerPanelHeader
        icon={<Code2 className="h-4 w-4" />}
        title="Build as code"
        badge={
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            Preview
          </Badge>
        }
        description={
          <>
            Sample from <strong className="font-medium text-foreground">{pageName}</strong> ·{' '}
            {toolTitle}. Full API export ships in a future update.
          </>
        }
        onClose={onClose}
        closeLabel="Close code panel"
      />

      <Tabs value={language} onValueChange={handleLanguageChange} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-3 py-2">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {CODE_LANGUAGES.map((option) => (
              <TabsTrigger
                key={option.id}
                value={option.id}
                className="h-7 px-2.5 text-[11px] data-[state=active]:bg-muted"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent
          value={language}
          className={cn('mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden')}
        >
          <CodeIntegrationGuide language={language} pageName={pageName} />
          <Suspense
            fallback={
              <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {code}
              </pre>
            }
          >
            <CodeEditorView
              code={code}
              language={language}
              fileName={fileName}
              copied={copied}
              onCopy={copyCode}
              onDownload={downloadCode}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </aside>
  )
})
