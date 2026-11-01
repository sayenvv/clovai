import { useState, type ReactNode } from 'react'
import { CheckCircle2, ChevronRight, FileDiff, FilePlus2, MinusCircle, SquareTerminal, XCircle } from 'lucide-react'
import type { ToolCard, ToolFileChange } from '@/types/agent-workflow'
import { cn } from '@/utils/cn'

/** The card a tool call is shown as in the assistant's chat, instead of a line of text. */
export function ToolCardView({ card }: { card: ToolCard }) {
  return (
    <div className="mt-1.5 space-y-1.5">
      {card.file ? <FileChangeCard file={card.file} /> : null}
      {card.checks ? <ChecksCard checks={card.checks} /> : null}
      {card.command ? <CommandCard command={card.command} /> : null}
    </div>
  )
}

function Shell({ icon, title, meta, tone = 'neutral', defaultOpen, children }: {
  icon: ReactNode
  title: ReactNode
  meta?: ReactNode
  tone?: 'neutral' | 'good' | 'bad'
  defaultOpen: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[6px] border bg-card',
        tone === 'bad' ? 'border-red-500/30' : tone === 'good' ? 'border-emerald-500/25' : 'border-border',
      )}
    >
      <button
        type="button"
        disabled={!children}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={children ? open : undefined}
        className="flex h-8 w-full min-w-0 items-center gap-2 px-2.5 text-left text-[12px] hover:bg-foreground/[0.03] disabled:hover:bg-transparent"
      >
        <span className="shrink-0 text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
        {meta}
        {children ? <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} /> : null}
      </button>
      {open && children ? <div className="border-t border-border">{children}</div> : null}
    </div>
  )
}

function Counts({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums">
      {added ? <span className="text-emerald-600 dark:text-emerald-400">+{added}</span> : null}
      {removed ? <span className="text-red-600 dark:text-red-400">−{removed}</span> : null}
    </span>
  )
}

/** A file the assistant created or edited: its path, lines added and removed, and the diff. */
export function FileChangeCard({ file }: { file: ToolFileChange }) {
  const name = file.path.split('/').pop() ?? file.path
  const folder = file.path.slice(0, file.path.length - name.length)
  // Line numbers of the new file, counted from each hunk's start
  let line = 0
  return (
    <Shell
      icon={file.created ? <FilePlus2 className="text-emerald-600" /> : <FileDiff className="text-sky-600" />}
      title={
        <span title={file.path}>
          {folder ? <span className="font-normal text-muted-foreground">{folder}</span> : null}
          {name}
        </span>
      }
      meta={
        <>
          <span className="shrink-0 rounded-[3px] border border-border px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {file.created ? 'Created' : 'Edited'}
          </span>
          <Counts added={file.added} removed={file.removed} />
        </>
      }
      defaultOpen={!file.created && file.lines.length > 0 && file.lines.length <= 40}
    >
      {file.lines.length ? (
        <div className="max-h-72 overflow-auto bg-background">
          <table className="w-full border-collapse font-mono text-[11.5px] leading-[1.6]">
            <tbody>
              {file.lines.map(([kind, text], index) => {
                if (kind === '@') {
                  line = Number(text) || 1
                  return index === 0 ? null : (
                    <tr key={index} className="bg-muted/40 text-muted-foreground">
                      <td colSpan={3} className="px-2 py-0.5 text-[10.5px]">⋯</td>
                    </tr>
                  )
                }
                const number = kind === '-' ? '' : String(line++)
                return (
                  <tr
                    key={index}
                    className={cn(
                      kind === '+' && 'bg-emerald-500/[0.10]',
                      kind === '-' && 'bg-red-500/[0.10]',
                    )}
                  >
                    <td className="w-10 select-none px-2 text-right align-top text-muted-foreground/60">{number}</td>
                    <td
                      className={cn(
                        'w-4 select-none align-top',
                        kind === '+' ? 'text-emerald-600 dark:text-emerald-400' : kind === '-' ? 'text-red-600 dark:text-red-400' : 'text-transparent',
                      )}
                    >
                      {kind === ' ' ? '·' : kind === '-' ? '−' : '+'}
                    </td>
                    <td className="whitespace-pre pr-3 text-foreground/90">{text || ' '}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {file.truncated ? <p className="border-t border-border px-2.5 py-1 text-[11px] text-muted-foreground">The change is longer; open the file to see all of it.</p> : null}
        </div>
      ) : (
        <p className="px-2.5 py-1.5 text-[11.5px] text-muted-foreground">No lines changed.</p>
      )}
    </Shell>
  )
}

/** The project's checks (lint, typecheck, build, tests): which passed, which failed and their first errors. */
function ChecksCard({ checks }: { checks: NonNullable<ToolCard['checks']> }) {
  const failed = new Set(checks.failed)
  const skipped = new Set(checks.skipped)
  return (
    <Shell
      icon={checks.passed ? <CheckCircle2 className="text-emerald-600" /> : <XCircle className="text-red-600" />}
      title={checks.passed ? 'All checks passed' : checks.failed.length ? `${checks.failed.length} check${checks.failed.length === 1 ? '' : 's'} failed` : 'Checks did not run'}
      tone={checks.passed ? 'good' : 'bad'}
      meta={
        <span className="flex shrink-0 items-center gap-1">
          {[...checks.ran, ...checks.skipped].map((name) => (
            <span
              key={name}
              className={cn(
                'rounded-[3px] px-1.5 text-[10.5px]',
                skipped.has(name)
                  ? 'bg-muted text-muted-foreground'
                  : failed.has(name)
                    ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              )}
            >
              {name}
            </span>
          ))}
        </span>
      }
      defaultOpen={!checks.passed}
    >
      {checks.errors.length ? (
        <ul className="space-y-1 px-2.5 py-2 text-[11.5px]">
          {checks.errors.map((error, index) => (
            <li key={index} className="flex min-w-0 gap-2">
              <MinusCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
              <span className="min-w-0">
                {error.file ? (
                  <span className="font-mono text-muted-foreground">
                    {error.file}
                    {error.line ? `:${error.line}` : ''}{' '}
                  </span>
                ) : null}
                <span className="text-foreground/90">{error.message}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Shell>
  )
}

/** A command the assistant ran in the project: the command, its outcome and the end of its output. */
function CommandCard({ command }: { command: NonNullable<ToolCard['command']> }) {
  const ok = command.ran && command.ok
  return (
    <Shell
      icon={<SquareTerminal />}
      title={<span className="font-mono text-[11.5px]">$ {command.text || 'command'}</span>}
      tone={ok ? 'neutral' : 'bad'}
      meta={
        <span
          className={cn(
            'shrink-0 rounded-[3px] px-1.5 text-[10.5px]',
            ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300',
          )}
        >
          {command.refused ? 'Refused' : !command.ran ? 'Not run' : ok ? 'Exit 0' : `Exit ${command.exitCode ?? '?'}`}
        </span>
      }
      defaultOpen={!ok}
    >
      {command.refused || command.log ? (
        <pre className="max-h-56 overflow-auto bg-zinc-950 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-zinc-200">
          {command.refused || command.log}
        </pre>
      ) : null}
    </Shell>
  )
}

/** What a finished turn changed in the project, above its steps: files, lines added and removed. */
export function ChangesSummary({ files }: { files: ToolFileChange[] }) {
  // A file edited several times counts once, with its edits added up
  const byPath = new Map<string, ToolFileChange>()
  for (const file of files) {
    const seen = byPath.get(file.path)
    byPath.set(file.path, seen ? { ...seen, added: seen.added + file.added, removed: seen.removed + file.removed, created: seen.created || file.created } : file)
  }
  const all = [...byPath.values()]
  if (!all.length) return null
  const added = all.reduce((sum, file) => sum + file.added, 0)
  const removed = all.reduce((sum, file) => sum + file.removed, 0)
  return (
    <div className="rounded-[6px] border border-border bg-card">
      <div className="flex h-8 items-center gap-2 border-b border-border px-2.5 text-[12px]">
        <FileDiff className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">
          {all.length} file{all.length === 1 ? '' : 's'} changed
        </span>
        <span className="ml-auto">
          <Counts added={added} removed={removed} />
        </span>
      </div>
      <ul className="py-1">
        {all.map((file) => (
          <li key={file.path} className="flex h-6 min-w-0 items-center gap-2 px-2.5 text-[11.5px]">
            {file.created ? <FilePlus2 className="h-3 w-3 shrink-0 text-emerald-600" /> : <FileDiff className="h-3 w-3 shrink-0 text-sky-600" />}
            <span className="min-w-0 flex-1 truncate font-mono text-foreground/85" title={file.path}>
              {file.path}
            </span>
            <Counts added={file.added} removed={file.removed} />
          </li>
        ))}
      </ul>
    </div>
  )
}
