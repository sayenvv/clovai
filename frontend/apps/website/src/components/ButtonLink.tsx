import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { newTab } from '@/config'

type Variant = 'primary' | 'glass' | 'white'

const VARIANTS: Record<Variant, string> = {
  // The brand green, the one filled button on a page
  primary: 'bg-forest-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_2px_rgba(11,36,25,0.3)] hover:bg-forest',
  // Secondary: white with a hairline
  glass: 'bg-white text-bone shadow-[0_0_0_1px_rgba(23,23,23,0.12),0_1px_2px_rgba(23,23,23,0.05)] hover:bg-night-600',
  // On dark panels
  white: 'bg-white text-forest shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:bg-night-600',
}

/** A link styled as a button; `arrow` adds an arrow that slides on hover. Links into the workspace open a new tab. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  arrow = false,
  children,
  className = '',
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; arrow?: boolean; children: ReactNode }) {
  const sizes = { sm: 'h-8 px-3.5 text-[13px]', md: 'h-10 px-4 text-[14px]', lg: 'h-11 px-5 text-[14.5px]' }
  return (
    <a
      {...newTab(props.href)}
      {...props}
      className={`group inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[background-color,transform] duration-200 active:scale-[0.98] ${sizes[size]} ${VARIANTS[variant]} ${className}`}
    >
      {children}
      {arrow ? <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden /> : null}
    </a>
  )
}
