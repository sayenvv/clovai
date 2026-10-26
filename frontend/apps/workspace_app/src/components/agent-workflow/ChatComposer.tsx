import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { ArrowUp, Square, type LucideIcon, GripVertical } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'

/*
 * Shared chat UI for the assistant chat and the run chat, so both read as one product:
 * an editor-style composer (text box with a toolbar row), header-led turns instead of
 * bubbles, and the same empty state.
 */

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  /** Called on Enter (or ⌘/Ctrl + Enter) when `canSubmit`. */
  onSubmit: () => void
  canSubmit: boolean
  disabled?: boolean
  placeholder?: string
  /** Left side of the toolbar row (attach, context, model picker). */
  leading?: ReactNode
  /** Right side of the toolbar row (send / stop button). */
  action: ReactNode
  /** Shown under the box, such as what sending will do. */
  hint?: ReactNode
  /** Shown above the text box (e.g. attached file chips). */
  header?: ReactNode
  /** Enables dropping files onto the composer. */
  onFilesDropped?: (files: File[]) => void
  autoFocus?: boolean
  /** Monospace input, for JSON payloads. */
  mono?: boolean
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  canSubmit,
  disabled = false,
  placeholder = 'Type a message',
  leading,
  action,
  hint,
  header,
  onFilesDropped,
  autoFocus = false,
  mono = false,
}: ChatComposerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dropEnabled = Boolean(onFilesDropped) && !disabled

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          // No border: a soft grey field, outlined only while files are dragged over it
          'rounded-[3px] bg-[hsl(var(--chrome-input))] transition-colors',
          isDragging && 'outline-dashed outline-1 outline-foreground/40',
        )}
        onDragOver={(event) => {
          if (!dropEnabled) return
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false)
        }}
        onDrop={(event) => {
          if (!dropEnabled) return
          event.preventDefault()
          setIsDragging(false)
          const files = Array.from(event.dataTransfer.files ?? [])
          if (files.length > 0) onFilesDropped?.(files)
        }}
      >
        {header ? <div className="px-2.5 pt-2.5">{header}</div> : null}
        <Textarea
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'max-h-48 min-h-[56px] resize-none border-0 bg-transparent px-3.5 pb-1 pt-3 text-[13px] leading-relaxed text-foreground shadow-none',
            'placeholder:text-muted-foreground/70 focus-visible:ring-0',
            mono && 'font-mono text-[12px]',
          )}
          spellCheck={false}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter adds a line; ⌘/Ctrl+Enter also sends.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              if (canSubmit) onSubmit()
            }
          }}
        />
        <div className="flex items-center gap-0.5 px-2 pb-2">
          {leading}
          <div className="ml-auto flex items-center gap-1">{action}</div>
        </div>
      </div>
      <p className="flex items-center justify-between gap-2 px-1 text-[10.5px] text-muted-foreground/80">
        <span className="min-w-0 truncate">{hint}</span>
        <span className="shrink-0">
          <Kbd>↵</Kbd> send · <Kbd>⇧</Kbd>
          <Kbd>↵</Kbd> new line
        </span>
      </p>
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mx-px inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[9.5px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

/** A small toolbar icon button inside the composer (attach, context, …). */
export const ComposerIconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; badge?: ReactNode }
>(function ComposerIconButton({ icon: Icon, label, badge, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={props.title ?? label}
      className={cn(
        'relative flex h-7 w-7 items-center justify-center rounded-[2px] text-primary transition-colors',
        'hover:bg-foreground/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-muted data-[state=open]:text-foreground',
        className,
      )}
      {...props}
    >
      <Icon className="h-3.5 w-3.5" />
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold tabular-nums text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  )
})

/** The composer's primary button: send (arrow), or a labelled action such as "Run again". */
export function ComposerSendButton({
  onClick,
  disabled,
  busy = false,
  label = 'Send',
  icon: Icon = ArrowUp,
  text,
}: {
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  label?: string
  icon?: LucideIcon
  /** Shown next to the icon; icon-only when omitted. */
  text?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-7 items-center justify-center gap-1.5 rounded-[2px] bg-primary text-[11.5px] font-medium text-primary-foreground transition-colors',
        'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
        text ? 'px-2.5' : 'w-7',
      )}
    >
      {busy ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      )}
      {text}
    </button>
  )
}

export function ComposerStopButton({ onClick, label = 'Stop' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-7 items-center justify-center gap-1.5 rounded-[2px] bg-foreground/[0.06] px-2.5 text-[11.5px] font-medium text-foreground transition-colors',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <Square className="h-2.5 w-2.5 fill-current" />
      {label}
    </button>
  )
}

/** The header row that starts each turn: avatar, name, and optional detail on the right. */
export function ChatTurnHeader({ avatar, name, meta }: { avatar: ReactNode; name: string; meta?: ReactNode }) {
  return (
    <div className="mb-2 flex min-w-0 items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">{avatar}</span>
      <span className="truncate text-[12.5px] font-semibold text-foreground">{name}</span>
      {meta ? <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{meta}</span> : null}
    </div>
  )
}

/** Indents a turn's body so it lines up under the name in its header. */
export function ChatTurnBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-w-0 pl-8', className)}>{children}</div>
}

/** First-run state for a chat: icon, title, a line of help, and optional suggestions. */
export function ChatEmptyState({
  icon,
  title,
  description,
  suggestions,
  onSuggestion,
  disabled,
}: {
  icon: ReactNode
  title: string
  description: ReactNode
  suggestions?: string[]
  onSuggestion?: (text: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* As the reference's insight cards: a thin-bordered card with a grip and bold title */}
      <section className="rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
          <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
          <span className="flex h-4 w-4 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
          {title}
        </h3>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">{description}</p>
      </section>
      {suggestions?.length ? (
        <section className="rounded-[3px] border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-foreground">
            <GripVertical className="-ml-1 h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
            Try asking
          </h3>
          <ul className="space-y-2.5">
            {suggestions.map((text, index) => (
              <li key={text}>
                <span className="block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Example {index + 1}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSuggestion?.(text)}
                  className="mt-0.5 text-left text-[11.5px] leading-snug text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
                >
                  {text}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
