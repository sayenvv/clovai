import { memo, useState } from 'react'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
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
      <DialogContent className="max-w-2xl gap-0 overflow-hidden border-violet-500/20 p-0 sm:rounded-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.12),transparent_55%)]" />

        <div className="relative border-b border-violet-500/15 bg-gradient-to-br from-violet-500/[0.08] via-fuchsia-500/[0.04] to-background px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg tracking-tight">Generate workflow with AI</DialogTitle>
                <DialogDescription className="text-xs leading-relaxed">
                  Describe the automation you want. Eleven Nodes will draft agents, connectors, and instructions on your canvas.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="relative space-y-4 px-6 py-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="generate-workflow-name">
              Workflow name
            </label>
            <Input
              id="generate-workflow-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer onboarding automation"
              className="h-9 border-violet-500/15 bg-background/80"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="generate-workflow-prompt">
                Describe your workflow
              </label>
              <span className="text-[10px] text-muted-foreground/80">
                {llmConfigured ? 'LLM ready' : 'Template fallback without LLM'}
              </span>
            </div>
            <div
              className={cn(
                'overflow-hidden rounded-xl border border-violet-500/15 bg-gradient-to-b from-violet-500/[0.03] to-background',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-violet-500/30 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.08)]',
              )}
            >
              <Textarea
                id="generate-workflow-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={7}
                placeholder="Example: When a lead fills a form, enrich the company profile, score fit, draft a personalized outreach email, and pause for sales approval before sending."
                className="min-h-[9rem] resize-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className={cn(
                    'rounded-full border border-violet-500/15 bg-violet-500/[0.04] px-3 py-1.5 text-left text-[11px] leading-snug text-muted-foreground',
                    'transition-colors hover:border-violet-500/30 hover:bg-violet-500/[0.08] hover:text-foreground',
                  )}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="relative border-t border-border/80 bg-muted/20 px-6 py-4 sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Output follows the workflow JSON schema — agents, tools, and connectors you can edit after generation.
          </p>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-500"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate workflow
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
