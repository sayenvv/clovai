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
      <div className={className}>
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

    case 'process':
    case 'rectangle':
    default:
      return <div className={cn(base, 'rounded-lg', className)}>{label}</div>
  }
})
