import { memo } from 'react'
import { BookOpen, Lightbulb, Terminal } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CODE_INTEGRATION_GUIDES } from './code-integration-guides'
import type { CodeLanguage } from './diagram-codegen'

interface CodeIntegrationGuideProps {
  language: CodeLanguage
  pageName: string
}

/** Compact how-to panel shown above the generated code sample. */
export const CodeIntegrationGuide = memo(function CodeIntegrationGuide({
  language,
  pageName,
}: CodeIntegrationGuideProps) {
  const guide = CODE_INTEGRATION_GUIDES[language]

  return (
    <div className="shrink-0 border-b bg-muted/30 px-3 py-2">
      <Accordion type="single" collapsible>
        <AccordionItem value="guide" className="border-none">
          <AccordionTrigger className="py-2 text-[11px] font-semibold hover:no-underline">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />
              How to use &amp; integrate
            </span>
          </AccordionTrigger>
          <AccordionContent className="max-h-44 overflow-y-auto pb-2 pt-0">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{pageName}</span> — {guide.summary}
            </p>

            {guide.runCommand && (
              <div className="mt-2.5 flex items-start gap-1.5 rounded-md border bg-background px-2 py-1.5">
                <Terminal className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                <code className="break-all font-mono text-[10.5px] leading-relaxed">{guide.runCommand}</code>
              </div>
            )}

            <ol className="mt-2.5 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            {guide.tips.length > 0 && (
              <div className="mt-2.5 rounded-md border border-dashed px-2 py-1.5">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Lightbulb className="h-3 w-3" aria-hidden />
                  Tips
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {guide.tips.map((tip) => (
                    <li key={tip} className="flex gap-1.5">
                      <span className="text-primary" aria-hidden>
                        ·
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
})
