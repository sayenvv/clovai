import { memo, useMemo } from 'react'
import { Layers, LayoutTemplate, PanelTop, Wrench } from 'lucide-react'
import { AppConfigProvider } from '@/hooks/use-app-config'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageRenderer } from '@/components/dynamic-renderer/PageRenderer'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import type { AppConfig } from '@/types/config'

interface ConfigPreviewProps {
  config: AppConfig | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Live preview: renders the configuration's landing page inside a dialog
 *  using the exact same dynamic renderer as the real site. */
export const ConfigPreview = memo(function ConfigPreview({
  config,
  open,
  onOpenChange,
}: ConfigPreviewProps) {
  const summary = useMemo(() => {
    if (!config) return []
    return [
      { icon: LayoutTemplate, label: 'Pages', value: config.pages.length },
      {
        icon: Layers,
        label: 'Sections',
        value: config.pages.reduce((total, page) => total + page.sections.length, 0),
      },
      { icon: Wrench, label: 'Tools', value: config.megaMenu.tools.length },
      { icon: PanelTop, label: 'Nav items', value: config.navbar.items.length },
    ]
  }, [config])

  const previewPage = config?.pages.find((page) => page.isVisible !== false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle>Configuration preview</DialogTitle>
          <DialogDescription>
            {config
              ? `${config.meta.name} · v${config.meta.version} — rendered with the live dynamic renderer.`
              : 'No configuration to preview.'}
          </DialogDescription>
          {config && (
            <div className="flex flex-wrap gap-2 pt-2">
              {summary.map(({ icon: SummaryIcon, label, value }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs"
                >
                  <SummaryIcon className="h-3 w-3 text-primary" aria-hidden />
                  <span className="font-semibold">{value}</span> {label}
                </span>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="max-h-[calc(85vh-140px)] overflow-y-auto">
          {config && previewPage ? (
            <ErrorBoundary label="the preview">
              <AppConfigProvider config={config}>
                <div className="origin-top scale-[0.85] pb-8 [width:117.6%] [margin-left:-8.8%]">
                  <PageRenderer page={previewPage} />
                </div>
              </AppConfigProvider>
            </ErrorBoundary>
          ) : (
            <p className="p-10 text-center text-sm text-muted-foreground">
              This configuration has no visible pages to preview.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
