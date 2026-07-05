import { memo } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { ValidationResult } from '@/schemas/config.schema'

/** Displays the outcome of Zod schema validation, issue by issue. */
export const ValidationPanel = memo(function ValidationPanel({
  result,
}: {
  result: ValidationResult
}) {
  if (result.success) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
        <p className="text-sm">
          <span className="font-medium">Valid configuration.</span>{' '}
          <span className="text-muted-foreground">
            Schema check passed — ready to preview and save.
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm font-medium">
          {result.issues.length} validation {result.issues.length === 1 ? 'issue' : 'issues'} found
        </p>
      </div>
      <ul className="mt-2.5 flex max-h-48 flex-col gap-1.5 overflow-y-auto pl-6">
        {result.issues.map((issue, index) => (
          <li key={`${issue.path}-${index}`} className="text-xs">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{issue.path}</code>{' '}
            <span className="text-muted-foreground">{issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
})
