import { cn } from '@/utils/cn'
import { LOGO_SRC, LOGO_SRC_DARK } from '@/components/shared/Logo'

const LOADER_SRC = '/brand/loader-darkgreen.svg'
const LOADER_SRC_DARK = '/brand/loader-white.svg'

/** A light/dark pair of images: the dark-green one on light surfaces, the white one in dark mode. */
function ThemedImage({
  light,
  dark,
  size,
  className,
}: {
  light: string
  dark: string
  size: number
  className?: string
}) {
  return (
    <span className={cn('inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <img src={light} alt="" width={size} height={size} className="h-full w-full dark:hidden" decoding="async" />
      <img src={dark} alt="" width={size} height={size} className="hidden h-full w-full dark:block" decoding="async" />
    </span>
  )
}

/**
 * The brand loading mark: the workflow mark drawing itself in, then out.
 * The animation lives inside the SVG; it swaps to the white version in dark mode.
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
    <span role="img" aria-label={label} className="inline-flex shrink-0">
      <ThemedImage light={LOADER_SRC} dark={LOADER_SRC_DARK} size={size} className={className} />
    </span>
  )
}

/** The brand mark, still, for use as the brand icon. */
export function PetalMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0">
      <ThemedImage light={LOGO_SRC} dark={LOGO_SRC_DARK} size={size} className={className} />
    </span>
  )
}
