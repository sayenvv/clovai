import { memo } from 'react'
import { cn } from '@/utils/cn'
import type { PaletteColor, PaletteShape } from '@/types/config'

interface ColorClasses {
  surface: string
  border: string
  /** Solid fill used to fake a border on clip-path shapes. */
  clipBorder: string
  text: string
}

const COLOR_MAP: Record<PaletteColor, ColorClasses> = {
  emerald: {
    surface: 'bg-emerald-50 dark:bg-emerald-950',
    border: 'border-emerald-400/80 dark:border-emerald-500/60',
    clipBorder: 'bg-emerald-400/80 dark:bg-emerald-500/60',
    text: 'text-emerald-800 dark:text-emerald-200',
  },
  blue: {
    surface: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-400/80 dark:border-blue-500/60',
    clipBorder: 'bg-blue-400/80 dark:bg-blue-500/60',
    text: 'text-blue-800 dark:text-blue-200',
  },
  amber: {
    surface: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-400/80 dark:border-amber-500/60',
    clipBorder: 'bg-amber-400/80 dark:bg-amber-500/60',
    text: 'text-amber-800 dark:text-amber-200',
  },
  violet: {
    surface: 'bg-violet-50 dark:bg-violet-950',
    border: 'border-violet-400/80 dark:border-violet-500/60',
    clipBorder: 'bg-violet-400/80 dark:bg-violet-500/60',
    text: 'text-violet-800 dark:text-violet-200',
  },
  cyan: {
    surface: 'bg-cyan-50 dark:bg-cyan-950',
    border: 'border-cyan-400/80 dark:border-cyan-500/60',
    clipBorder: 'bg-cyan-400/80 dark:bg-cyan-500/60',
    text: 'text-cyan-800 dark:text-cyan-200',
  },
  rose: {
    surface: 'bg-rose-50 dark:bg-rose-950',
    border: 'border-rose-400/80 dark:border-rose-500/60',
    clipBorder: 'bg-rose-400/80 dark:bg-rose-500/60',
    text: 'text-rose-800 dark:text-rose-200',
  },
  slate: {
    surface: 'bg-slate-50 dark:bg-slate-900',
    border: 'border-slate-400/80 dark:border-slate-500/60',
    clipBorder: 'bg-slate-400/80 dark:bg-slate-500/60',
    text: 'text-slate-800 dark:text-slate-200',
  },
}

const CLIP_PATHS: Partial<Record<PaletteShape, string>> = {
  // The diamond fills its whole bounding box so connection ports at the
  // box midpoints land exactly on its vertices.
  decision: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  hexagon: 'polygon(16% 0%, 84% 0%, 100% 50%, 84% 100%, 16% 100%, 0% 50%)',
  trapezoid: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)',
  triangle: 'polygon(0% 0%, 100% 0%, 50% 100%)',
  'off-page': 'polygon(0% 0%, 100% 0%, 100% 62%, 50% 100%, 0% 62%)',
  'manual-input': 'polygon(0% 28%, 100% 0%, 100% 100%, 0% 100%)',
}

interface NodeShapeProps {
  shape: PaletteShape
  color: PaletteColor
  label: string
  selected?: boolean
  className?: string
}

/** Clip-path shapes can't use CSS borders, so we layer a slightly inset
 *  surface over a solid "border" fill with the same clip. */
const ClippedShape = memo(function ClippedShape({
  clipPath,
  colors,
  label,
  selected,
  labelClassName,
}: {
  clipPath: string
  colors: ColorClasses
  label: string
  selected: boolean
  labelClassName?: string
}) {
  return (
    <div className={cn('relative h-full w-full', selected && 'drop-shadow-[0_0_5px_hsl(var(--primary))]')}>
      <div className={cn('absolute inset-0', colors.clipBorder)} style={{ clipPath }} />
      <div className={cn('absolute inset-[2px]', colors.surface)} style={{ clipPath }} />
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
          colors.text,
          labelClassName,
        )}
      >
        {label}
      </span>
    </div>
  )
})

/** Pure visual rendering of a diagram shape (used on canvas and, scaled
 *  down, as palette previews). */
export const NodeShape = memo(function NodeShape({
  shape,
  color,
  label,
  selected = false,
  className,
}: NodeShapeProps) {
  const colors = COLOR_MAP[color]
  const selectedRing = selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
  const base = cn(
    'flex h-full w-full items-center justify-center border-2 px-3 text-center text-xs font-medium shadow-sm transition-shadow',
    colors.surface,
    colors.border,
    colors.text,
    selectedRing,
  )

  const clipPath = CLIP_PATHS[shape]
  if (clipPath) {
    return (
      <div className={cn('h-full w-full', className)}>
        <ClippedShape
          clipPath={clipPath}
          colors={colors}
          label={label}
          selected={selected}
          labelClassName={cn(
            shape === 'decision' && 'px-8',
            shape === 'triangle' && 'items-start pt-2',
            shape === 'off-page' && 'items-start pt-3',
            shape === 'manual-input' && 'items-end pb-2',
          )}
        />
      </div>
    )
  }

  switch (shape) {
    case 'terminator':
      return <div className={cn(base, 'rounded-full', className)}>{label}</div>

    case 'input-output':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className={cn('absolute inset-0 -skew-x-12 rounded-md border-2 shadow-sm', colors.surface, colors.border, selectedRing)}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              colors.text,
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'database':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className={cn(
              'absolute inset-0 rounded-[50%_50%_50%_50%/14%_14%_14%_14%] border-2 shadow-sm',
              colors.surface,
              colors.border,
              selectedRing,
            )}
          />
          <div className={cn('absolute inset-x-0 top-0 h-4 rounded-[50%] border-2', colors.border, colors.surface)} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-3 pt-2 text-center text-xs font-medium',
              colors.text,
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'document':
      return <div className={cn(base, 'rounded-md rounded-br-[45%_70%]', className)}>{label}</div>

    case 'delay':
      return <div className={cn(base, 'rounded-md rounded-r-full', className)}>{label}</div>

    case 'connector':
    case 'circle':
      return <div className={cn(base, 'rounded-full px-1', className)}>{label}</div>

    case 'ellipse':
      return <div className={cn(base, 'rounded-[50%]', className)}>{label}</div>

    case 'note':
      return (
        <div className={cn(base, 'items-start justify-start rounded-sm rounded-br-2xl p-3 text-left shadow-md', className)}>
          {label}
        </div>
      )

    case 'text':
      return (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center border-2 border-dashed border-transparent px-2 text-center text-sm font-medium',
            colors.text,
            selected && 'rounded-md border-primary/50',
            className,
          )}
        >
          {label}
        </div>
      )

    case 'swimlane-pool':
      return (
        <div
          className={cn(
            'relative flex h-full w-full flex-col overflow-hidden rounded-lg border-2 shadow-sm',
            colors.border,
            selectedRing,
            className,
          )}
        >
          <div
            className={cn(
              'flex min-h-9 shrink-0 items-center border-b-2 px-3 py-1.5 text-xs font-semibold leading-snug',
              colors.border,
              colors.surface,
              colors.text,
            )}
          >
            <span className="break-words">{label}</span>
          </div>
          <div className={cn('min-h-0 flex-1', colors.surface, 'opacity-35')} />
        </div>
      )

    case 'swimlane-lane':
      return (
        <div
          className={cn(
            'flex h-full w-full overflow-hidden rounded-md border-2 shadow-sm',
            colors.border,
            selectedRing,
            className,
          )}
        >
          <div
            className={cn(
              'flex w-10 shrink-0 items-center justify-center border-r-2 px-1',
              colors.border,
              colors.surface,
              colors.text,
            )}
          >
            <span className="whitespace-nowrap text-xs font-semibold -rotate-90">{label}</span>
          </div>
          <div className={cn('min-w-0 flex-1', colors.surface, 'opacity-30')} />
        </div>
      )

    case 'swimlane-vertical':
      return (
        <div
          className={cn(
            'flex h-full w-full flex-col overflow-hidden rounded-md border-2 shadow-sm',
            colors.border,
            selectedRing,
            className,
          )}
        >
          <div
            className={cn(
              'flex min-h-9 shrink-0 items-center justify-center border-b-2 px-2 py-1.5 text-center text-xs font-semibold leading-snug',
              colors.border,
              colors.surface,
              colors.text,
            )}
          >
            <span className="break-words">{label}</span>
          </div>
          <div className={cn('min-h-0 flex-1', colors.surface, 'opacity-30')} />
        </div>
      )

    case 'subprocess':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div className={cn('absolute inset-0 rounded-lg border-2 shadow-sm', colors.surface, colors.border, selectedRing)} />
          <div className={cn('absolute inset-[5px] rounded-md border-2', colors.border)} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              colors.text,
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'parallel-gateway':
      return (
        <div className={cn('h-full w-full', className)}>
          <ClippedShape
            clipPath={CLIP_PATHS.decision!}
            colors={colors}
            label={label || '+'}
            selected={selected}
            labelClassName="text-base font-bold"
          />
        </div>
      )

    case 'or-gate':
      return (
        <div className={cn(base, 'rounded-full px-1 text-base font-bold', className)}>
          {label || '+'}
        </div>
      )

    case 'event':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div className={cn('absolute inset-0 rounded-full border-2', colors.surface, colors.border, selectedRing)} />
          <div className={cn('absolute inset-[4px] rounded-full border', colors.border)} />
          {label && (
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center px-1 text-center text-[9px] font-medium',
                colors.text,
              )}
            >
              {label}
            </span>
          )}
        </div>
      )

    case 'data-store':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className={cn(
              'absolute inset-x-0 top-0 bottom-2 rounded-t-lg border-2 border-b-0 shadow-sm',
              colors.surface,
              colors.border,
              selectedRing,
            )}
          />
          <div
            className={cn(
              'absolute inset-x-2 bottom-0 h-2 rounded-b-[50%] border-2 border-t-0',
              colors.border,
              colors.surface,
            )}
          />
          <span
            className={cn(
              'absolute inset-x-0 top-0 bottom-2 flex items-center justify-center px-3 text-center text-xs font-medium',
              colors.text,
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'display':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className={cn('absolute inset-0 skew-x-12 rounded-md border-2 shadow-sm', colors.surface, colors.border, selectedRing)}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              colors.text,
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'annotation':
      return (
        <div className={cn('relative flex h-full w-full items-center', className)}>
          <div className={cn('h-full w-1.5 shrink-0 rounded-l-sm', colors.clipBorder)} />
          <div
            className={cn(
              'flex h-[calc(100%-8px)] flex-1 items-center border border-l-0 px-2 text-left text-[11px] font-medium',
              colors.border,
              colors.surface,
              colors.text,
              selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
          >
            {label}
          </div>
        </div>
      )

    case 'multi-document':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className={cn(
              'absolute inset-x-2 top-0 h-[calc(100%-6px)] rounded-md rounded-br-[40%_55%] border-2 opacity-60',
              colors.surface,
              colors.border,
            )}
          />
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 h-[calc(100%-6px)] rounded-md rounded-br-[40%_55%] border-2 shadow-sm',
              colors.surface,
              colors.border,
              selectedRing,
            )}
          />
          <span
            className={cn(
              'absolute inset-x-0 bottom-0 flex h-[calc(100%-6px)] items-center justify-center px-3 text-center text-xs font-medium',
              colors.text,
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'card':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div className={cn('absolute inset-0 rounded-lg border-2 shadow-sm', colors.surface, colors.border, selectedRing)} />
          <div
            className={cn(
              'absolute right-0 top-0 h-5 w-5 border-b-2 border-l-2 bg-background',
              colors.border,
            )}
            style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              colors.text,
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'internal-storage':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div className={cn('absolute inset-0 rounded-lg border-2 shadow-sm', colors.surface, colors.border, selectedRing)} />
          <div className={cn('absolute left-2 top-2 h-4 w-4 border-b-2 border-r-2', colors.border)} />
          <div className={cn('absolute left-2 top-2 h-7 w-7 border-l-2 border-t-2', colors.border)} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              colors.text,
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'process':
    case 'rectangle':
    default:
      return <div className={cn(base, 'rounded-lg', className)}>{label}</div>
  }
})
