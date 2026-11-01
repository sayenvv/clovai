import { cn } from '@/utils/cn'

/** Workflow AI's icon: a chat bubble with sparkles at its top corner. Sized and coloured like a lucide icon. */
export function AssistantChatIcon({ className, strokeWidth = 1.75 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-4 w-4', className)}
      aria-hidden
    >
      {/* The bubble, open at its top right where the sparkles sit */}
      <path d="M13 4H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h1v3.5l4.2-3.5H17a3 3 0 0 0 3-3v-3" />
      <path d="M7.5 9.5h5M7.5 12.5h7" />
      {/* A large and a small four-point sparkle */}
      <path d="M18.5 1.8l.75 2 2 .75-2 .75-.75 2-.75-2-2-.75 2-.75z" fill="currentColor" strokeWidth={1} />
      <path d="M22.2 7.6l.35.9.9.35-.9.35-.35.9-.35-.9-.9-.35.9-.35z" fill="currentColor" strokeWidth={0.8} />
    </svg>
  )
}
