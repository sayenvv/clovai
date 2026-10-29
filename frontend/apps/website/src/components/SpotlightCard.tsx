import { useRef, type ReactNode } from 'react'

/** A glass card with a soft light that follows the cursor across it and its border. */
export function SpotlightCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (event: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    ref.current!.style.setProperty('--x', `${event.clientX - box.left}px`)
    ref.current!.style.setProperty('--y', `${event.clientY - box.top}px`)
  }
  return (
    <div
      ref={ref}
      onPointerMove={move}
      className={`glass group relative overflow-hidden rounded-3xl ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--x) var(--y), rgba(11,36,25,0.05), transparent 60%)' }}
        aria-hidden
      />
      <div className="relative h-full">{children}</div>
    </div>
  )
}
