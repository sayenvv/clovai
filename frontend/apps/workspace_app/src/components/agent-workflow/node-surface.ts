/**
 * The shared look of every node card on the canvas (agents, tools, start / end, execution
 * steps): a flat, square-cornered card in the theme's node colours (`--node*` in index.css) with a
 * hairline border, a faint shadow and the primary colour when selected. Light and dark use the same rules; only the tokens differ.
 */
export const NODE_SURFACE = [
  'border border-[hsl(var(--node-border))] bg-[hsl(var(--node))]',
  'shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
  'transition-[border-color,box-shadow,background-color] duration-150',
].join(' ')

export const NODE_SURFACE_HOVER = 'hover:bg-[hsl(var(--node-hover))]'

export const NODE_SURFACE_SELECTED = [
  'border-primary hover:border-primary',
  'bg-[hsl(var(--node-selected))] hover:bg-[hsl(var(--node-selected))]',
  'ring-[3px] ring-primary/15',
].join(' ')

/** The icon tile used for agents: a flat square in the primary tint, like the library rows. */
export const NODE_ICON_TILE = 'relative flex shrink-0 items-center justify-center rounded-[2px] bg-primary/10 text-primary'

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
