import { memo, type CSSProperties } from 'react'
import { cn } from '@/utils/cn'
import { resolveNodeColors, type ResolvedDiagramColors } from './diagram-colors'
import type { PaletteShape } from '@/types/config'

const S = {
  fill: (c: ResolvedDiagramColors, extra?: CSSProperties): CSSProperties => ({
    backgroundColor: c.fill,
    ...extra,
  }),
  border: (c: ResolvedDiagramColors, extra?: CSSProperties): CSSProperties => ({
    borderColor: c.border,
    borderWidth: 2,
    borderStyle: 'solid',
    ...extra,
  }),
  text: (c: ResolvedDiagramColors, extra?: CSSProperties): CSSProperties => ({
    color: c.text,
    ...extra,
  }),
  box: (c: ResolvedDiagramColors, extra?: CSSProperties): CSSProperties => ({
    backgroundColor: c.fill,
    borderColor: c.border,
    borderWidth: 2,
    borderStyle: 'solid',
    color: c.text,
    ...extra,
  }),
}

const CLIP_PATHS: Partial<Record<PaletteShape, string>> = {
  decision: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  hexagon: 'polygon(16% 0%, 84% 0%, 100% 50%, 84% 100%, 16% 100%, 0% 50%)',
  trapezoid: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)',
  triangle: 'polygon(0% 0%, 100% 0%, 50% 100%)',
  'off-page': 'polygon(0% 0%, 100% 0%, 100% 62%, 50% 100%, 0% 62%)',
  'manual-input': 'polygon(0% 28%, 100% 0%, 100% 100%, 0% 100%)',
}

interface NodeShapeProps {
  shape: PaletteShape
  label: string
  fillColor?: string
  borderColor?: string
  isDark?: boolean
  className?: string
}

const ClippedShape = memo(function ClippedShape({
  clipPath,
  colors,
  label,
  labelClassName,
}: {
  clipPath: string
  colors: ResolvedDiagramColors
  label: string
  labelClassName?: string
}) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0" style={{ clipPath, backgroundColor: colors.border }} />
      <div className="absolute inset-[2px]" style={{ clipPath, ...S.fill(colors) }} />
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
          labelClassName)}
        style={S.text(colors)}
      >
        {label}
      </span>
    </div>
  )
})

export const NodeShape = memo(function NodeShape({
  shape,
  label,
  fillColor,
  borderColor,
  isDark = false,
  className,
}: NodeShapeProps) {
  const colors = resolveNodeColors({ fillColor, borderColor }, isDark)
  const base = cn(
    'flex h-full w-full items-center justify-center border-2 px-3 text-center text-xs font-medium shadow-sm transition-shadow',
    className)
  const boxStyle = S.box(colors)

  const clipPath = CLIP_PATHS[shape]
  if (clipPath) {
    return (
      <div className={cn('h-full w-full', className)}>
        <ClippedShape
          clipPath={clipPath}
          colors={colors}
          label={label}
          labelClassName={cn(
            shape === 'decision' && 'px-8',
            shape === 'triangle' && 'items-start pt-2',
            shape === 'off-page' && 'items-start pt-3',
            shape === 'manual-input' && 'items-end pb-2')}
        />
      </div>
    )
  }

  switch (shape) {
    case 'terminator':
      return <div className={cn(base, 'rounded-full', className)} style={boxStyle}>{label}</div>

    case 'input-output':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className={cn('absolute inset-0 -skew-x-12 rounded-md border-2 shadow-sm')}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium')}
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
              'absolute inset-0 rounded-[50%_50%_50%_50%/14%_14%_14%_14%] border-2 shadow-sm')}
          />
          <div className={cn('absolute inset-x-0 top-0 h-4 rounded-[50%] border-2')} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-3 pt-2 text-center text-xs font-medium')}
          >
            {label}
          </span>
        </div>
      )

    case 'document':
      return <div className={cn(base, 'rounded-md rounded-br-[45%_70%]', className)} style={boxStyle}>{label}</div>

    case 'delay':
      return <div className={cn(base, 'rounded-md rounded-r-full', className)} style={boxStyle}>{label}</div>

    case 'connector':
    case 'circle':
      return <div className={cn(base, 'rounded-full px-1', className)} style={boxStyle}>{label}</div>

    case 'ellipse':
      return <div className={cn(base, 'rounded-[50%]', className)} style={boxStyle}>{label}</div>

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
            className)}
        >
          {label}
        </div>
      )

    case 'swimlane-pool':
      return (
        <div
          className={cn(
            'relative flex h-full w-full flex-col overflow-hidden rounded-lg border-2 shadow-sm',
            className)}
        >
          <div
            className={cn(
              'flex min-h-9 shrink-0 items-center border-b-2 px-3 py-1.5 text-xs font-semibold leading-snug')}
          >
            <span className="break-words">{label}</span>
          </div>
          <div className={cn('min-h-0 flex-1', 'opacity-35')} />
        </div>
      )

    case 'swimlane-lane':
      return (
        <div
          className={cn(
            'flex h-full w-full overflow-hidden rounded-md border-2 shadow-sm',
            className)}
        >
          <div
            className={cn(
              'flex w-10 shrink-0 items-center justify-center border-r-2 px-1')}
          >
            <span className="whitespace-nowrap text-xs font-semibold -rotate-90">{label}</span>
          </div>
          <div className={cn('min-w-0 flex-1', 'opacity-30')} />
        </div>
      )

    case 'swimlane-vertical':
      return (
        <div
          className={cn(
            'flex h-full w-full flex-col overflow-hidden rounded-md border-2 shadow-sm',
            className)}
        >
          <div
            className={cn(
              'flex min-h-9 shrink-0 items-center justify-center border-b-2 px-2 py-1.5 text-center text-xs font-semibold leading-snug')}
          >
            <span className="break-words">{label}</span>
          </div>
          <div className={cn('min-h-0 flex-1', 'opacity-30')} />
        </div>
      )

    case 'subprocess':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div className={cn('absolute inset-0 rounded-lg border-2 shadow-sm')} />
          <div className={cn('absolute inset-[5px] rounded-md border-2')} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium')}
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
          <div className={cn('absolute inset-0 rounded-full border-2')} />
          <div className={cn('absolute inset-[4px] rounded-full border')} />
          {label && (
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center px-1 text-center text-[9px] font-medium')}
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
              'absolute inset-x-0 top-0 bottom-2 rounded-t-lg border-2 border-b-0 shadow-sm')}
          />
          <div
            className={cn(
              'absolute inset-x-2 bottom-0 h-2 rounded-b-[50%] border-2 border-t-0')}
          />
          <span
            className={cn(
              'absolute inset-x-0 top-0 bottom-2 flex items-center justify-center px-3 text-center text-xs font-medium')}
          >
            {label}
          </span>
        </div>
      )

    case 'display':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className={cn('absolute inset-0 skew-x-12 rounded-md border-2 shadow-sm')}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium')}
          >
            {label}
          </span>
        </div>
      )

    case 'annotation':
      return (
        <div className={cn('relative flex h-full w-full items-center', className)}>
          <div className={cn('h-full w-1.5 shrink-0 rounded-l-sm')} />
          <div
            className={cn(
              'flex h-[calc(100%-8px)] flex-1 items-center border border-l-0 px-2 text-left text-[11px] font-medium',
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
            )}
          />
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 h-[calc(100%-6px)] rounded-md rounded-br-[40%_55%] border-2 shadow-sm',
            )}
          />
          <span
            className={cn(
              'absolute inset-x-0 bottom-0 flex h-[calc(100%-6px)] items-center justify-center px-3 text-center text-xs font-medium',
            )}
          >
            {label}
          </span>
        </div>
      )

    case 'card':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div className={cn('absolute inset-0 rounded-lg border-2 shadow-sm')} />
          <div
            className={cn(
              'absolute right-0 top-0 h-5 w-5 border-b-2 border-l-2 bg-background')}
            style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium')}
          >
            {label}
          </span>
        </div>
      )

    case 'internal-storage':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div className={cn('absolute inset-0 rounded-lg border-2 shadow-sm')} />
          <div className={cn('absolute left-2 top-2 h-4 w-4 border-b-2 border-r-2')} />
          <div className={cn('absolute left-2 top-2 h-7 w-7 border-l-2 border-t-2')} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium')}
          >
            {label}
          </span>
        </div>
      )

    case 'process':
    case 'rectangle':
    default:
      return <div className={cn(base, 'rounded-lg', className)} style={boxStyle}>{label}</div>
  }
})
