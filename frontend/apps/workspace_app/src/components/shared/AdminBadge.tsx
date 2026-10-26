import { ShieldCheck } from 'lucide-react'

/** A small shield on the profile avatar for admin accounts; nothing for everyone else. */
export function AdminBadge({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span
      className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white ring-2 ring-card"
      title="Admin"
      aria-label="Admin"
    >
      <ShieldCheck className="h-2.5 w-2.5" />
    </span>
  )
}
