import { cn } from '@/utils/cn'

const PETAL = 'M97,93 C95,78 86,58 70,42 Q60,31 72,24 L104,10 Q122,3 125,20 Q128,42 97,93 Z'
const ANGLES = [-15, 45, 105, 165, 225, 285]

/**
 * The brand loading mark: six petals lighting up in turn.
 *
 * Petals use `currentColor`, which defaults to the app's text colour: black in
 * light mode, white in dark mode, following the app's theme toggle. Pass a
 * text class to recolour it. Animation styles live in `index.css` under `.petal-loader`.
 */
export function PetalLoader({
  size = 64,
  label = 'Loading',
  className,
}: {
  size?: number
  label?: string
  className?: string
}) {
  return (
    <svg
      className={cn('petal-loader shrink-0 text-foreground', className)}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={label}
    >
      <g className="spinner">
        {ANGLES.map((angle, index) => (
          <g key={angle} className="p" style={{ '--i': index } as React.CSSProperties}>
            <path d={PETAL} transform={`rotate(${angle} 100 100) translate(3,-7) scale(.96)`} fill="currentColor" />
          </g>
        ))}
      </g>
    </svg>
  )
}

/** The same six-petal mark, still and fully filled, for use as the brand icon. */
export function PetalMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn('shrink-0 text-foreground', className)}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      {ANGLES.map((angle) => (
        <path key={angle} d={PETAL} transform={`rotate(${angle} 100 100) translate(3,-7) scale(.96)`} fill="currentColor" />
      ))}
    </svg>
  )
}
