import { memo, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { generateWorkflowFromPrompt } from '@/services/generate-workflow-api'
import { cn } from '@/utils/cn'
import type { WorkflowGenerationPlan } from '@/types/workflow-generation'

const EXAMPLE_PROMPTS = [
  'Research a topic, summarize findings, and draft a blog post with human review before publish.',
  'Ingest support tickets, classify urgency, route to the right specialist, and draft replies.',
  'Extract invoice fields from uploaded PDFs, validate totals, and push to accounting.',
]

interface GenerateWorkflowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowName?: string
  llmConfigured?: boolean
  onGenerated: (plan: WorkflowGenerationPlan, meta: { model: string; origin: string }) => void
}

export const GenerateWorkflowDialog = memo(function GenerateWorkflowDialog({
  open,
  onOpenChange,
  workflowName = '',
  llmConfigured = false,
  onGenerated,
}: GenerateWorkflowDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [name, setName] = useState(workflowName)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (open) setName(workflowName)
  }, [open, workflowName])

  const canGenerate = prompt.trim().length >= 8 && !isGenerating

  const handleGenerate = async () => {
    if (!canGenerate) return

    setIsGenerating(true)
    try {
      const result = await generateWorkflowFromPrompt({
        prompt: prompt.trim(),
        workflowName: name.trim() || undefined,
      })
      onGenerated(result.plan, { model: result.model, origin: result.origin })
      if (result.origin === 'template') {
        toast.success('Workflow drafted from template — configure LLM in server .env for AI generation')
      } else {
        toast.success(`Workflow generated with ${result.model}`)
      }
      onOpenChange(false)
      setPrompt('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate workflow')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,40rem)] max-w-lg flex-col gap-0 overflow-hidden border-border p-0 sm:max-w-xl sm:rounded-xl">
        <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-5">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  Generate with AI
                </DialogTitle>
                <DialogDescription className="text-[12px] leading-relaxed sm:text-xs">
                  Describe the automation. Agents, connectors, and instructions are drafted onto your
                  canvas so you can edit them.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="space-y-2">
            <label
              className="text-[12px] font-medium text-foreground"
              htmlFor="generate-workflow-name"
            >
              Workflow name
            </label>
            <Input
              id="generate-workflow-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer onboarding automation"
              className="h-10 border-border bg-background"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                className="text-[12px] font-medium text-foreground"
                htmlFor="generate-workflow-prompt"
              >
                Describe your workflow
              </label>
              <Badge
                variant="outline"
                className={cn(
                  'h-5 px-1.5 text-[10px] font-medium',
                  llmConfigured
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-border bg-muted/50 text-muted-foreground',
                )}
              >
                {llmConfigured ? 'LLM ready' : 'Template fallback'}
              </Badge>
            </div>
            <Textarea
              id="generate-workflow-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              placeholder="Example: When a lead fills a form, enrich the company profile, score fit, draft a personalized outreach email, and pause for sales approval before sending."
              className="min-h-[8.5rem] resize-none border-border bg-background text-sm leading-relaxed"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">Try an example</p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className={cn(
                    'rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 text-left text-[11px] leading-snug text-muted-foreground',
                    'transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground',
                    'active:border-red-500/35 active:bg-red-500/[0.04]',
                  )}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <p className="text-[11px] leading-snug text-muted-foreground sm:max-w-[55%]">
            Output follows the workflow schema — edit agents and connectors after generation.
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!canGenerate}
              className="flex-1 bg-red-600 font-semibold text-white hover:bg-red-700 sm:flex-none"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
