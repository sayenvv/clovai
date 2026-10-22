/**
 * The shared look of every node card on the canvas (agents, tools, start / end, execution
 * steps): a card with a faint top sheen, a hairline highlight on its top edge, and a
 * layered shadow that lifts on hover. Kept in one place so all node kinds match.
 */
export const NODE_SURFACE = [
  'border border-border/80 bg-card bg-gradient-to-b from-transparent to-black/[0.025]',
  'shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_14px_-4px_rgba(16,24,40,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]',
  'dark:border-white/[0.08] dark:from-white/[0.045] dark:to-transparent',
  'dark:shadow-[0_1px_2px_rgba(0,0,0,0.6),0_10px_24px_-10px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)]',
  'transition-[border-color,box-shadow] duration-150',
].join(' ')

export const NODE_SURFACE_HOVER = [
  'hover:border-foreground/25',
  'hover:shadow-[0_2px_4px_rgba(16,24,40,0.06),0_12px_24px_-8px_rgba(16,24,40,0.14),inset_0_1px_0_rgba(255,255,255,0.8)]',
  'dark:hover:border-white/20',
  'dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.6),0_16px_32px_-10px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)]',
].join(' ')

export const NODE_SURFACE_SELECTED =
  'border-foreground/70 hover:border-foreground/70 ring-[3px] ring-foreground/10 dark:border-white/60 dark:hover:border-white/60 dark:ring-white/10'

/** The neutral icon tile used for agents: a soft raised square. */
export const NODE_ICON_TILE = [
  'relative flex shrink-0 items-center justify-center rounded-[10px]',
  'bg-gradient-to-b from-muted/40 to-muted text-foreground/75 ring-1 ring-inset ring-border',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
].join(' ')

/** A status dot that sits on the corner of an icon tile. */
export function nodeStatusDot(tone: 'ready' | 'attention' | 'running' | 'idle'): string {
  return [
    'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card',
    tone === 'ready'
      ? 'bg-emerald-500'
      : tone === 'attention'
        ? 'bg-amber-500'
        : tone === 'running'
          ? 'animate-pulse bg-foreground'
          : 'bg-muted-foreground/40',
  ].join(' ')
}
