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
  /** Sidebar palette uses tighter geometry so shapes read correctly at small sizes. */
  variant?: 'canvas' | 'palette'
  /** Icon path for cloud / service nodes. */
  icon?: string
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
          labelClassName,
        )}
        style={S.text(colors)}
      >
        {label}
      </span>
    </div>
  )
})

function ServiceNode({
  label,
  icon,
  variant,
  className,
  colors,
}: {
  label: string
  icon?: string
  variant: 'canvas' | 'palette'
  className?: string
  colors: ResolvedDiagramColors
}) {
  const isPalette = variant === 'palette'

  if (!icon) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-muted/30',
          className,
        )}
      >
        <span className="text-[10px] font-medium text-muted-foreground">{label || 'Service'}</span>
      </div>
    )
  }

  return (
    <div
      className={cn('flex h-full w-full items-center justify-center', className)}
      title={label || undefined}
    >
      <img
        src={icon}
        alt={label}
        className={cn('object-contain', isPalette ? 'h-8 w-8' : 'h-full w-full')}
        draggable={false}
      />
    </div>
  )
}

export const NodeShape = memo(function NodeShape({
  shape,
  label,
  fillColor,
  borderColor,
  isDark = false,
  className,
  variant = 'canvas',
  icon,
}: NodeShapeProps) {
  const colors = resolveNodeColors({ fillColor, borderColor }, isDark)
  const isPalette = variant === 'palette'
  const base = cn(
    'flex h-full w-full items-center justify-center border-2 px-3 text-center text-xs font-medium shadow-sm transition-shadow',
    className,
  )
  const boxStyle = S.box(colors)
  const labelStyle = S.text(colors)

  if (shape === 'service') {
    return (
      <ServiceNode
        colors={colors}
        label={label}
        icon={icon}
        variant={variant}
        className={className}
      />
    )
  }

  const clipPath = CLIP_PATHS[shape]
  if (clipPath) {
    return (
      <div className={cn('h-full w-full', className)}>
        <ClippedShape
          clipPath={clipPath}
          colors={colors}
          label={label}
          labelClassName={cn(
            isPalette && 'px-1 text-[0px]',
            shape === 'decision' && !isPalette && 'px-8',
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
      return (
        <div
          className={cn(base, isPalette ? 'rounded-full px-1' : 'rounded-full', className)}
          style={boxStyle}
        >
          {label}
        </div>
      )

    case 'input-output':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className="absolute inset-0 -skew-x-12 border-2 shadow-sm"
            style={boxStyle}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              isPalette && 'px-1 text-[0px]',
            )}
            style={labelStyle}
          >
            {label}
          </span>
        </div>
      )

    case 'database':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className="absolute inset-0 rounded-[50%_50%_50%_50%/14%_14%_14%_14%] border-2 shadow-sm"
            style={boxStyle}
          />
          <div
            className="absolute inset-x-0 top-0 h-[22%] rounded-[50%] border-2"
            style={S.border(colors, S.fill(colors))}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-3 pt-[10%] text-center text-xs font-medium',
              isPalette && 'px-1 text-[0px]',
            )}
            style={labelStyle}
          >
            {label}
          </span>
        </div>
      )

    case 'document':
      return (
        <div
          className={cn(base, 'rounded-br-[45%_70%]', isPalette && 'rounded-br-[40%_60%]', className)}
          style={boxStyle}
        >
          {label}
        </div>
      )

    case 'delay':
      return (
        <div
          className={cn(base, 'rounded-r-full', className)}
          style={boxStyle}
        >
          {label}
        </div>
      )

    case 'connector':
    case 'circle':
      return (
        <div className={cn(base, 'rounded-full px-1', className)} style={boxStyle}>
          {label}
        </div>
      )

    case 'ellipse':
      return (
        <div className={cn(base, 'rounded-[50%]', className)} style={boxStyle}>
          {label}
        </div>
      )

    case 'note':
      return (
        <div
          className={cn(
            base,
            'items-start justify-start p-3 text-left shadow-md',
            isPalette ? 'rounded-br-xl p-1.5' : 'rounded-br-2xl',
            className,
          )}
          style={boxStyle}
        >
          {label}
        </div>
      )

    case 'text':
      return (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center px-2 text-center text-sm font-medium',
            isPalette && 'border border-dashed border-muted-foreground/40',
            className,
          )}
          style={labelStyle}
        >
          {label || (isPalette ? 'Text' : '')}
        </div>
      )

    case 'swimlane-pool':
      return (
        <div
          className={cn(
            'relative flex h-full w-full flex-col overflow-hidden border-2 shadow-sm',
            className,
          )}
          style={boxStyle}
        >
          <div
            className="flex min-h-6 shrink-0 items-center border-b-2 px-2 py-1 text-[10px] font-semibold leading-snug"
            style={S.border(colors, { borderWidth: 0, borderBottomWidth: 2 })}
          >
            <span className={cn('break-words', isPalette && 'truncate text-[0px]')}>{label}</span>
          </div>
          <div className="min-h-0 flex-1 opacity-35" style={S.fill(colors, { opacity: 0.35 })} />
        </div>
      )

    case 'swimlane-lane':
      return (
        <div
          className={cn(
            'flex h-full w-full overflow-hidden border-2 shadow-sm',
            className,
          )}
          style={boxStyle}
        >
          <div
            className="flex w-8 shrink-0 items-center justify-center border-r-2 px-0.5"
            style={S.border(colors, { borderWidth: 0, borderRightWidth: 2 })}
          >
            <span className={cn('whitespace-nowrap text-[9px] font-semibold -rotate-90', isPalette && 'text-[0px]')}>
              {label}
            </span>
          </div>
          <div className="min-w-0 flex-1 opacity-30" style={S.fill(colors, { opacity: 0.3 })} />
        </div>
      )

    case 'swimlane-vertical':
      return (
        <div
          className={cn(
            'flex h-full w-full flex-col overflow-hidden border-2 shadow-sm',
            className,
          )}
          style={boxStyle}
        >
          <div
            className="flex min-h-6 shrink-0 items-center justify-center border-b-2 px-1 py-1 text-center text-[9px] font-semibold leading-snug"
            style={S.border(colors, { borderWidth: 0, borderBottomWidth: 2 })}
          >
            <span className={cn('break-words', isPalette && 'truncate text-[0px]')}>{label}</span>
          </div>
          <div className="min-h-0 flex-1 opacity-30" style={S.fill(colors, { opacity: 0.3 })} />
        </div>
      )

    case 'subprocess':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className="absolute inset-0 border-2 shadow-sm"
            style={boxStyle}
          />
          <div
            className={cn('absolute border-2', isPalette ? 'inset-[3px]' : 'inset-[5px]')}
            style={S.border(colors)}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              isPalette && 'px-1 text-[0px]',
            )}
            style={labelStyle}
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
            labelClassName={cn('text-base font-bold', isPalette && 'text-[10px]')}
          />
        </div>
      )

    case 'or-gate':
      return (
        <div
          className={cn(base, 'rounded-full px-1 text-base font-bold', isPalette && 'text-xs', className)}
          style={boxStyle}
        >
          {label || '○'}
        </div>
      )

    case 'event':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div className="absolute inset-0 rounded-full border-2" style={S.border(colors, S.fill(colors))} />
          <div
            className={cn('absolute rounded-full border', isPalette ? 'inset-[2px]' : 'inset-[4px]')}
            style={S.border(colors)}
          />
          {label && (
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center px-1 text-center font-medium',
                isPalette ? 'text-[0px]' : 'text-[9px]',
              )}
              style={labelStyle}
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
            className="absolute inset-x-0 top-0 bottom-[14%] border-2 border-b-0 shadow-sm"
            style={boxStyle}
          />
          <div
            className="absolute inset-x-[8%] bottom-0 h-[14%] rounded-b-[50%] border-2 border-t-0"
            style={S.border(colors, S.fill(colors))}
          />
          <span
            className={cn(
              'absolute inset-x-0 top-0 bottom-[14%] flex items-center justify-center px-3 text-center text-xs font-medium',
              isPalette && 'px-1 text-[0px]',
            )}
            style={labelStyle}
          >
            {label}
          </span>
        </div>
      )

    case 'display':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className="absolute inset-0 skew-x-12 border-2 shadow-sm"
            style={boxStyle}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              isPalette && 'px-1 text-[0px]',
            )}
            style={labelStyle}
          >
            {label}
          </span>
        </div>
      )

    case 'annotation':
      return (
        <div className={cn('relative flex h-full w-full items-center', className)}>
          <div className="h-full w-1.5 shrink-0" style={S.fill(colors)} />
          <div
            className={cn(
              'flex h-[calc(100%-6px)] flex-1 items-center border border-l-0 px-2 text-left font-medium',
              isPalette ? 'text-[0px]' : 'text-[11px]',
            )}
            style={S.border(colors, S.fill(colors))}
          >
            {label}
          </div>
        </div>
      )

    case 'multi-document':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className="absolute inset-x-[8%] top-0 h-[calc(100%-12%)] rounded-br-[40%_55%] border-2 opacity-60"
            style={S.border(colors, S.fill(colors))}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[calc(100%-12%)] rounded-br-[40%_55%] border-2 shadow-sm"
            style={boxStyle}
          />
          <span
            className={cn(
              'absolute inset-x-0 bottom-0 flex h-[calc(100%-12%)] items-center justify-center px-3 text-center text-xs font-medium',
              isPalette && 'px-1 text-[0px]',
            )}
            style={labelStyle}
          >
            {label}
          </span>
        </div>
      )

    case 'card':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className="absolute inset-0 border-2 shadow-sm"
            style={boxStyle}
          />
          <div
            className="absolute right-0 top-0 h-[18%] w-[18%] border-b-2 border-l-2 bg-background"
            style={{ ...S.border(colors), clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              isPalette && 'px-1 text-[0px]',
            )}
            style={labelStyle}
          >
            {label}
          </span>
        </div>
      )

    case 'internal-storage':
      return (
        <div className={cn('relative h-full w-full', className)}>
          <div
            className="absolute inset-0 border-2 shadow-sm"
            style={boxStyle}
          />
          <div
            className={cn('absolute border-b-2 border-r-2', isPalette ? 'left-1.5 top-1.5 h-2.5 w-2.5' : 'left-2 top-2 h-4 w-4')}
            style={S.border(colors)}
          />
          <div
            className={cn('absolute border-l-2 border-t-2', isPalette ? 'left-1.5 top-1.5 h-4 w-4' : 'left-2 top-2 h-7 w-7')}
            style={S.border(colors)}
          />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-medium',
              isPalette && 'px-1 text-[0px]',
            )}
            style={labelStyle}
          >
            {label}
          </span>
        </div>
      )

    case 'process':
    case 'rectangle':
    default:
      return (
        <div className={cn(base, className)} style={boxStyle}>
          {label}
        </div>
      )
  }
})
