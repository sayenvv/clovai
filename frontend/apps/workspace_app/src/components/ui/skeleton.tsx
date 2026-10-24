import { cn } from '@/utils/cn'

/** A loading placeholder with a soft light sweep across it. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-md bg-muted bg-[length:200%_100%] motion-safe:animate-shimmer',
        'bg-[linear-gradient(90deg,transparent_0%,hsl(var(--foreground)/0.06)_50%,transparent_100%)]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
